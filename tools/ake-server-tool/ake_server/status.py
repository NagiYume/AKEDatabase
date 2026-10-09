from __future__ import annotations

import hmac
import json
import ssl
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


PUBLIC_STATUS_FIELDS = (
    "message", "healthy", "official_version", "remote_latest", "last_check_at", "last_success_at",
    "interval_seconds", "upload_enabled", "table_count", "remote_missing_files", "error",
    "watch_enabled", "watch_state",
    "stage", "task_mode", "task_id", "task_status", "updated_at",
    "current", "total", "progress_unit", "file_name", "file_index", "file_total",
    "file_bytes", "file_size", "bytes_current", "bytes_total",
    "upload_concurrency", "active_files",
    "configured_upload_concurrency",
    "download_concurrency", "configured_download_concurrency",
)


def start_status(worker):
    config = worker.config
    secret = Path(config["status_token_file"]).read_text().strip()
    if len(secret) < 32:
        raise ValueError("Status access token too short")
    web = Path(__file__).resolve().parent.parent / "web"
    tls = bool(config.get("tls_cert"))
    attempts = {}
    mutex = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_):
            pass  # Never log request headers, cookies, query strings, or passwords.

        def reply(self, code, body, content_type="application/json; charset=utf-8", cookie=None):
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            if cookie:
                self.send_header("Set-Cookie", cookie)
            self.end_headers()
            self.wfile.write(body)

        def authorized(self):
            try:
                cookies = SimpleCookie(self.headers.get("Cookie", ""))
                value = cookies.get("ake_session")
                return bool(value and hmac.compare_digest(value.value, secret))
            except Exception:
                return False

        def status_payload(self):
            authenticated = self.authorized()
            state = worker.snapshot()
            if not authenticated:
                state = {key: state.get(key) for key in PUBLIC_STATUS_FIELDS}
            return {**state, "authenticated": authenticated}

        def do_GET(self):
            if self.path in ("/", "/app.js"):
                path = web / ("index.html" if self.path == "/" else "app.js")
                self.reply(200, path.read_bytes(), "text/html; charset=utf-8" if self.path == "/" else "text/javascript; charset=utf-8")
            elif self.path == "/healthz":
                self.reply(200 if worker.snapshot()["healthy"] else 503, b'{"service":"ake-tablecfg"}')
            elif self.path == "/api/status":
                self.reply(200, json.dumps(self.status_payload(), ensure_ascii=False).encode())
            else:
                self.reply(404, b"{}")

        def do_POST(self):
            if self.path == "/api/watch":
                if not self.authorized():
                    self.reply(401, b'{"error":"authentication required"}')
                    return
                origin = self.headers.get("Origin")
                if (self.headers.get("X-AKE-Control") != "1"
                        or self.headers.get_content_type() != "application/json"
                        or (origin and (urlsplit(origin).netloc != self.headers.get("Host")
                                        or urlsplit(origin).scheme != ("https" if tls else "http")))):
                    self.reply(403, b'{"error":"same-origin JSON control request required"}')
                    return
                try:
                    size = int(self.headers.get("Content-Length", "0"))
                    if not 1 <= size <= 1024:
                        raise ValueError("Invalid request size")
                    payload = json.loads(self.rfile.read(size))
                    if not isinstance(payload, dict) or set(payload) - {"action", "interval", "concurrency", "download_concurrency"}:
                        raise ValueError("Invalid control request")
                    worker.update_watch(payload.get("action"), payload.get("interval"), payload.get("concurrency"),
                                        payload.get("download_concurrency"))
                    self.reply(200, json.dumps(self.status_payload(), ensure_ascii=False).encode())
                except (ValueError, TypeError):
                    self.reply(400, b'{"error":"invalid action, interval (1-86400), concurrency (1-64), or task still running"}')
                except OSError:
                    self.reply(500, b'{"error":"could not persist watch settings"}')
                return
            if self.path != "/api/login":
                self.reply(404, b"{}")
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if size < 1 or size > 1024:
                    self.reply(400, b"{}")
                    return
                with mutex:
                    instant = time.monotonic()
                    expired = [ip for ip, (when, count) in attempts.items() if instant - when > 60]
                    for ip in expired:
                        del attempts[ip]
                    ip = self.client_address[0]
                    when, count = attempts.get(ip, (instant, 0))
                    if count >= 10 or len(attempts) > 1000:
                        self.reply(429, b"{}")
                        return
                    attempts[ip] = (when, count + 1)
                payload = json.loads(self.rfile.read(size))
                if not isinstance(payload, dict):
                    raise ValueError("Invalid login request")
                supplied = payload.get("token", "")
                if not isinstance(supplied, str) or not hmac.compare_digest(supplied, secret):
                    self.reply(401, b"{}")
                    return
                self.reply(200, b'{"ok":true}', cookie=f"ake_session={secret}; Path=/; HttpOnly; SameSite=Strict" + ("; Secure" if tls else ""))
            except (ValueError, OSError, TypeError):
                self.reply(400, b"{}")

    class Server(ThreadingHTTPServer):
        daemon_threads = True
        request_queue_size = 16
        slots = threading.BoundedSemaphore(16)

        def process_request(self, request, address):
            if not self.slots.acquire(blocking=False):
                self.shutdown_request(request)
                return
            try:
                super().process_request(request, address)
            except Exception:
                self.slots.release()
                raise

        def process_request_thread(self, request, address):
            try:
                super().process_request_thread(request, address)
            finally:
                self.slots.release()

    server = Server((config["status_host"], config["status_port"]), Handler)
    if tls:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(config["tls_cert"], config["tls_key"])
        # Handshake happens in request worker, with socket timeout, not on the accept loop.
        original_get = server.get_request

        def get_request():
            sock, address = original_get()
            sock.settimeout(10)
            return context.wrap_socket(sock, server_side=True, do_handshake_on_connect=False), address

        server.get_request = get_request
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server
