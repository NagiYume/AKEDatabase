from __future__ import annotations

import base64
import copy
import hashlib
import json
import re
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .common import now, read_json


class UploadReader:
    def __init__(self, stream, token, progress):
        self.stream, self.token, self.progress = stream, token, progress

    def read(self, size=-1):
        self.token.raise_if_cancelled()
        data = self.stream.read(size)
        self.progress(self.stream.tell())
        return data

    def __getattr__(self, name):
        return getattr(self.stream, name)


class Storage:
    def __init__(self, config, emit):
        auth = read_json(Path(config["credentials_file"]))
        endpoint = auth["endpoint"].rstrip("/")
        if not re.fullmatch(r"https://[a-z0-9.-]+\.r2\.cloudflarestorage\.com", endpoint):
            raise ValueError("Invalid R2 endpoint")
        self.bucket = config["bucket"]
        self.emit = emit
        self.upload_concurrency = config.get("upload_concurrency", 32)
        if type(self.upload_concurrency) is not int or not 1 <= self.upload_concurrency <= 64:
            raise ValueError("upload_concurrency must be an integer from 1 to 64")
        self.client = boto3.client(
            "s3", endpoint_url=endpoint, region_name="auto",
            aws_access_key_id=auth["access_key_id"],
            aws_secret_access_key=auth["secret_access_key"],
            config=Config(connect_timeout=10, read_timeout=60,
                          max_pool_connections=72,
                          retries={"max_attempts": 3, "mode": "standard"},
                          request_checksum_calculation="when_required",
                          response_checksum_validation="when_required"))

    def manifest(self):
        # Auth/network/404 errors must not be treated as an empty existing bucket.
        response = self.client.get_object(Bucket=self.bucket, Key="manifest.json")
        with response["Body"] as body:
            data = json.loads(body.read())
        if not isinstance(data, dict) or not isinstance(data.get("versions"), list):
            raise ValueError("Invalid remote manifest")
        return data, response["ETag"]

    def objects(self, prefix):
        self.check_prefix(prefix)
        output = {}
        for page in self.client.get_paginator("list_objects_v2").paginate(
                Bucket=self.bucket, Prefix=prefix):
            for item in page.get("Contents", []):
                output[item["Key"][len(prefix):]] = item
        return output

    @staticmethod
    def check_prefix(prefix):
        if not re.fullmatch(r"public/\d+\.\d+\.\d+/[0-9A-Za-z._-]+/TableCfg/", prefix):
            raise ValueError("Write outside TableCfg scope refused")

    def compare(self, plan):
        for item in plan["files"]:
            name = item["name"]
            relative = PurePosixPath(name)
            if (relative.is_absolute() or ".." in relative.parts or "\\" in name
                    or relative.as_posix() != name or relative.suffix != ".json"):
                raise ValueError("Unsafe TableCfg object path")
        objects = self.objects(plan["prefix"])
        expected = {item["name"]: item for item in plan["files"]}
        if not expected or len(expected) != len(plan["files"]):
            raise ValueError("Empty or duplicate TableCfg plan")
        if set(objects) - set(expected):
            raise ValueError("Remote version contains unexpected files; refusing overwrite")
        missing = []
        for name, item in expected.items():
            remote = objects.get(name)
            if remote is None:
                missing.append(name)
                continue
            if remote["Size"] != item["size"]:
                raise ValueError(f"Remote file size conflict: {name}")
            etag = remote["ETag"].strip('"')
            if etag == item["md5"]:
                continue
            # Multipart ETags are not MD5: stream and compare actual content.
            response = self.client.get_object(Bucket=self.bucket, Key=plan["prefix"] + name)
            checksum = hashlib.sha256()
            with response["Body"] as body:
                for chunk in iter(lambda: body.read(1024 * 1024), b""):
                    checksum.update(chunk)
            if checksum.hexdigest() != item["sha256"]:
                raise ValueError(f"Remote content conflict: {name}")
        return missing

    def publish(self, plan, root, token, replay_etags=None, checkpoint=None, skip_names=None):
        concurrency = self.upload_concurrency  # Snapshot for this batch; controls affect the next batch.
        self.check_prefix(plan["prefix"])
        missing = set(self.compare(plan))
        sent, uploaded, started = 0, 0, time.monotonic()
        total_bytes = sum(item["size"] for item in plan["files"])
        pending = [(index, item) for index, item in enumerate(plan["files"], 1)
                   if (item["name"] not in (skip_names or set()) if replay_etags is not None
                       else item["name"] in missing)]
        completed_count = len(plan["files"]) - len(pending)
        completed_bytes = total_bytes - sum(item["size"] for _, item in pending)
        iterator = iter(pending)
        mutex = threading.RLock()
        active = {}
        failures = []
        halted = threading.Event()

        def emit_progress(message, index, item, position):
            self.emit("upload", message, current=completed_count, total=len(plan["files"]),
                      progress_unit="files", file_name=item["name"], file_index=completed_count,
                      file_total=len(plan["files"]), file_bytes=position, file_size=item["size"],
                      bytes_current=completed_bytes + sum(v["bytes"] for v in active.values()), bytes_total=total_bytes,
                      upload_concurrency=concurrency,
                      active_files=[dict(value) for value in active.values()])

        def upload_loop():
            nonlocal sent, uploaded, completed_bytes, completed_count
            try:
                while not halted.is_set():
                    token.raise_if_cancelled()
                    with mutex:
                        task = next(iterator, None)
                    if task is None:
                        return
                    index, item = task
                    path = root / item["name"]
                    if path.is_symlink() or path.stat().st_size != item["size"]:
                        raise ValueError("Publish artifact changed")
                    def progress(position):
                        with mutex:
                            active[item["name"]] = {"name": item["name"], "index": index,
                                "bytes": min(position, item["size"]), "size": item["size"]}
                            emit_progress(f"并发上传 / Uploading ({completed_count}/{len(plan['files'])} completed)", index, item, position)
                    progress(0)
                    wrote = True
                    with path.open("rb") as stream:
                        try:
                            self.client.put_object(
                                Bucket=self.bucket, Key=plan["prefix"] + item["name"], Body=UploadReader(stream, token, progress),
                                ContentLength=item["size"], ContentType="application/json",
                                ContentMD5=base64.b64encode(bytes.fromhex(item["md5"])).decode(),
                                CacheControl="public, max-age=31536000, immutable",
                                **({"IfNoneMatch": "*"} if replay_etags is None
                                   else {"IfMatch": replay_etags[item["name"]]}))
                        except ClientError as exc:
                            if replay_etags is not None or exc.response["ResponseMetadata"]["HTTPStatusCode"] != 412:
                                raise
                            wrote = False
                    with mutex:
                        if wrote:
                            if checkpoint:
                                checkpoint(item["name"])
                            sent += item["size"]
                            uploaded += 1
                        active.pop(item["name"], None)
                        completed_bytes += item["size"]
                        completed_count += 1
                        emit_progress(f"上传完成 / Uploaded {item['name']} ({completed_count}/{len(plan['files'])})", index, item, item["size"])
            except Exception as exc:
                with mutex:
                    failures.append(exc)
                    halted.set()

        with ThreadPoolExecutor(max_workers=concurrency, thread_name_prefix="table-upload") as pool:
            futures = [pool.submit(upload_loop) for _ in range(concurrency)]
            for future in futures:
                future.result()
        if failures:
            raise failures[0]
        token.raise_if_cancelled()
        self.emit("verify_upload", "正在核对远端文件 / Verifying uploaded objects")
        if self.compare(plan):
            raise ValueError("Incomplete upload; manifest not committed")
        return {"upload_bytes": sent, "uploaded_files": uploaded,
                "upload_concurrency": concurrency,
                "upload_seconds": round(time.monotonic() - started, 3)}

    def commit(self, plan, token, replay=False):
        self.emit("commit", "正在提交版本清单 / Committing version manifest")
        # Compare-and-swap protects sharedRevision and concurrent manifest writers.
        for _ in range(4):
            token.raise_if_cancelled()
            previous, etag = self.manifest()
            existing = next((v for v in previous["versions"] if v.get("id") == plan["version"]), None)
            if existing:
                if existing.get("tableCfgPath") != plan["prefix"].rstrip("/"):
                    raise ValueError("Manifest path conflict")
                if not replay:
                    return  # Never regress latest to an already-published historical version.
            if replay and (not existing or previous.get("latest") != plan["version"]):
                raise ValueError("Replay requires the existing latest version")
            updated = copy.deepcopy(previous)
            game, hotfix = plan["version"].split("@", 1)
            record = {**(existing or {}), "id": plan["version"], "gameVersion": game,
                "hotfixVersion": hotfix, "tableCfgPath": plan["prefix"].rstrip("/"), "publishedAt": now()}
            if replay:
                updated["versions"] = [record if v.get("id") == plan["version"] else v
                                       for v in updated["versions"]]
            else:
                updated["versions"].insert(0, record)
            updated["latest"] = plan["version"]
            updated["updatedAt"] = now()
            token.raise_if_cancelled()
            try:
                self.client.put_object(Bucket=self.bucket, Key="manifest.json",
                    Body=(json.dumps(updated, ensure_ascii=False, indent=2) + "\n").encode(),
                    ContentType="application/json", CacheControl="no-cache, max-age=0", IfMatch=etag)
            except ClientError as exc:
                if exc.response["ResponseMetadata"]["HTTPStatusCode"] == 412:
                    continue
                raise
            verified, _ = self.manifest()
            if not any(v.get("id") == plan["version"] and
                       v.get("tableCfgPath") == plan["prefix"].rstrip("/") for v in verified["versions"]):
                raise ValueError("Manifest readback failed")
            self.emit("commit", "版本清单回读通过 / Manifest readback verified", current=1, total=1, progress_unit="steps")
            return
        raise ValueError("Manifest changed repeatedly; publication deferred")
