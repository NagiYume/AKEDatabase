from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import threading
import time
from pathlib import Path

from .common import atomic_json, digest, identity, now, read_json, version
from .storage import Storage
from .vendor.downloader import DownloadManager, entries_for_blocks
from .vendor.hotfix_api import HotfixClient
from .vendor.models import CancellationToken


class Worker:
    def __init__(self, config):
        self.config = config
        self.root = Path(config["work_dir"])
        self.root.mkdir(parents=True, exist_ok=True)
        self.stop = threading.Event()
        self.token = CancellationToken()
        self.mutex = threading.Lock()
        self.control = threading.Condition()
        self.settings_file = self.root / "watch-settings.json"
        settings = read_json(self.settings_file, {"enabled": True, "interval": config["interval"]})
        if (not isinstance(settings, dict) or type(settings.get("enabled")) is not bool
                or type(settings.get("interval")) is not int or not 1 <= settings["interval"] <= 86400):
            raise ValueError("Invalid saved watch settings")
        self.enabled = settings["enabled"]
        self.config["interval"] = settings["interval"]
        for name in ("upload_concurrency", "download_concurrency"):
            concurrency = settings.get(name, config.get(name, 32))
            if type(concurrency) is not int or not 1 <= concurrency <= 64:
                raise ValueError(f"Invalid saved {name}")
            self.config[name] = concurrency
        self.active = False
        self.force_reconcile = True
        self.progress_file = Path(config["progress_file"]) if config.get("progress_file") else None
        self.progress_written = 0.0
        self.status = {"started_at": now(), "stage": "starting", "interval_seconds": config["interval"],
                       "upload_enabled": config["upload_enabled"], "events": [], "healthy": True,
                       "official_version": None, "remote_latest": None, "last_check_at": None,
                       "last_success_at": None, "table_count": None, "remote_missing_files": None, "error": None}
        self.client = HotfixClient(timeout=config["request_timeout"])
        self.storage = Storage(config, self.emit)
        self.sdk_digest = digest(Path(config["sdk"]))

    def emit(self, stage, message, **extra):
        with self.mutex:
            changed_stage = stage != self.status.get("stage")
            if changed_stage:
                for key in ("current", "total", "progress_unit", "file_name", "file_index", "file_total",
                            "file_bytes", "file_size", "bytes_current", "bytes_total", "active_files"):
                    self.status.pop(key, None)
            previous = self.status.get("message")
            self.status.update(stage=stage, message=message, updated_at=now(), **extra)
            if message != previous:
                self.status["events"].append({"at": now(), "stage": stage, "message": message})
                self.status["events"] = self.status["events"][-80:]
                print(json.dumps({"at": now(), "stage": stage, "message": message}, ensure_ascii=False), flush=True)
            if self.progress_file and (changed_stage or message != previous or time.monotonic() - self.progress_written >= 0.5):
                payload = {**self.status, "task_mode": "replay", "task_id": self.root.name,
                           "task_status": self.status.get("task_status", "running"), "process_id": os.getpid(),
                           "process_start": Path('/proc/self/stat').read_text().rsplit(')', 1)[1].split()[19]}
                atomic_json(self.progress_file, payload)
                self.progress_written = time.monotonic()

    def replay_status(self):
        if self.progress_file:
            return None
        try:
            value = read_json(self.root / "replay-status.json")
        except (OSError, ValueError):
            return {"task_mode": "replay", "task_status": "error", "message": "无法读取模拟状态 / Replay status unavailable"}
        if not isinstance(value, dict):
            return None
        if value.get("task_status") == "running":
            try:
                stat = Path(f"/proc/{int(value['process_id'])}/stat").read_text().rsplit(')', 1)[1].split()
                alive = stat[0] != "Z" and stat[19] == value.get("process_start")
            except (OSError, ValueError, KeyError):
                alive = False
            if not alive:
                value.update(task_status="interrupted", stage="interrupted", message="模拟进程已结束，未报告完成 / Replay interrupted")
        return value

    def snapshot(self):
        with self.mutex:
            result = json.loads(json.dumps(self.status))
        with self.control:
            result["watch_enabled"] = self.enabled
            result["watch_state"] = "running" if self.enabled else ("stopping" if self.active else "stopped")
            result["interval_seconds"] = self.config["interval"]
            result["configured_upload_concurrency"] = self.config["upload_concurrency"]
            result["configured_download_concurrency"] = self.config["download_concurrency"]
            if not self.enabled:
                result["stage"] = result["watch_state"]
                result["message"] = "Stopping automatic watch" if self.active else "Automatic watch stopped"
        result["server_time"] = now()
        result["task_mode"] = "replay" if self.progress_file else "automatic"
        external = self.replay_status()
        if external and (not result["watch_enabled"] or external.get("task_status") == "running"):
            for key in ("current", "total", "progress_unit", "file_name", "file_index", "file_total",
                        "file_bytes", "file_size", "bytes_current", "bytes_total", "active_files"):
                result.pop(key, None)
            for key in ("stage", "message", "events", "current", "total", "progress_unit", "file_name",
                        "file_index", "file_total", "file_bytes", "file_size", "bytes_current", "bytes_total",
                        "upload_concurrency", "download_concurrency", "active_files",
                        "task_mode", "task_id", "task_status", "updated_at", "error", "official_version",
                        "healthy", "table_count", "last_success_at", "download_bytes", "download_seconds", "extraction_seconds",
                        "upload_bytes", "uploaded_files", "upload_seconds"):
                if key in external:
                    result[key] = external[key]
        result["disk_free_bytes"] = shutil.disk_usage(self.root).free
        for name in ("memory.current", "memory.peak", "memory.max"):
            try:
                group = Path("/proc/self/cgroup").read_text().split("0::", 1)[1].strip()
                value = (Path("/sys/fs/cgroup") / group.lstrip("/") / name).read_text().strip()
                result[name.replace(".", "_")] = int(value) if value.isdigit() else value
            except (OSError, IndexError):
                pass
        return result

    def cancel(self):
        self.stop.set()
        self.token.cancel()
        with self.control:
            self.control.notify_all()

    def update_watch(self, action, interval=None, concurrency=None, download_concurrency=None):
        with self.control:
            if self.stop.is_set():
                raise ValueError("Service is shutting down")
            enabled = self.enabled
            next_interval = self.config["interval"]
            next_concurrency = self.config["upload_concurrency"]
            next_download = self.config["download_concurrency"]
            if action == "start":
                replay = self.replay_status()
                if replay and replay.get("task_status") == "running":
                    raise ValueError("A replay is running; wait for it to finish")
                if not self.enabled and self.active:
                    raise ValueError("Current operation is stopping; retry when stopped")
                enabled = True
            elif action == "stop":
                enabled = False
            elif action == "interval":
                if type(interval) is not int or not 1 <= interval <= 86400:
                    raise ValueError("Interval must be an integer from 1 to 86400 seconds")
                next_interval = interval
            elif action == "concurrency":
                if type(concurrency) is not int or not 1 <= concurrency <= 64:
                    raise ValueError("Concurrency must be an integer from 1 to 64")
                next_concurrency = concurrency
            elif action == "download_concurrency":
                if type(download_concurrency) is not int or not 1 <= download_concurrency <= 64:
                    raise ValueError("Download concurrency must be an integer from 1 to 64")
                next_download = download_concurrency
            else:
                raise ValueError("Unknown watch action")
            atomic_json(self.settings_file, {"enabled": enabled, "interval": next_interval,
                                             "upload_concurrency": next_concurrency,
                                             "download_concurrency": next_download})
            if enabled and not self.enabled:
                self.force_reconcile = True
            self.enabled = enabled
            self.config["interval"] = next_interval
            self.config["upload_concurrency"] = next_concurrency
            self.config["download_concurrency"] = next_download
            self.storage.upload_concurrency = next_concurrency
            if not enabled:
                self.token.cancel()
            self.control.notify_all()
        return self.snapshot()

    def progress(self, event):
        self.emit(event.stage, event.message, current=event.current, total=event.total)

    def prepare(self, latest):
        self.token.raise_if_cancelled()
        job = self.root / "jobs" / identity(latest)
        job.mkdir(parents=True, exist_ok=True)
        source = job / "source"
        plan_file = job / "plan.json"
        existing = read_json(plan_file)
        version_id, prefix = version(latest)
        if existing and (existing.get("identity") != identity(latest)
                         or existing.get("version") != version_id
                         or existing.get("prefix") != prefix
                         or existing.get("bucket") != self.config["bucket"]):
            raise ValueError("Saved publication plan identity mismatch")
        if existing and existing.get("sdk_sha256") == self.sdk_digest:
            table = job / "output" / "data" / "TableCfg"
            current = self.inventory(table)
            if current == existing["files"]:
                self.emit("validate", "Reusing validated TableCfg artifacts")
                return job, table, existing
        if shutil.disk_usage(self.root).free < self.config["minimum_free_bytes"]:
            raise ValueError("Insufficient disk reserve; retaining unfinished jobs")
        self.emit("download", "Downloading main/initial indexes (TableCfg only)")
        by_name = {}
        for part_name in ("main", "initial"):
            part = latest.hotfix.parts[part_name]
            _, index = self.client.download_index(part, job / "indexes")
            atomic_json(source / f"index_{part_name}.json",
                        {**index, "version": part.version, "isInitial": part_name == "initial"})
            for entry in entries_for_blocks(index, ["TableCfg"]):
                if not entry.md5 or entry.size <= 0:
                    raise ValueError("Missing TableCfg integrity metadata")
                by_name[entry.name] = (part, entry)
        if not by_name:
            raise ValueError("No TableCfg blocks in official indexes")
        size = sum(entry.size for _, entry in by_name.values())
        if shutil.disk_usage(self.root).free < size * 6 + self.config["minimum_free_bytes"]:
            raise ValueError("Insufficient space for TableCfg staging")
        started = time.monotonic()
        manager = DownloadManager(timeout=self.config["request_timeout"], retries=3,
                                  verify_md5=True, session=self.client.session,
                                  concurrency=self.config["download_concurrency"])
        for part_name in ("main", "initial"):
            part = latest.hotfix.parts[part_name]
            entries = [e for p, e in by_name.values() if p.name == part_name]
            part_offset = sum(e.size for p, e in by_name.values() if p.name == "main") if part_name == "initial" else 0
            file_offset = sum(1 for p, e in by_name.values() if p.name == "main") if part_name == "initial" else 0
            def download_progress(event):
                detail = event.details
                self.emit(event.stage, event.message, current=part_offset + event.current, total=size,
                          progress_unit="bytes", bytes_current=part_offset + event.current, bytes_total=size,
                          file_name=detail.get("file_name"), file_index=file_offset + detail.get("completed_files", 0),
                          file_total=len(by_name), file_bytes=detail.get("file_bytes", 0),
                          file_size=detail.get("file_size", 0), active_files=detail.get("active_files", []),
                          download_concurrency=manager.concurrency)
            manager.download_entries(part.path, entries, source, self.token, download_progress)
        self.emit("download", "TableCfg download verified", download_bytes=size,
                  download_seconds=round(time.monotonic() - started, 3))
        output = job / "output"
        if output.exists():
            if output.is_symlink() or job.resolve() not in output.resolve().parents:
                raise ValueError("Unsafe output path")
            shutil.rmtree(output)
        output.mkdir()
        command = [self.config["java"], *self.config["java_options"], "--class-path", self.config["sdk"],
                   str(Path(__file__).with_name("BeyondSdkTableRunner.java")),
                   str(source / "VFS"), str(output)]
        self.emit("unpack", "Running standalone TableCfg extractor under service memory limit")
        started = time.monotonic()
        chunks = {Path(entry.name).name for _, entry in by_name.values() if entry.name.endswith(".chk")}
        processed = set()
        last_progress = started
        idle_timeout = self.config.get("extraction_idle_timeout", 180)
        with (job / "sdk.log").open("w", encoding="utf-8") as log, (job / "sdk.log").open(encoding="utf-8", errors="replace") as tail:
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
            def consume_sdk_output():
                nonlocal last_progress
                for line in tail:
                    clean = re.sub(r"\x1b\[[0-9;]*m", "", line).strip()
                    if not clean:
                        continue
                    match = re.search(r"Dumped (\d+) file\(s\) from chunk (\S+)", clean)
                    if match and match.group(2) in chunks:
                        if match.group(2) not in processed:
                            last_progress = time.monotonic()
                        processed.add(match.group(2))
                        self.emit("unpack", f"正在解析数据块 / Parsing chunk {match.group(2)} ({len(processed)}/{len(chunks)})",
                                  current=len(processed), total=len(chunks), progress_unit="chunks",
                                  file_name=match.group(2), file_index=len(processed), file_total=len(chunks))
                    else:
                        self.emit("unpack", clean[:500])
            try:
                while process.poll() is None:
                    consume_sdk_output()
                    self.token.raise_if_cancelled()
                    if time.monotonic() - started > 1800:
                        raise TimeoutError("TableCfg extraction timed out")
                    if time.monotonic() - last_progress > idle_timeout:
                        raise TimeoutError(f"TableCfg extraction made no progress for {idle_timeout} seconds")
                    self.stop.wait(0.25)
                consume_sdk_output()
                if process.returncode:
                    raise RuntimeError(f"TableCfg extractor exited {process.returncode}; see job sdk.log")
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
        table = output / "data" / "TableCfg"
        files = self.inventory(table)
        version_id, prefix = version(latest)
        plan = {"schema_version": 1, "identity": identity(latest), "version": version_id,
                "prefix": prefix, "bucket": self.config["bucket"], "sdk_sha256": self.sdk_digest,
                "files": files, "delete_paths": [], "created_at": now()}
        atomic_json(plan_file, plan)
        self.emit("validate", "All TableCfg JSON files validated; publication plan saved",
                  table_count=len(files), table_bytes=sum(v["size"] for v in files),
                  extraction_seconds=round(time.monotonic() - started, 3))
        return job, table, plan

    def inventory(self, table):
        if not table.is_dir() or table.is_symlink():
            raise ValueError("TableCfg output missing")
        result = []
        paths = sorted(path for path in table.rglob("*") if path.is_file() or path.is_symlink())
        self.emit("validate", "开始逐表校验 / Validating all tables", current=0, total=len(paths), progress_unit="files")
        for index, path in enumerate(paths, 1):
            self.token.raise_if_cancelled()
            if path.is_symlink():
                raise ValueError("Linked TableCfg output refused")
            if not path.is_file():
                continue
            if path.suffix != ".json" or path.stat().st_nlink > 1:
                raise ValueError("Unexpected TableCfg output")
            self.emit("validate", f"正在校验 / Validating {path.name} ({index}/{len(paths)})",
                      current=index - 1, total=len(paths), progress_unit="files",
                      file_name=path.relative_to(table).as_posix(), file_index=index, file_total=len(paths))
            # Only one table object is materialized at a time.
            with path.open(encoding="utf-8") as stream:
                value = json.load(stream)
            if not isinstance(value, (dict, list)):
                raise ValueError("TableCfg root must be an object or array")
            del value
            md5, sha = hashlib.md5(), hashlib.sha256()
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    md5.update(chunk)
                    sha.update(chunk)
            result.append({"name": path.relative_to(table).as_posix(), "size": path.stat().st_size,
                           "md5": md5.hexdigest(), "sha256": sha.hexdigest()})
        names = {v["name"] for v in result}
        if not {"ItemTable.json", "CharacterTable.json", "EnemyTable.json"}.issubset(names):
            raise ValueError("Required TableCfg tables missing")
        self.emit("validate", "全表校验完成 / All tables validated", current=len(paths), total=len(paths), progress_unit="files")
        return result

    def cycle(self, force=False, publish=False, automatic=False):
        import fcntl
        with (self.root / "operation.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return self._cycle(force, publish, automatic)

    def _cycle(self, force=False, publish=False, automatic=False):
        self.token.raise_if_cancelled()
        started = time.monotonic()
        latest = self.client.get_latest()
        self.token.raise_if_cancelled()
        version_id, prefix = version(latest)
        self.emit("check", "Official version checked", official_version=version_id,
                  last_check_at=now(), check_seconds=round(time.monotonic() - started, 3))
        state_file = self.root / "completed.json"
        completed = read_json(state_file, {})  # Fail visibly on corrupt completion state.
        if not isinstance(completed, dict):
            raise ValueError("Invalid completion state")
        job = self.root / "jobs" / identity(latest)
        if (automatic and completed.get("identity") == identity(latest)
                and completed.get("version") == version_id
                and completed.get("sdk_sha256") == self.sdk_digest
                and not (job / "pending.json").exists()):
            # Starting/resuming reads metadata only; unchanged tables are not rescanned.
            if force:
                try:
                    manifest, _ = self.storage.manifest()
                    entry = next((v for v in manifest["versions"] if v.get("id") == version_id), None)
                    if not entry or entry.get("tableCfgPath") != prefix.rstrip("/"):
                        raise ValueError("Completed version missing or conflicting in remote manifest")
                except Exception:
                    self.force_reconcile = True
                    raise
                table_count = completed.get("table_count")
                if table_count is None:
                    saved_plan = read_json(job / "plan.json", {})
                    if isinstance(saved_plan, dict) and saved_plan.get("identity") == identity(latest):
                        table_count = len(saved_plan.get("files", []))
                self.emit("check", "Version unchanged; reusing completed TableCfg validation",
                          remote_latest=manifest.get("latest"),
                          last_success_at=completed.get("completed_at"),
                          table_count=table_count, remote_missing_files=0)
            return
        # A successfully reconciled identity no longer expires on a timer.
        cached = getattr(self, "remote_checked", None)
        if not force and cached == identity(latest):
            return
        manifest, _ = self.storage.manifest()
        self.token.raise_if_cancelled()
        entry = next((v for v in manifest["versions"] if v.get("id") == version_id), None)
        if entry and entry.get("tableCfgPath") != prefix.rstrip("/"):
            raise ValueError("Remote manifest TableCfg path mismatch")
        # First arrival on this server obtains a local inventory; do not trust a nonempty prefix.
        job, table, plan = self.prepare(latest)
        missing = self.storage.compare(plan)
        self.token.raise_if_cancelled()
        self.emit("reconcile", "Remote TableCfg reconciled", remote_latest=manifest.get("latest"),
                  remote_missing_files=len(missing), table_count=len(plan["files"]))
        if not publish:
            atomic_json(self.root / "validation-report.json", {"at": now(), "version": version_id,
                "missing_remote_files": len(missing), "manifest_has_version": bool(entry),
                "metrics": self.snapshot(), "plan": str(job / "plan.json")})
            if entry and not missing:
                self.remote_checked = identity(latest)
            return
        if missing or not entry:
            # Recheck official identity immediately before remote mutation/commit.
            if identity(self.client.get_latest()) != identity(latest):
                raise ValueError("Official version changed; restarting reconciliation")
            self.token.raise_if_cancelled()
            atomic_json(job / "pending.json", plan)
            metrics = self.storage.publish(plan, table, self.token)
            if identity(self.client.get_latest()) != identity(latest):
                raise ValueError("Official version changed; manifest commit deferred")
            self.storage.commit(plan, self.token)
            self.emit("published", "TableCfg published and manifest verified", **metrics)
        self.token.raise_if_cancelled()
        atomic_json(state_file, {"identity": identity(latest), "version": version_id,
            "sdk_sha256": self.sdk_digest, "completed_at": now(), "plan": str(job / "plan.json"),
            "table_count": len(plan["files"])})
        (job / "pending.json").unlink(missing_ok=True)
        self.remote_checked = identity(latest)
        self.emit("idle", "TableCfg is current", last_success_at=now(), healthy=True, error=None)
        self.cleanup(job)

    def cleanup(self, current):
        jobs = sorted((self.root / "jobs").iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in jobs[max(2, self.config.get("retain_jobs", 2)):]:
            if old == current or (old / "pending.json").exists():
                continue
            if old.is_dir() and not old.is_symlink() and old.resolve().parent == (self.root / "jobs").resolve():
                shutil.rmtree(old)

    def run(self):
        failures = 0
        while not self.stop.is_set():
            with self.control:
                while not self.enabled and not self.stop.is_set():
                    self.control.wait()
                if self.stop.is_set():
                    break
                self.token = CancellationToken()
                self.active = True
                force = self.force_reconcile
                self.force_reconcile = False
            try:
                self.cycle(force=force, publish=self.config["upload_enabled"], automatic=True)
                failures = 0
                self.emit("idle", "Waiting for next check", healthy=True, error=None)
            except Exception as exc:
                if self.stop.is_set():
                    break
                if self.token.is_cancelled:
                    failures = 0
                    self.emit("stopped", "Automatic watch stopped")
                else:
                    failures += 1
                    # Do not expose SDK/S3 exception details or credential-bearing URLs to browsers.
                    label = f"{type(exc).__name__}: operation failed"
                    if isinstance(exc, (ValueError, RuntimeError, TimeoutError)):
                        label = str(exc)[:240]
                    self.emit("error", label, healthy=False, error=label)
            finally:
                with self.control:
                    self.active = False
                    self.control.notify_all()
            atomic_json(self.root / "status.json", self.snapshot())
            with self.control:
                if self.enabled and not self.stop.is_set():
                    delay = self.config["interval"] if not failures else min(300, 5 * 2 ** min(failures, 6))
                    self.control.wait(delay)
