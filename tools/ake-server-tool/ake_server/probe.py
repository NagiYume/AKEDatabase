"""Explicit R2 transfer diagnostic; multipart upload is always aborted, never completed."""
from __future__ import annotations

import hashlib
import io
import time
from pathlib import Path

from .common import atomic_json, now, read_json


def probe(worker):
    report = read_json(worker.root / "validation-report.json")
    if not report:
        raise ValueError("Run validate before the transfer probe")
    plan = read_json(Path(report["plan"]))
    worker.storage.check_prefix(plan["prefix"])
    item = max(plan["files"], key=lambda item: item["size"])
    key = plan["prefix"] + item["name"]
    client, bucket = worker.storage.client, worker.config["bucket"]
    marker = worker.root / "probe-pending.json"
    pending = read_json(marker)
    if pending:
        # Recover only the exact multipart upload created by this diagnostic.
        if pending["bucket"] != bucket or pending["key"] != key:
            raise ValueError("Previous transfer probe requires cleanup before changing targets")
        client.abort_multipart_upload(Bucket=bucket, Key=key, UploadId=pending["upload_id"])
        marker.unlink()
    before = client.head_object(Bucket=bucket, Key=key)
    started = time.monotonic()
    response = client.get_object(Bucket=bucket, Key=key, IfMatch=before["ETag"])
    checksum, size = hashlib.sha256(), 0
    with response["Body"] as body:
        for chunk in iter(lambda: body.read(1024 * 1024), b""):
            checksum.update(chunk)
            size += len(chunk)
    elapsed_read = time.monotonic() - started
    if checksum.hexdigest() != item["sha256"]:
        raise ValueError("R2 read probe did not match validated TableCfg")
    table = Path(report["plan"]).parent / "output" / "data" / "TableCfg"
    with (table / item["name"]).open("rb") as stream:
        sample = stream.read(8 * 1024 * 1024)
    upload_id = client.create_multipart_upload(Bucket=bucket, Key=key, ContentType="application/json")["UploadId"]
    try:
        atomic_json(marker, {"bucket": bucket, "key": key, "upload_id": upload_id})
        started = time.monotonic()
        client.upload_part(Bucket=bucket, Key=key, UploadId=upload_id, PartNumber=1, Body=io.BytesIO(sample))
        elapsed_write = time.monotonic() - started
    finally:
        client.abort_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id)
        marker.unlink(missing_ok=True)
    after = client.head_object(Bucket=bucket, Key=key)
    if before["ETag"] != after["ETag"] or before["LastModified"] != after["LastModified"]:
        raise ValueError("Remote object changed during transfer probe")
    result = {"at": now(), "read_bytes": size, "read_seconds": round(elapsed_read, 3),
              "read_mib_per_second": round(size / elapsed_read / 1048576, 3),
              "write_bytes": len(sample), "write_seconds": round(elapsed_write, 3),
              "write_mib_per_second": round(len(sample) / elapsed_write / 1048576, 3),
              "multipart_aborted": True, "published_object_unchanged": True}
    atomic_json(worker.root / "transfer-report.json", result)
    return result
