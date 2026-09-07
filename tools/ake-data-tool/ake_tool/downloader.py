from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from typing import Iterable

import requests

from .errors import AkeToolError, ValidationError
from .file_copy import is_linked_file
from .models import CancellationToken, DownloadEntry, ProgressCallback, ProgressEvent, null_progress


BLOCK_IDS = {
    "InitialAudio": "07A1BB91",
    "InitialBundle": "0CE8FA57",
    "BundleManifest": "1CDDBF1F",
    "InitialExtendData": "3C9D9D2D",
    "Audio": "24ED34CF",
    "Bundle": "7064D8E2",
    "DynamicStreaming": "23D53F5D",
    "TableCfg": "42A8FCA6",
    "Video": "55FC21C6",
    "IV": "A63D7E6A",
    "Streaming": "C3442D43",
    "Json": "775A31D1",
    "LuaScript": "19E3AE45",
    "IFixPatch": "DAFE52C9",
    "ExtendData": "D6E622F7",
    "AudioChinese": "E1E7D7CE",
    "AudioEnglish": "A31457D0",
    "AudioJapanese": "F668D4EE",
    "AudioKorean": "E9D31017",
}


def safe_target(root: Path, relative_name: str) -> Path:
    normalized = relative_name.replace("\\", "/").lstrip("/")
    target = (root / normalized).resolve()
    resolved_root = root.resolve()
    if target != resolved_root and resolved_root not in target.parents:
        raise ValidationError(f"索引包含不安全路径：{relative_name}")
    return target


def entries_for_blocks(index_data: dict, blocks: Iterable[str]) -> list[DownloadEntry]:
    block_ids: list[str] = []
    for block in blocks:
        block_id = BLOCK_IDS.get(block, block if block in BLOCK_IDS.values() else "")
        if not block_id:
            raise ValidationError(f"未知资源区块：{block}")
        block_ids.append(block_id)

    entries: list[DownloadEntry] = []
    for raw in index_data.get("files", []):
        name = str(raw.get("name", "")).replace("\\", "/")
        if not name or not any(f"/{block_id}/" in f"/{name}" for block_id in block_ids):
            continue
        entries.append(
            DownloadEntry(
                name=name,
                size=max(0, int(raw.get("size") or 0)),
                md5=str(raw.get("md5") or raw.get("hash") or "").lower(),
                url_path=str(raw.get("urlPath") or ""),
            )
        )
    return entries


class DownloadManager:
    def __init__(
        self,
        timeout: int = 60,
        retries: int = 3,
        verify_md5: bool = True,
        session: requests.Session | None = None,
    ) -> None:
        self.timeout = timeout
        self.retries = retries
        self.verify_md5 = verify_md5
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": "AKEDataTool/0.1"})

    @staticmethod
    def _md5(path: Path, token: CancellationToken) -> str:
        digest = hashlib.md5()
        with path.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                token.raise_if_cancelled()
                digest.update(chunk)
        return digest.hexdigest()

    def _is_complete(
        self,
        path: Path,
        entry: DownloadEntry,
        token: CancellationToken,
        skip_md5: bool = False,
    ) -> bool:
        if not path.is_file() or is_linked_file(path):
            return False
        if entry.size and path.stat().st_size != entry.size:
            return False
        if self.verify_md5 and entry.md5 and not skip_md5:
            return self._md5(path, token) == entry.md5
        return True

    def download_entries(
        self,
        base_url: str,
        entries: list[DownloadEntry],
        destination: Path,
        token: CancellationToken,
        progress: ProgressCallback = null_progress,
        trusted_names: set[str] | None = None,
        verify_md5: bool | None = None,
    ) -> list[Path]:
        if not entries:
            return []
        should_verify_md5 = self.verify_md5 if verify_md5 is None else verify_md5
        total_bytes = sum(entry.size for entry in entries)
        completed_bytes = 0
        results: list[Path] = []

        for file_index, entry in enumerate(entries, 1):
            token.raise_if_cancelled()
            target = safe_target(destination, entry.name)
            if self._is_complete(
                target,
                entry,
                token,
                skip_md5=(
                    not should_verify_md5
                    or (trusted_names is not None and entry.name in trusted_names)
                ),
            ):
                completed_bytes += entry.size
                progress(
                    ProgressEvent(
                        "download",
                        f"已存在并通过校验 [{file_index}/{len(entries)}] {entry.name}",
                        completed_bytes,
                        total_bytes,
                    )
                )
                results.append(target)
                continue

            remote_name = entry.url_path or entry.name
            url = f"{base_url.rstrip('/')}/{remote_name.lstrip('/')}"
            target.parent.mkdir(parents=True, exist_ok=True)
            self._download_one(
                url,
                target,
                entry,
                token,
                lambda current, message: progress(
                    ProgressEvent(
                        "download",
                        f"[{file_index}/{len(entries)}] {message}",
                        completed_bytes + current,
                        total_bytes,
                    )
                ),
                verify_md5=should_verify_md5,
            )
            completed_bytes += entry.size or target.stat().st_size
            results.append(target)
        return results

    def _download_one(
        self,
        url: str,
        target: Path,
        entry: DownloadEntry,
        token: CancellationToken,
        progress,
        verify_md5: bool,
    ) -> None:
        partial = target.with_suffix(target.suffix + ".part")
        last_error: Exception | None = None

        for attempt in range(1, self.retries + 1):
            token.raise_if_cancelled()
            if is_linked_file(partial):
                partial.unlink()
            offset = partial.stat().st_size if partial.exists() else 0
            if entry.size and offset > entry.size:
                partial.unlink()
                offset = 0
            headers = {"Range": f"bytes={offset}-"} if offset else {}
            try:
                with self.session.get(
                    url,
                    headers=headers,
                    stream=True,
                    timeout=(15, self.timeout),
                ) as response:
                    response.raise_for_status()
                    resumed = offset > 0 and response.status_code == 206
                    if offset and not resumed:
                        offset = 0
                    mode = "ab" if resumed else "wb"
                    progress(offset, f"下载 {entry.name}")
                    with partial.open(mode) as stream:
                        current = offset
                        for chunk in response.iter_content(chunk_size=256 * 1024):
                            token.raise_if_cancelled()
                            if not chunk:
                                continue
                            stream.write(chunk)
                            current += len(chunk)
                            progress(current, f"下载 {entry.name}")

                if entry.size and partial.stat().st_size != entry.size:
                    raise ValidationError(
                        f"文件大小不符：{entry.name}，期望 {entry.size}，实际 {partial.stat().st_size}"
                    )
                if verify_md5 and entry.md5:
                    progress(partial.stat().st_size, f"校验 {entry.name}")
                    actual_md5 = self._md5(partial, token)
                    if actual_md5 != entry.md5:
                        partial.unlink(missing_ok=True)
                        raise ValidationError(
                            f"MD5 不符：{entry.name}，期望 {entry.md5}，实际 {actual_md5}"
                        )
                os.replace(partial, target)
                return
            except (requests.RequestException, OSError, ValidationError) as exc:
                last_error = exc
                if attempt < self.retries:
                    progress(offset, f"失败，准备重试 {attempt}/{self.retries}：{entry.name}")
                    time.sleep(min(2**attempt, 5))

        raise AkeToolError(f"下载失败 {entry.name}：{last_error}") from last_error
