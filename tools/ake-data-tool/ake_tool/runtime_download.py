"""Resolve the Windows IL2CPP host files for a prepared Endfield Seed."""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit

from .downloader import DownloadManager
from .errors import AkeToolError, ValidationError
from .file_copy import assert_no_linked_files
from .json_host.export_json import REQUIRED_RUNTIME
from .models import CancellationToken, DownloadEntry, ProgressCallback, ProgressEvent, SeedInfo


_UNITY_RESOURCES = (
    "Endfield_Data/Resources/unity default resources",
    "Endfield_Data/Resources/unity_builtin_extra",
)
_MD5 = re.compile(r"[0-9a-f]{32}")


def _runtime_entries(data: bytes, manifest_md5: str, include_unity_resources: bool) -> list[DownloadEntry]:
    from cryptography.hazmat.primitives import padding
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    if manifest_md5 and hashlib.md5(data).hexdigest() != manifest_md5:
        raise ValidationError("鹰角 CDN 的 game_files 清单与启动器摘要不一致")

    # Endfield's launcher game_files format (also used by Starward's per-file repair).
    key = bytes.fromhex("C0F30E1CE763BBC21CC355A34303AC50399444BFF68C4A22AF398C0A166EE143")
    iv = bytes.fromhex("33467861192750649501937264608400")
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    unpadder = padding.PKCS7(128).unpadder()
    names = REQUIRED_RUNTIME + (_UNITY_RESOURCES if include_unity_resources else ())
    by_name = {name.casefold(): name for name in names}
    entries = {}
    try:
        plaintext = decryptor.update(data) + decryptor.finalize()
        plaintext = unpadder.update(plaintext) + unpadder.finalize()
        for line in plaintext.decode("utf-8-sig").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            remote_name = row["path"].replace("\\", "/")
            name = by_name.get(remote_name.casefold())
            if name is None:
                continue
            size = row["size"]
            md5 = row["md5"].lower()
            if name in entries or type(size) is not int or size <= 0 or not _MD5.fullmatch(md5):
                raise ValueError(f"无效或重复的文件记录：{name}")
            entries[name] = DownloadEntry(name, size, md5, quote(remote_name, safe="/"))
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise ValidationError(f"无法读取鹰角 CDN 的 game_files 清单：{exc}") from exc
    missing = [name for name in REQUIRED_RUNTIME if name not in entries]
    if missing:
        raise ValidationError(f"鹰角 CDN 的 game_files 清单缺少运行时文件：{', '.join(missing)}")
    return [entries[name] for name in names if name in entries]


def resolve_runtime(work_root: Path, seed: SeedInfo, downloader: DownloadManager,
                    token: CancellationToken, progress: ProgressCallback,
                    *, include_unity_resources: bool = False) -> Path:
    token.raise_if_cancelled()
    if (not re.fullmatch(r"\d+\.\d+", seed.game_version)
            or not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", seed.seed_version)):
        raise ValidationError(f"无效的运行时版本：{seed.game_version} / {seed.seed_version}")

    work_root = work_root.resolve()
    root = work_root / "il2cpp-host-runtime"
    game_root = root / seed.game_version
    candidates = [game_root / seed.seed_version, root / seed.seed_version]
    candidates.extend((game_root / "versions").glob(f"{seed.seed_version}-*"))
    complete = {path.resolve() for path in candidates if all(
        (path / name).is_file() and (path / name).stat().st_size > 0 for name in REQUIRED_RUNTIME
    )}
    if len(complete) == 1:
        return complete.pop()

    package_url = seed.package_path.rstrip("/")
    url = urlsplit(package_url)
    expected_suffix = f"/{seed.seed_version}_{seed.rand_str}/files"
    if (url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment
            or not seed.rand_str or not url.path.endswith(expected_suffix)):
        raise ValidationError(
            f"{seed.seed_version} 没有唯一的完整本地运行时，且缺少匹配的鹰角 CDN 文件包地址。"
            "请重新执行索引分析和 VFS 准备。"
        )
    manifest_md5 = seed.game_files_md5.lower()
    if manifest_md5 and not _MD5.fullmatch(manifest_md5):
        raise ValidationError(f"{seed.seed_version} 的启动器 game_files 摘要无效")
    if os.name != "nt" or sys.maxsize <= 2**32:
        raise ValidationError("IL2CPP 运行时解析需要 Windows x64 Python")

    import msvcrt

    package_id = hashlib.sha256(package_url.encode("utf-8")).hexdigest()[:16]
    runtime = game_root / "downloads" / f"{seed.seed_version}-{package_id}"
    if runtime.resolve() != runtime:
        raise ValidationError(f"运行时下载目录包含目录链接：{runtime}")
    runtime.mkdir(parents=True, exist_ok=True)
    assert_no_linked_files(runtime, "运行时下载目录")
    with (runtime / ".download.lock").open("a+b") as lock:
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise AkeToolError(f"{seed.seed_version} 的运行时正在由另一任务准备：{runtime}") from exc
        try:
            progress(ProgressEvent("download", f"准备 {seed.seed_version} IL2CPP 运行时，来源为鹰角 CDN"))
            manifest = runtime / "game_files"
            entries = None
            if manifest.is_file():
                try:
                    entries = _runtime_entries(manifest.read_bytes(), manifest_md5, include_unity_resources)
                except ValidationError:
                    manifest.unlink()
            if entries is None:
                downloader.download_entries(package_url, [DownloadEntry("game_files", md5=manifest_md5)],
                                            runtime, token, progress, verify_md5=True)
                entries = _runtime_entries(manifest.read_bytes(), manifest_md5, include_unity_resources)
            downloader.download_entries(package_url, entries, runtime, token, progress, verify_md5=True)
            token.raise_if_cancelled()
        finally:
            msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
    return runtime
