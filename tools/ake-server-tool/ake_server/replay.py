"""Explicit, scoped replay of an existing latest version; never used by the watcher."""
from __future__ import annotations

import argparse
import copy
import json
import signal
import time
from contextlib import ExitStack, contextmanager
from pathlib import Path

from .common import atomic_json, digest, identity, load_config, now, read_json, version
from .worker import Worker
from .vendor.errors import CancelledError


@contextmanager
def reporting(worker, target):
    worker.emit("check", "模拟任务开始，核对指定版本 / Checking replay version",
                task_status="running", official_version=target)
    try:
        yield
    except CancelledError:
        worker.emit("cancelled", "模拟任务已暂停 / Replay cancelled", task_status="cancelled")
        raise SystemExit(130)
    except Exception as exc:
        label = f"模拟失败 / Replay failed: {type(exc).__name__}"
        worker.emit("error", label, task_status="failed", error=label, healthy=False)
        raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["plan", "execute"])
    parser.add_argument("--config", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    base = Path(config["work_dir"]).resolve()
    settings = read_json(base / "watch-settings.json", {})
    config["upload_concurrency"] = settings.get("upload_concurrency", config.get("upload_concurrency", 32))
    config["download_concurrency"] = settings.get("download_concurrency", config.get("download_concurrency", 32))
    root = Path(args.directory).resolve()
    if root.parent != base / "replays":
        raise ValueError("Replay directory must be directly inside work_dir/replays")
    config["work_dir"] = str(root)
    config["progress_file"] = str(base / "replay-status.json")
    root.mkdir(parents=True, exist_ok=True)
    import fcntl
    with (root / "replay.lock").open("a") as lock, (base / "operation.lock").open("a") as operation, ExitStack() as stack:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(operation, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if read_json(base / "watch-settings.json", {}).get("enabled", True):
            raise ValueError("Pause the automatic watcher before replay")
        worker = Worker(config)
        stack.enter_context(reporting(worker, args.version))
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: worker.cancel())
        latest = worker.client.get_latest()
        if version(latest)[0] != args.version:
            raise ValueError("Official version differs from the explicitly requested replay")
        descriptor_path = root / "replay-plan.json"
        if args.command == "plan":
            if descriptor_path.exists():
                raise ValueError("Replay plan already exists; use execute to resume")
            manifest, etag = worker.storage.manifest()
            if manifest.get("latest") != args.version:
                raise ValueError("Replay target is not remote latest")
            atomic_json(root / "manifest-before.json", manifest)
            job, table, plan = worker.prepare(latest)
            if worker.storage.compare(plan):
                raise ValueError("Existing remote version is incomplete")
            objects = worker.storage.objects(plan["prefix"])
            descriptor = {"version": args.version, "identity": identity(latest),
                "bucket": config["bucket"], "sdk_sha256": worker.sdk_digest,
                "plan_path": str(job / "plan.json"), "plan_sha256": digest(job / "plan.json"),
                "manifest_etag": etag, "created_at": now(),
                "remote": {name: {"etag": obj["ETag"], "modified": obj["LastModified"].isoformat()}
                           for name, obj in objects.items()},
                "file_count": len(plan["files"]), "bytes": sum(v["size"] for v in plan["files"]),
                "delete_paths": [], "metrics": worker.snapshot()}
            atomic_json(descriptor_path, descriptor)
            worker.emit("prepared", "下载、解析及校验完成，重传计划已就绪 / Replay plan ready",
                        task_status="prepared", table_count=len(plan["files"]))
            print(json.dumps({k: descriptor[k] for k in ("version", "bucket", "file_count", "bytes", "delete_paths")}), flush=True)
            return
        descriptor = read_json(descriptor_path)
        if (descriptor["version"] != args.version or descriptor["identity"] != identity(latest)
                or descriptor["bucket"] != config["bucket"] or descriptor["sdk_sha256"] != worker.sdk_digest):
            raise ValueError("Replay authorization identity changed")
        plan_path = Path(descriptor["plan_path"]).resolve()
        if root not in plan_path.parents or digest(plan_path) != descriptor["plan_sha256"]:
            raise ValueError("Replay plan changed")
        plan = read_json(plan_path)
        table = plan_path.parent / "output" / "data" / "TableCfg"
        if worker.inventory(table) != plan["files"]:
            raise ValueError("Replay artifacts changed")
        manifest, etag = worker.storage.manifest()
        if etag != descriptor["manifest_etag"]:
            raise ValueError("Manifest changed since replay planning")
        completed_path = root / "uploaded.json"
        completed = read_json(completed_path, [])
        names = {item["name"] for item in plan["files"]}
        if (not isinstance(completed, list) or any(not isinstance(name, str) for name in completed)
                or not set(completed).issubset(names) or len(set(completed)) != len(completed)):
            raise ValueError("Invalid replay upload checkpoint")
        def checkpoint(name):
            completed.append(name)
            atomic_json(completed_path, completed)
        # publish compares the full remote inventory before honoring completed checkpoints.
        started = time.monotonic()
        metrics = worker.storage.publish(plan, table, worker.token,
            replay_etags={name: record["etag"] for name, record in descriptor["remote"].items()},
            checkpoint=checkpoint, skip_names=set(completed))
        if identity(worker.client.get_latest()) != identity(latest):
            raise ValueError("Official version changed before replay commit")
        worker.storage.commit(plan, worker.token, replay=True)
        after, _ = worker.storage.manifest()
        before = read_json(root / "manifest-before.json")
        def without_replay_timestamps(value):
            value = copy.deepcopy(value)
            value.pop("updatedAt", None)
            for item in value["versions"]:
                if item.get("id") == args.version:
                    item.pop("publishedAt", None)
            return value
        if without_replay_timestamps(before) != without_replay_timestamps(after):
            raise ValueError("Unexpected manifest change")
        objects = worker.storage.objects(plan["prefix"])
        rewritten = sum(obj["LastModified"].isoformat() != descriptor["remote"][name]["modified"]
                        for name, obj in objects.items())
        if rewritten != len(plan["files"]) or worker.storage.compare(plan):
            raise ValueError("Replay verification failed")
        report = {"version": args.version, "completed_at": now(), **metrics,
            "rewritten_objects": rewritten, "table_count": len(plan["files"]),
            "completed_uploads": len(completed),
            "total_seconds": round(time.monotonic() - started, 3),
            "latest": after["latest"], "version_entries": sum(v.get("id") == args.version for v in after["versions"]),
            "shared_revision_unchanged": before.get("sharedRevision") == after.get("sharedRevision"),
            "other_manifest_data_unchanged": True, "metrics": worker.snapshot()}
        atomic_json(root / "manifest-after.json", after)
        atomic_json(root / "replay-report.json", report)
        worker.emit("complete", "模拟重传完成，远端核验通过 / Replay completed and verified",
                    task_status="complete", table_count=len(plan["files"]), last_success_at=now(), **metrics)
        print(json.dumps({k:v for k,v in report.items() if k != "metrics"}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
