"""Manage AKEGF keys on the server's loopback interface."""

import argparse
import hmac
import json
import logging
import os
import re
import stat
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import registry


KEYS_PATH = "/admin/v1/keys"
KEY_PATH = re.compile(
    rf"/admin/v1/providers/(?P<provider>{registry.PROVIDER_ID.pattern})/"
    rf"(?P<kind>public-keys|private-keys)(?:/(?P<kid>{registry.KEY_ID.pattern}))?"
)
PRIVATE_PEM = re.compile(
    rb"-----BEGIN (RSA PRIVATE KEY|PRIVATE KEY)-----\r?\n"
    rb"(?:[A-Za-z0-9+/=]+\r?\n)+-----END \1-----\r?\n?"
)
MAX_PEM_BYTES = 16 * 1024


class RequestError(Exception):
    def __init__(self, status, code):
        self.status = status
        self.code = code


def inspect_private_key(pem):
    if not PRIVATE_PEM.fullmatch(pem):
        raise ValueError("Expected one unencrypted private PEM")

    def pkey(*args):
        return subprocess.run(
            ["openssl", "pkey", "-passin", "pass:", *args],
            input=pem, capture_output=True, check=True, timeout=10,
        ).stdout

    pkey("-check", "-noout")
    return registry.fingerprint(registry.parse_public_key(pkey("-pubout")))


def list_keys(public_root, private_root):
    with registry.registry_lock(public_root):
        public = [
            {field: entry[field] for field in ("provider", "kid", "alg", "status")}
            for entry in registry.key_entries(public_root)
        ]
        private = [
            {"provider": path.parent.name, "kid": path.stem, "alg": "PS256"}
            for path in sorted(private_root.glob("*/*.pem"))
            if registry.PROVIDER_ID.fullmatch(path.parent.name)
            and registry.KEY_ID.fullmatch(path.stem)
        ]
    return {"public_keys": public, "private_keys": private}


def add_key(public_root, private_root, provider, kind, pem):
    try:
        if kind == "public-keys":
            der = registry.parse_public_key(pem)
        else:
            kid = inspect_private_key(pem)
    except (ValueError, subprocess.CalledProcessError) as error:
        raise RequestError(400, "invalid_rsa_pem") from error

    if kind == "public-keys":
        entry = registry.register_key(public_root, provider, der)
        return {field: entry[field] for field in ("provider", "kid", "alg", "status")}

    directory = private_root / provider
    path = directory / f"{kid}.pem"
    with registry.registry_lock(public_root):
        directory.mkdir(mode=0o700, exist_ok=True)
        if not path.exists():
            registry.write_file(path, pem.decode("ascii"), mode=0o600)
    return {"provider": provider, "kid": kid, "alg": "PS256"}


def delete_key(public_root, private_root, provider, kind, kid):
    if kind == "public-keys":
        if not registry.revoke_key(public_root, provider, kid):
            raise RequestError(404, "key_not_found")
        return {"provider": provider, "kid": kid, "status": "revoked"}

    with registry.registry_lock(public_root):
        (private_root / provider / f"{kid}.pem").unlink(missing_ok=True)
    return {"provider": provider, "kid": kid, "status": "deleted"}


def make_handler(public_root, private_root, token):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(10)
            super().setup()

        def log_message(self, *_):
            pass

        def reply(self, status, result):
            body = json.dumps(result).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def read_pem(self):
            if self.headers.get_content_type() not in ("application/x-pem-file", "text/plain"):
                raise RequestError(415, "expected_pem")
            lengths = self.headers.get_all("Content-Length", [])
            if self.headers.get("Transfer-Encoding") is not None or len(lengths) != 1:
                raise RequestError(400, "invalid_content_length")
            if not re.fullmatch(r"[0-9]{1,10}", lengths[0]):
                raise RequestError(400, "invalid_content_length")
            size = int(lengths[0])
            if size > MAX_PEM_BYTES:
                raise RequestError(413, "pem_too_large")
            if size == 0:
                raise RequestError(400, "invalid_content_length")
            pem = self.rfile.read(size)
            if len(pem) != size:
                raise RequestError(400, "incomplete_pem")
            return pem

        def dispatch(self):
            headers = self.headers.get_all("Authorization", [])
            if len(headers) != 1:
                raise RequestError(401, "authentication_required")
            scheme, _, supplied = headers[0].partition(" ")
            if scheme.lower() != "bearer" or not hmac.compare_digest(supplied.encode("latin-1"), token):
                raise RequestError(401, "authentication_required")

            if self.path == KEYS_PATH and self.command == "GET":
                return list_keys(public_root, private_root)
            match = KEY_PATH.fullmatch(self.path)
            if not match:
                raise RequestError(404, "not_found")
            provider, kind, kid = match.group("provider", "kind", "kid")
            if self.command == "POST" and kid is None:
                return add_key(public_root, private_root, provider, kind, self.read_pem())
            if self.command == "DELETE" and kid is not None:
                return delete_key(public_root, private_root, provider, kind, kid)
            raise RequestError(405, "method_not_allowed")

        def handle_management(self):
            try:
                result = self.dispatch()
            except RequestError as error:
                self.reply(error.status, {"error": error.code})
            except registry.KeyConflict:
                self.reply(409, {"error": "public_key_conflict"})
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                logging.error("Key operation failed (%s)", type(error).__name__)
                self.reply(500, {"error": "key_operation_failed"})
            else:
                self.reply(200, result)

        do_GET = do_POST = do_DELETE = handle_management

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    credentials = Path(os.environ.get("CREDENTIALS_DIRECTORY", "/etc/ake-tablecfg"))
    parser.add_argument("--token-file", type=Path, default=credentials / "status-token")
    parser.add_argument("--public-root", type=Path, default=Path("/var/lib/akegf-verify"))
    parser.add_argument("--private-root", type=Path, default=Path("/var/lib/akegf-verify-private"))
    parser.add_argument("--port", type=int, default=8768)
    args = parser.parse_args()

    token = args.token_file.read_text().strip()
    if len(token) < 32:
        parser.error("Status access token too short")
    public_root = args.public_root.resolve()
    private_root = args.private_root.resolve()
    if private_root.is_relative_to(public_root) or public_root.is_relative_to(private_root):
        parser.error("Public and private roots must be separate")
    os.umask(0o022)
    private_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(private_root.stat().st_mode) != 0o700:
        parser.error("Private root must have mode 0700")

    handler = make_handler(public_root, private_root, token.encode("utf-8"))
    with HTTPServer(("127.0.0.1", args.port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
