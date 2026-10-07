from __future__ import annotations

import hashlib
import os
import time
import threading
from concurrent.futures import ThreadPoolExecutor
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
        concurrency: int = 32,
    ) -> None:
        self.timeout = timeout
        self.retries = retries
        self.verify_md5 = verify_md5
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": "AKEDataTool/0.1"})
        if type(concurrency) is not int or not 1 <= concurrency <= 64:
            raise ValueError("下载并发数必须为 1–64 的整数")
        self.concurrency = concurrency
        self._local = threading.local()

    def _worker_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update(self.session.headers)
        session.cookies.update(self.session.cookies)
        session.auth = self.session.auth
        session.proxies.update(self.session.proxies)
        session.verify = self.session.verify
        session.cert = self.session.cert
        session.trust_env = self.session.trust_env
        return session

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
        results = [safe_target(destination, entry.name) for entry in entries]
        targets = set(results)
        if len(targets) != len(results) or any(
            path.with_suffix(path.suffix + ".part") in targets for path in results
        ):
            raise ValidationError("下载索引包含重复或冲突的目标路径")
        lock = threading.RLock()
        halted = threading.Event()
        pending = iter(enumerate(entries))
        active: dict[int, int] = {}
        completed_bytes = completed_files = 0
        last_emit = 0.0

        def report(index, current, message, done=False):
            nonlocal completed_bytes, completed_files, last_emit
            with lock:
                entry = entries[index]
                current = min(current, entry.size) if entry.size else current
                if done:
                    active.pop(index, None)
                    completed_bytes += current
                    completed_files += 1
                else:
                    active[index] = current
                stamp = time.monotonic()
                if not done and stamp - last_emit < 0.2:
                    return
                last_emit = stamp
                progress(ProgressEvent(
                    "download", f"[{completed_files}/{len(entries)}] {message}",
                    completed_bytes + sum(active.values()), total_bytes,
                    details={"completed_files": completed_files, "file_total": len(entries),
                             "file_name": entry.name, "file_bytes": current, "file_size": entry.size,
                             "download_concurrency": self.concurrency,
                             "active_files": [{"name": entries[i].name, "bytes": size,
                                               "size": entries[i].size} for i, size in active.items()]},
                ))

        def download_loop():
            session = self._worker_session()
            self._local.session = session
            try:
                while True:
                    with lock:
                        if halted.is_set():
                            return
                        item = next(pending, None)
                    if item is None:
                        return
                    index, entry = item
                    token.raise_if_cancelled()
                    target = results[index]
                    if self._is_complete(target, entry, token, skip_md5=(
                        not should_verify_md5 or (trusted_names is not None and entry.name in trusted_names)
                    )):
                        report(index, entry.size or target.stat().st_size, f"已存在并通过校验 {entry.name}", True)
                        continue
                    remote_name = entry.url_path or entry.name
                    url = f"{base_url.rstrip('/')}/{remote_name.lstrip('/')}"
                    target.parent.mkdir(parents=True, exist_ok=True)
                    self._download_one(url, target, entry, token,
                                       lambda current, message: report(index, current, message),
                                       verify_md5=should_verify_md5)
                    report(index, entry.size or target.stat().st_size, f"下载并校验完成 {entry.name}", True)
            except BaseException:
                halted.set()
                raise
            finally:
                session.close()
                del self._local.session

        with ThreadPoolExecutor(max_workers=min(self.concurrency, len(entries)),
                                thread_name_prefix="ake-download") as pool:
            futures = [pool.submit(download_loop) for _ in range(min(self.concurrency, len(entries)))]
            for future in futures:
                future.result()
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
                with getattr(self._local, "session", self.session).get(
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
