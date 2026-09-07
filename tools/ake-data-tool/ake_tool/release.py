from __future__ import annotations

import json
import hashlib
import os
import re
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlsplit
from urllib.request import Request, urlopen

from .asset_maps import (
    ASSET_MAP_SCHEMA_VERSION,
    asset_map_filename,
    build_map_manifest_record,
    map_profile_key,
    sha256_file,
    tree_digest,
    validate_map_upload_version,
    validate_map_manifest,
)
from .config import AppConfig
from .errors import AkeToolError, CancelledError, ValidationError
from .asset_index import (
    index_digest,
    merge_asset_index,
    plan_dataset_changes,
    scan_selected_dataset,
    scan_dataset,
    validate_asset_index,
    validate_level_data_dialog_metadata,
)
from .hotfix_api import HotfixClient
from .image_config_cloud import PUBLIC_ASSET_INDEX_URL
from .image_paths import (
    IMAGE_PROFILE_STANDARD,
    ImageParsingConfig,
    ImagePathMatcher,
    normalize_image_profile,
)
from .models import CancellationToken, LatestInfo, ProgressCallback, ProgressEvent
from .public_http import public_download_headers


COMMON_RCLONE_ARGS = [
    "--s3-no-check-bucket",
    "--fast-list",
    "--checkers",
    "32",
    "--transfers",
    "16",
    "--stats",
    "10s",
]
R2_STORAGE_WARNING_BYTES = 10_000_000_000
ASSET_BATCH_MAX_FILES = 500
ASSET_BATCH_MAX_BYTES = 512 * 1024 * 1024
ASSET_UPLOAD_CONCURRENCIES = (8, 4, 2)
ASSET_UPLOAD_BACKOFFS = (15, 60, 180)
ASSET_PROBE_WORKERS = 32
ASSET_PROBE_REPEATS = 2
PUBLIC_IMAGE_BASE_URL = "https://data.akedata.wiki/public/images"
TOOL_ROOT = Path(__file__).resolve().parent.parent


def build_manifest(
    remote_manifest: dict[str, Any] | None,
    game_version: str,
    hotfix_version: str,
    published_at: str,
    publish_latest: bool = True,
) -> dict[str, Any]:
    previous = remote_manifest or {}
    version_id = f"{game_version}@{hotfix_version}"
    versions = [
        item
        for item in previous.get("versions", [])
        if isinstance(item, dict) and str(item.get("id", "")) != version_id
    ]
    versions.append(
        {
            "id": version_id,
            "gameVersion": game_version,
            "hotfixVersion": hotfix_version,
            "tableCfgPath": f"public/{game_version}/{hotfix_version}/TableCfg",
            "publishedAt": published_at,
        }
    )
    versions.sort(
        key=lambda item: (version_key(str(item.get("gameVersion", "0"))), str(item.get("publishedAt", ""))),
        reverse=True,
    )
    previous_latest = str(previous.get("latest", "")).strip()
    latest = version_id if publish_latest or not previous_latest else previous_latest
    return {
        "schemaVersion": 1,
        "latest": latest,
        "sharedRevision": str(previous.get("sharedRevision", hotfix_version)),
        "updatedAt": published_at,
        "versions": versions,
    }


def build_manifest_without_version(
    remote_manifest: dict[str, Any],
    version_id: str,
    updated_at: str,
) -> dict[str, Any]:
    versions = [
        dict(item)
        for item in remote_manifest.get("versions", [])
        if isinstance(item, dict) and str(item.get("id", "")).strip() != version_id
    ]
    if len(versions) == len(
        [item for item in remote_manifest.get("versions", []) if isinstance(item, dict)]
    ):
        raise ValidationError(f"R2 manifest.json 中不存在版本：{version_id}")

    remaining_ids = [str(item.get("id", "")).strip() for item in versions]
    previous_latest = str(remote_manifest.get("latest", "")).strip()
    latest = previous_latest if previous_latest in remaining_ids else (remaining_ids[0] if remaining_ids else "")
    manifest = dict(remote_manifest)
    manifest.update(
        {
            "schemaVersion": int(remote_manifest.get("schemaVersion", 1) or 1),
            "latest": latest,
            "updatedAt": updated_at,
            "versions": versions,
        }
    )
    return manifest


def version_key(value: str) -> tuple[int, ...]:
    try:
        return tuple(int(part) for part in value.split("."))
    except ValueError:
        return (0,)


def resolve_r2_versions(latest: LatestInfo) -> tuple[str, str]:
    query = parse_qs(urlsplit(latest.hotfix.request_url).query)
    game_version = str((query.get("version") or [""])[0]).strip()
    hotfix_version = latest.hotfix.parts["main"].version.strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", game_version):
        raise ValidationError(
            f"无法从云端热更新链接的 version 参数获取有效游戏版本：{latest.hotfix.request_url}"
        )
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", hotfix_version):
        raise ValidationError(f"云端 Hotfix main.version 格式无效：{hotfix_version}")
    return game_version, hotfix_version


class ReleaseManager:
    def __init__(
        self,
        config: AppConfig,
        token: CancellationToken,
        progress: ProgressCallback,
        client: HotfixClient | None = None,
        before_index_upload: Callable[[], None] | None = None,
    ) -> None:
        self.config = config
        self.token = token
        self.progress = progress
        self.client = client or HotfixClient(
            timeout=config.request_timeout,
            appcode=config.appcode,
        )
        self.before_index_upload = before_index_upload

    @property
    def repo_root(self) -> Path:
        return self.config.public_root.parent

    @property
    def remote_base(self) -> str:
        return f"{self.config.r2_remote}:{self.config.r2_bucket}"

    def list_r2_versions(self) -> dict[str, Any]:
        self.token.raise_if_cancelled()
        if not self.config.rclone.is_file():
            raise FileNotFoundError(f"rclone 不存在：{self.config.rclone}")
        manifest = self._read_remote_manifest()
        versions = manifest.get("versions", [])
        if not isinstance(versions, list):
            raise ValidationError("R2 manifest.json 的 versions 不是数组")
        return {
            "latest": str(manifest.get("latest", "")).strip(),
            "updatedAt": str(manifest.get("updatedAt", "")).strip(),
            "versions": [dict(item) for item in versions if isinstance(item, dict)],
        }

    @property
    def json_remote(self) -> str:
        return f"{self.remote_base}/public/Json"

    @property
    def image_remote(self) -> str:
        return f"{self.remote_base}/public/images"

    @property
    def asset_index_remote(self) -> str:
        return f"{self.remote_base}/asset-sync-index.json"

    @staticmethod
    def _asset_plan_digest(plan: dict[str, Any]) -> str:
        """Digest the immutable inputs which make an image transfer resumable."""
        parts: list[dict[str, Any]] = []
        for dataset in plan.get("datasets", []):
            if not isinstance(dataset, dict) or dataset.get("kind") != "images":
                continue
            current_files = dataset.get("current_files", {})
            for kind in ("upload_paths", "overwrite_paths"):
                for path in dataset.get(kind, []):
                    info = current_files.get(path)
                    if not isinstance(info, dict):
                        raise ValidationError(f"图片计划缺少本地文件记录：{path}")
                    parts.append(
                        {
                            "kind": kind,
                            "path": path,
                            "size": int(info.get("size", -1)),
                            "md5": str(info.get("md5", "")).lower(),
                        }
                    )
        payload = {
            "assetIndexRevision": plan.get("asset_index_revision"),
            "assetIndexDigest": plan.get("asset_index_digest"),
            "manualUpdate": plan.get("manual_update", False),
            "profile": plan.get("image_profile"),
            "configDigest": plan.get("image_config_digest"),
            "mapRunId": plan.get("image_map_run_id"),
            "mapDigest": plan.get("image_map_digest"),
            "mapEntries": plan.get("image_map_entries"),
            "deltaUploadEnabled": plan.get("image_delta_upload_enabled", False),
            "deltaMapDigest": plan.get("image_delta_map_digest", ""),
            "deltaMapEntries": plan.get("image_delta_map_entries", 0),
            "deltaExportPathsDigest": plan.get("image_delta_export_paths_digest", ""),
            "deltaExportFileCount": plan.get("image_delta_export_file_count", 0),
            "assetVersion": plan.get("asset_version"),
            "mapUploadVersion": plan.get("image_map_upload_version"),
            "files": parts,
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def _write_asset_pending(self, marker: Path, value: dict[str, Any]) -> None:
        marker.parent.mkdir(parents=True, exist_ok=True)
        temporary = marker.with_name(f".{marker.name}.{os.getpid()}.tmp")
        temporary.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary, marker)

    @staticmethod
    def _read_asset_pending(marker: Path) -> dict[str, Any] | None:
        if not marker.is_file():
            return None
        try:
            value = json.loads(marker.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValidationError(f"图片上传 pending 无效：{marker}") from exc
        if not isinstance(value, dict):
            raise ValidationError(f"图片上传 pending 根节点无效：{marker}")
        return value

    @staticmethod
    def _image_public_url(path: str) -> str:
        encoded = "/".join(quote(part, safe="") for part in path.split("/"))
        return f"{PUBLIC_IMAGE_BASE_URL}/{encoded}"

    @staticmethod
    def _header_int(headers: Any, name: str) -> int | None:
        value = headers.get(name)
        try:
            return int(str(value).strip()) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _probe_image_once(self, path: str) -> str:
        url = self._image_public_url(path)
        cache_buster = f"{time.time_ns()}-{os.getpid()}"
        request_url = f"{url}?asset-probe={cache_buster}"
        headers = public_download_headers("image/*")
        try:
            request = Request(request_url, method="HEAD", headers=headers)
            with urlopen(request, timeout=self.config.request_timeout) as response:
                status = int(getattr(response, "status", 200))
                length = self._header_int(response.headers, "Content-Length")
                if 200 <= status < 300 and length is not None:
                    return "exists" if length > 0 else "empty"
                if status not in {405, 501} and not (200 <= status < 300):
                    return "missing" if status in {404, 410} else "indeterminate"
        except HTTPError as exc:
            if exc.code in {404, 410}:
                return "missing"
            if exc.code not in {405, 501}:
                return "indeterminate"
        except (URLError, TimeoutError, OSError):
            return "indeterminate"

        # Some CDN routes do not implement HEAD or omit Content-Length. Read
        # at most one byte from a ranged response and close it immediately.
        cache_buster = f"{time.time_ns()}-{os.getpid()}"
        request_url = f"{url}?asset-probe={cache_buster}"
        get_headers = dict(headers)
        get_headers["Range"] = "bytes=0-0"
        try:
            request = Request(request_url, method="GET", headers=get_headers)
            with urlopen(request, timeout=self.config.request_timeout) as response:
                status = int(getattr(response, "status", 200))
                content_range = str(response.headers.get("Content-Range", ""))
                total: int | None = None
                if "/" in content_range:
                    try:
                        total = int(content_range.rsplit("/", 1)[1])
                    except ValueError:
                        total = None
                length = self._header_int(response.headers, "Content-Length")
                first = response.read(1)
                if status in {200, 206}:
                    if total is not None:
                        return "exists" if total > 0 else "empty"
                    if length is not None:
                        return "exists" if length > 0 else "empty"
                    return "exists" if first else "empty"
                if status in {404, 410}:
                    return "missing"
                return "indeterminate"
        except HTTPError as exc:
            if exc.code in {404, 410}:
                return "missing"
            return "indeterminate"
        except (URLError, TimeoutError, OSError):
            return "indeterminate"

    def _probe_image_path(self, path: str) -> str:
        results: list[str] = []
        for attempt in range(ASSET_PROBE_REPEATS):
            results.append(self._probe_image_once(path))
            if attempt + 1 < ASSET_PROBE_REPEATS:
                time.sleep(0.1)
        if "exists" in results:
            return "exists"
        if "indeterminate" in results:
            return "indeterminate"
        if all(result == "empty" for result in results):
            return "empty"
        return "missing"

    def _probe_image_paths(
        self,
        paths: list[str],
        label: str,
        raise_on_indeterminate: bool = True,
    ) -> dict[str, Any]:
        counts = {"exists": 0, "missing": 0, "empty": 0, "indeterminate": 0}
        statuses: dict[str, str] = {}
        if not paths:
            return {"counts": counts, "statuses": statuses}
        self.progress(ProgressEvent("asset_upload", f"正在探测 data 站图片对象：{len(paths)} 个"))
        with ThreadPoolExecutor(max_workers=ASSET_PROBE_WORKERS) as executor:
            futures = {executor.submit(self._probe_image_path, path): path for path in paths}
            for index, future in enumerate(as_completed(futures), 1):
                path = futures[future]
                status = future.result()
                statuses[path] = status
                counts[status] += 1
                if index == len(paths) or index % 250 == 0:
                    self.progress(
                        ProgressEvent(
                            "asset_upload",
                            f"{label}探测进度：{index}/{len(paths)}；"
                            f"已存在 {counts['exists']}、缺失 {counts['missing']}、"
                            f"空对象 {counts['empty']}、不确定 {counts['indeterminate']}",
                            index,
                            len(paths),
                        )
                    )
        if counts["indeterminate"] and raise_on_indeterminate:
            raise ValidationError(
                f"data 站图片存在性探测出现 {counts['indeterminate']} 个不确定结果，"
                "拒绝将其当作缺失"
            )
        return {"counts": counts, "statuses": statuses}

    def _read_public_asset_index(self) -> dict[str, Any]:
        last_error: Exception | None = None
        for attempt, delay in enumerate((0, 15, 60)):
            if delay:
                self.progress(
                    ProgressEvent(
                        "asset_compare",
                        f"data 站资产索引读取遇到瞬时网络错误，{delay} 秒后重试",
                    )
                )
                time.sleep(delay)
            url = f"{PUBLIC_ASSET_INDEX_URL}?t={time.time_ns()}"
            request = Request(
                url,
                headers=public_download_headers("application/json"),
            )
            try:
                with urlopen(request, timeout=self.config.request_timeout) as response:
                    status = int(getattr(response, "status", 200))
                    if status < 200 or status >= 300:
                        raise HTTPError(url, status, "HTTP 状态失败", None, None)
                    payload = json.loads(response.read().decode("utf-8-sig"))
                return validate_asset_index(payload, allow_v1=True)
            except HTTPError as exc:
                if exc.code not in {408, 429} and not 500 <= exc.code <= 599:
                    raise ValidationError(f"data 站 asset-sync-index.json 读取失败：{exc}") from exc
                last_error = exc
            except (URLError, TimeoutError, OSError) as exc:
                last_error = exc
            except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
                if isinstance(exc, ValidationError):
                    raise
                raise ValidationError("data 站 asset-sync-index.json 不是有效 JSON") from exc
        raise ValidationError(f"data 站 asset-sync-index.json 读取失败：{last_error}") from last_error

    def _upload_remote_asset_index(self, value: dict[str, Any]) -> None:
        clean = validate_asset_index(value, allow_v1=False)
        temporary: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".json", prefix="ake-asset-index-", delete=False) as stream:
                json.dump(clean, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                temporary = Path(stream.name)
            self._stream_rclone(
                [
                    "copyto",
                    str(temporary),
                    self.asset_index_remote,
                    *COMMON_RCLONE_ARGS,
                    "--no-check-dest",
                    "--header-upload",
                    "Cache-Control: no-cache, max-age=0",
                ],
                "asset_upload",
            )
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def _read_remote_asset_index_exact(self) -> dict[str, Any]:
        result = self._capture_rclone_result(
            ["cat", self.asset_index_remote, "--s3-no-check-bucket"]
        )
        if result.returncode != 0:
            raise AkeToolError(
                (result.stderr or "").strip()
                or f"回读 asset-sync-index.json 失败，退出码 {result.returncode}"
            )
        try:
            return validate_asset_index(json.loads(result.stdout), allow_v1=False)
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError("回读的 R2 asset-sync-index.json 不是有效 JSON") from exc

    @property
    def map_remote_base(self) -> str:
        return f"{self.remote_base}/map"

    @property
    def map_manifest_remote(self) -> str:
        return f"{self.map_remote_base}/manifest.json"

    def _read_remote_map_manifest(self) -> dict[str, Any] | None:
        result = self._capture_rclone_result(
            ["cat", self.map_manifest_remote, "--s3-no-check-bucket"]
        )
        if result.returncode != 0:
            error = (result.stderr or "").strip().lower()
            missing_markers = (
                "not found",
                "object not found",
                "directory not found",
                "failed to open source object",
            )
            if any(marker in error for marker in missing_markers):
                return None
            raise AkeToolError(
                (result.stderr or "").strip()
                or f"读取 Asset map manifest 失败，退出码 {result.returncode}"
            )
        if not (result.stdout or "").strip():
            raise ValidationError("R2 map/manifest.json 为空，不允许 bootstrap")
        try:
            return validate_map_manifest(json.loads(result.stdout))
        except json.JSONDecodeError as exc:
            raise ValidationError("R2 map/manifest.json 不是有效 JSON") from exc

    def _upload_remote_map_manifest(self, value: dict[str, Any]) -> None:
        clean = validate_map_manifest(value)
        temporary: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                suffix=".json",
                prefix="ake-map-manifest-",
                delete=False,
            ) as stream:
                json.dump(clean, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                temporary = Path(stream.name)
            self._stream_rclone(
                [
                    "copyto",
                    str(temporary),
                    self.map_manifest_remote,
                    *COMMON_RCLONE_ARGS,
                    "--no-check-dest",
                    "--header-upload",
                    "Cache-Control: no-cache, max-age=0",
                ],
                "asset_upload",
            )
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def _read_remote_map_manifest_exact(self) -> dict[str, Any]:
        result = self._capture_rclone_result(
            ["cat", self.map_manifest_remote, "--s3-no-check-bucket"]
        )
        if result.returncode != 0:
            raise AkeToolError(
                (result.stderr or "").strip()
                or f"回读 Asset map manifest 失败，退出码 {result.returncode}"
            )
        try:
            return validate_map_manifest(json.loads(result.stdout))
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError("回读的 R2 map/manifest.json 不是有效 JSON") from exc

    def _mark_image_map_committed(
        self,
        profile: str,
        run_id: str,
        version: str,
        filename: str,
        digest: str,
    ) -> None:
        state_path = self.config.image_work_root / "image-state.json"
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValidationError("Asset map 已提交，但无法更新图片状态") from exc
        profiles = state.get("profiles")
        record = profiles.get(profile) if isinstance(profiles, dict) else None
        if not isinstance(record, dict) or str(record.get("runId", "")) != run_id:
            raise ValidationError("Asset map 已提交，但图片运行状态已变化")
        if str(record.get("pendingMapDigest", "")) != digest:
            raise ValidationError("Asset map 已提交，但待提交 map 摘要已变化")
        record.update(
            {
                "mapCommitted": True,
                "mapCommittedAt": datetime.now(timezone.utc).isoformat(),
                "mapCommittedVersion": version,
                "mapCommittedFile": filename,
                "invalidReason": "当前图片 map 已提交，请重新解析后再上传",
            }
        )
        temporary = state_path.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(state, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(state_path)

    def _commit_image_asset_map(
        self,
        profile: str,
        record: dict[str, Any] | None,
        map_upload_version: str = "",
    ) -> dict[str, Any]:
        if not isinstance(record, dict):
            raise ValidationError("图片资产同步缺少待提交完整 map 状态")
        profile = normalize_image_profile(profile)
        pending_map = Path(str(record.get("pendingMapPath", ""))).resolve()
        digest = str(record.get("pendingMapDigest", ""))
        if not pending_map.is_file() or sha256_file(pending_map) != digest:
            raise ValidationError("待提交完整 map 缺失或摘要变化")
        version = (
            validate_map_upload_version(map_upload_version)
            if map_upload_version
            else str(record.get("assetVersion", ""))
        )
        filename = asset_map_filename(profile, version)
        entry_count = int(record.get("fullMapEntries", -1))
        if entry_count < 0:
            raise ValidationError("待提交完整 map 条目数无效")
        self.progress(
            ProgressEvent(
                "asset_upload",
                f"图片资产与索引已就绪，开始提交 {map_profile_key(profile)} Asset map：{filename}",
            )
        )
        manifest = self._read_remote_map_manifest()
        if manifest is None:
            manifest = {"schemaVersion": ASSET_MAP_SCHEMA_VERSION, "profiles": {}}
        existing = manifest["profiles"].get(map_profile_key(profile))
        if (
            isinstance(existing, dict)
            and existing.get("version") == version
            and existing.get("sha256") != digest
        ):
            raise ValidationError("R2 同版本 Asset map 已存在但摘要不同，拒绝覆盖")

        remote_map = f"{self.map_remote_base}/{filename}"
        self._stream_rclone(
            [
                "copyto",
                str(pending_map),
                remote_map,
                *COMMON_RCLONE_ARGS,
                "--no-check-dest",
                "--header-upload",
                "Cache-Control: public, max-age=31536000, immutable",
            ],
            "asset_upload",
        )
        next_manifest = deepcopy(manifest)
        next_manifest["profiles"][map_profile_key(profile)] = build_map_manifest_record(
            profile,
            version,
            pending_map,
            entry_count,
        )
        next_manifest = validate_map_manifest(next_manifest)
        self._upload_remote_map_manifest(next_manifest)
        verified_manifest = self._read_remote_map_manifest_exact()
        verified = verified_manifest["profiles"].get(map_profile_key(profile))
        expected = next_manifest["profiles"].get(map_profile_key(profile))
        if verified != expected:
            raise ValidationError("回读的 Asset map manifest 与提交内容不一致")
        self._mark_image_map_committed(
            profile,
            str(record.get("runId", "")),
            version,
            filename,
            digest,
        )
        self.progress(
            ProgressEvent(
                "asset_upload",
                f"Asset map 与 manifest 已提交：{filename}，条目 {entry_count}",
            )
        )
        return {
            "imageMapCommitted": True,
            "imageMapProfile": profile,
            "imageMapFile": filename,
            "imageMapDigest": digest,
            "imageMapEntries": entry_count,
        }

    def _official_asset_version(self) -> tuple[str, str, str]:
        self.token.raise_if_cancelled()
        try:
            latest = self.client.get_latest()
            game_version, hotfix_version = resolve_r2_versions(latest)
        except Exception as exc:
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError(f"官方版本 API 读取失败，拒绝资产同步：{exc}") from exc
        return game_version, hotfix_version, f"{game_version}@{hotfix_version}"

    def _require_image_publish_eligibility(
        self,
        profile: str,
        config: ImageParsingConfig,
        asset_version: str | None = None,
        verify_artifacts: bool = True,
    ) -> dict[str, Any]:
        profile = normalize_image_profile(profile)
        state_path = self.config.image_work_root / "image-state.json"
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValidationError("图片发布资格失效：缺少有效的 image-state.json") from exc
        profiles = state.get("profiles") if isinstance(state, dict) else None
        record = profiles.get(profile) if isinstance(profiles, dict) else None
        if not isinstance(record, dict) or not record.get("published"):
            raise ValidationError(f"图片发布资格失效：{profile} 尚未完成解析并发布")
        if record.get("mapCommitted"):
            raise ValidationError(f"图片发布资格失效：{profile} 的当前 map 已完成提交")
        if str(record.get("configDigest", "")) != config.digest():
            raise ValidationError(f"图片发布资格失效：{profile} 当前配置与最后发布配置不一致")
        record_asset_version = str(record.get("assetVersion", ""))
        if not re.fullmatch(
            r"\d+\.\d+\.\d+@[A-Za-z0-9][A-Za-z0-9._-]*",
            record_asset_version,
        ):
            raise ValidationError(
                f"图片发布资格失效：{profile} 的正式资产版本记录无效"
            )
        if asset_version is not None and record_asset_version != asset_version:
            raise ValidationError(
                f"版本变化：{profile} 最后发布版本为 {record.get('assetVersion', '未知')}，"
                f"官方最新版本为 {asset_version}，请重新解析并发布"
            )
        if record.get("completedSteps") != [
            "image_analyze",
            "image_prepare",
            "image_extract",
            "image_publish",
        ]:
            raise ValidationError(f"图片发布资格失效：{profile} 的步骤状态不完整")
        if verify_artifacts:
            for path_key, digest_key, label in (
                ("fullMapPath", "fullMapDigest", "完整 map"),
                ("deltaMapPath", "deltaMapDigest", "增量 map"),
                ("pendingMapPath", "pendingMapDigest", "待提交完整 map"),
            ):
                map_path = Path(str(record.get(path_key, "")))
                if not map_path.is_file():
                    raise ValidationError(f"图片发布资格失效：{profile} 的{label}不存在")
                if sha256_file(map_path) != str(record.get(digest_key, "")):
                    raise ValidationError(f"图片发布资格失效：{profile} 的{label} 摘要变化")
            if (
                not self.config.image_sdk.is_file()
                or sha256_file(self.config.image_sdk) != str(record.get("jarDigest", ""))
            ):
                raise ValidationError(f"图片发布资格失效：{profile} 的 beyond-sdk.jar 已变化")
            output_root = Path(str(record.get("outputRoot", "")))
            if tree_digest(output_root) != str(record.get("outputDigest", "")):
                raise ValidationError(f"图片发布资格失效：{profile} 的持久增量输出已变化")
        if int(record.get("fullMapEntries", -1)) < 0:
            raise ValidationError(f"图片发布资格失效：{profile} 的完整 map 计数无效")
        return record

    @staticmethod
    def _asset_versions_from_image_record(
        record: dict[str, Any],
    ) -> tuple[str, str, str]:
        asset_version = str(record.get("assetVersion", "")).strip()
        if not re.fullmatch(
            r"\d+\.\d+\.\d+@[A-Za-z0-9][A-Za-z0-9._-]*",
            asset_version,
        ):
            raise ValidationError("图片发布状态中的正式资产版本无效")
        game_version, hotfix_version = asset_version.split("@", 1)
        return game_version, hotfix_version, asset_version

    def sync_image_parsing_config(
        self,
        profile: str,
        config: ImageParsingConfig,
    ) -> dict[str, Any]:
        profile = normalize_image_profile(profile)
        config = ImageParsingConfig.from_dict(config.to_dict())
        self.progress(ProgressEvent("image_config_sync", "正在读取 data 站最新资产索引…"))
        remote = self._read_public_asset_index()
        before_digest = self._asset_index_digest(remote)
        now = datetime.now(timezone.utc).isoformat()
        next_index = deepcopy(remote)
        configs = next_index.get("imageParsingConfigs")
        if not isinstance(configs, dict):
            configs = {"schemaVersion": 1}
        else:
            configs = deepcopy(configs)
            configs["schemaVersion"] = 1
        profile_value = config.to_dict(include_updated_at=False)
        profile_value["updatedAt"] = now
        configs[profile] = profile_value
        next_index["imageParsingConfigs"] = configs
        next_index["revision"] = now
        next_index["updatedAt"] = now
        next_index = validate_asset_index(next_index, allow_v1=False)
        if self.before_index_upload is not None:
            self.before_index_upload()
        latest = self._read_public_asset_index()
        if self._asset_index_digest(latest) != before_digest:
            raise ValidationError("远端并发修改：读取配置后资产索引已变化，请重新同步")
        self._upload_remote_asset_index(next_index)
        after_counts = {
            kind: len(dataset.get("files", {}))
            for kind, dataset in next_index["datasets"].items()
        }
        return {
            "profile": profile,
            "updatedAt": now,
            "configDigest": config.digest(),
            "assetIndexDigest": self._asset_index_digest(next_index),
            "fileCounts": after_counts,
        }

    @staticmethod
    def _asset_index_digest(value: dict[str, Any]) -> str:
        return index_digest(value)

    def _asset_specs(self, include_json: bool, include_images: bool) -> list[dict[str, Any]]:
        specs: list[dict[str, Any]] = []
        if include_images:
            specs.append(
                {
                    "kind": "images",
                    "label": "图片",
                    "source": self.config.public_root / "images",
                    "remote": self.image_remote,
                }
            )
        if include_json:
            specs.append(
                {
                    "kind": "json",
                    "label": "Json",
                    "source": self.config.public_root / "Json",
                    "remote": self.json_remote,
                }
            )
        if not specs:
            raise ValidationError("请至少选择图片或 Json 资产")
        return specs

    @staticmethod
    def _delta_export_paths_digest(paths: list[str]) -> str:
        payload = json.dumps(sorted(set(paths)), ensure_ascii=False, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _image_delta_export_paths(self, record: dict[str, Any]) -> list[str]:
        raw_paths = record.get("deltaExportPaths")
        if not isinstance(raw_paths, list):
            raise ValidationError(
                "图片状态缺少 deltaExportPaths，请重新执行图片解析和图片发布"
            )
        if any(not isinstance(path, str) for path in raw_paths):
            raise ValidationError("图片状态中的差分导出路径列表无效")
        paths = self._validate_relative_path_list(raw_paths, "差分导出")
        if any(not path.startswith("assets/") for path in paths):
            raise ValidationError("图片状态中的差分导出路径必须位于 assets 根目录")
        paths = sorted(set(paths))
        try:
            file_count = int(record.get("deltaExportFileCount", -1))
        except (TypeError, ValueError) as exc:
            raise ValidationError("图片状态中的差分导出文件数量无效") from exc
        if file_count != len(paths):
            raise ValidationError("图片状态中的差分导出文件数量与路径列表不一致")
        if str(record.get("deltaExportPathsDigest", "")) != self._delta_export_paths_digest(paths):
            raise ValidationError("图片状态中的差分导出路径摘要不一致")
        try:
            delta_map_entries = int(record.get("deltaMapEntries", 0) or 0)
        except (TypeError, ValueError) as exc:
            raise ValidationError("图片状态中的差分 Map 条目数无效") from exc
        if delta_map_entries > 0 and not paths:
            raise ValidationError(
                "差分 Map 非空但没有导出图片，请重新执行图片解析和图片发布"
            )
        return paths

    @staticmethod
    def _asset_index_storage(asset_index: dict[str, Any]) -> dict[str, int]:
        total_bytes = 0
        total_files = 0
        datasets = asset_index.get("datasets")
        if not isinstance(datasets, dict):
            raise ValidationError("asset-sync-index.json 缺少 datasets，无法汇总资产大小")
        for dataset in datasets.values():
            files = dataset.get("files") if isinstance(dataset, dict) else None
            if not isinstance(files, dict):
                raise ValidationError("asset-sync-index.json 数据集缺少 files，无法汇总资产大小")
            for record in files.values():
                if not isinstance(record, dict):
                    raise ValidationError("asset-sync-index.json 文件记录无效")
                total_bytes += max(0, int(record.get("size", 0) or 0))
                total_files += 1
        return {"bytes": total_bytes, "count": total_files}

    def _storage_projection(
        self,
        datasets: list[dict[str, Any]],
        asset_index: dict[str, Any],
    ) -> dict[str, Any]:
        total = self._asset_index_storage(asset_index)
        running_bytes = total["bytes"]
        peak_bytes = running_bytes
        for dataset in datasets:
            running_bytes = max(0, running_bytes + int(dataset.get("byte_delta", 0)))
            peak_bytes = max(peak_bytes, running_bytes)
        warning = (
            f"提醒：索引记录资产预计峰值 {peak_bytes / 1_000_000_000:.2f} GB，"
            "超过 10 GB 提醒线；本工具不会阻止上传"
            if peak_bytes > R2_STORAGE_WARNING_BYTES
            else ""
        )
        return {
            "remote_total_bytes": total["bytes"],
            "remote_total_files": total["count"],
            "projected_total_bytes": running_bytes,
            "peak_projected_total_bytes": peak_bytes,
            "storage_warning_bytes": R2_STORAGE_WARNING_BYTES,
            "storage_warning": warning,
            "storage_source": "asset-sync-index.json",
        }

    def plan_asset_sync(
        self,
        include_json: bool,
        include_images: bool,
        local_compare: bool = False,
        image_profile: str | None = None,
        image_config: ImageParsingConfig | None = None,
        manual_update: bool = False,
    ) -> dict[str, Any]:
        self.token.raise_if_cancelled()
        manual_update = bool(manual_update)
        if not manual_update and not self.config.rclone.is_file():
            raise FileNotFoundError(f"rclone 不存在：{self.config.rclone}")
        if manual_update:
            include_json = True
            include_images = True
        specs = self._asset_specs(include_json, include_images)
        if local_compare:
            raise ValidationError("本地差异比对已停用；资产比较必须读取 data 站最新索引")
        self.progress(
            ProgressEvent(
                "asset_compare",
                "正在从 data.akedata.wiki 读取最新资产索引…",
            )
        )
        remote_index = self._read_public_asset_index()
        remote_digest = self._asset_index_digest(remote_index)
        selected_profile = ""
        selected_config: ImageParsingConfig | None = None
        selected_map_record: dict[str, Any] | None = None
        map_upload_version = ""
        matcher: ImagePathMatcher | None = None
        image_delta_upload_enabled = bool(
            include_images
            and self.config.asset_upload_from_delta_map
            and not manual_update
        )
        image_delta_export_paths: list[str] = []
        if manual_update:
            self.progress(
                ProgressEvent(
                    "asset_compare",
                    "手动更新模式：按远端索引全量比较图片和 Json",
                )
            )
            game_version = ""
            hotfix_version = ""
            asset_version = datetime.now(timezone.utc).strftime("manual@%Y%m%d%H%M%S")
        elif include_images:
            selected_profile = normalize_image_profile(image_profile or IMAGE_PROFILE_STANDARD)
            if image_config is None:
                raise ValidationError("图片资产比较缺少本次会话实际生效的配置")
            selected_config = ImageParsingConfig.from_dict(image_config.to_dict())
            matcher = ImagePathMatcher(selected_config)
            selected_map_record = self._require_image_publish_eligibility(
                selected_profile, selected_config
            )
            if image_delta_upload_enabled:
                image_delta_export_paths = self._image_delta_export_paths(selected_map_record)
                self.progress(
                    ProgressEvent("asset_compare", "图片比较模式：差分 Map 导出范围")
                )
                self.progress(
                    ProgressEvent(
                        "asset_compare",
                        f"差分导出文件：{len(image_delta_export_paths)} 个",
                    )
                )
            else:
                self.progress(ProgressEvent("asset_compare", "图片比较模式：全量索引比较"))
            game_version, hotfix_version, asset_version = (
                self._asset_versions_from_image_record(selected_map_record)
            )
            self.progress(
                ProgressEvent(
                    "asset_compare",
                    f"沿用 {selected_profile} 图片解析阶段已确认的正式资产版本：{asset_version}",
                )
            )
            manual_map_version = self.config.image_map_upload_version.strip()
            map_upload_version = (
                validate_map_upload_version(manual_map_version)
                if manual_map_version
                else asset_version
            )
        else:
            self.progress(ProgressEvent("asset_compare", "正在从官方 API 获取正式资产版本…"))
            game_version, hotfix_version, asset_version = self._official_asset_version()
        changes: list[dict[str, str]] = []
        counts = {"upload": 0, "overwrite": 0, "delete": 0, "index_update": 0, "error": 0}
        datasets: list[dict[str, Any]] = []
        for spec in specs:
            source = Path(spec["source"])
            if not source.is_dir():
                raise FileNotFoundError(f"本地{spec['label']}目录不存在：{source}")
            if spec["kind"] == "images" and image_delta_upload_enabled:
                current = scan_selected_dataset(
                    source,
                    "images",
                    image_delta_export_paths,
                )["files"]
                self.progress(
                    ProgressEvent(
                        "asset_compare",
                        f"本地存在并纳入比较：{len(current)} 个；未扫描差分范围外的图片",
                    )
                )
            else:
                current = scan_dataset(
                    source,
                    spec["kind"],
                    skip_json_manifests=spec["kind"] == "json",
                )["files"]
            baseline = remote_index["datasets"].get(spec["kind"])
            if not isinstance(baseline, dict) or not isinstance(baseline.get("files"), dict):
                raise ValidationError(f"R2 根索引缺少{spec['label']}数据集")
            previous = baseline["files"]
            if spec["kind"] == "images" and image_delta_upload_enabled:
                previous = {
                    path: previous[path]
                    for path in image_delta_export_paths
                    if path in previous
                }
            difference = plan_dataset_changes(
                current,
                previous,
                matcher if spec["kind"] == "images" and not image_delta_upload_enabled else None,
                compare_metadata=spec["kind"] == "json",
            )
            upload_paths = difference["upload_paths"]
            delete_paths = difference["delete_paths"]
            overwrite_paths = difference["overwrite_paths"]
            index_update_paths = difference["index_update_paths"]
            current_scope = difference["current_scope_files"]
            if spec["kind"] == "images":
                delete_paths = []
            if spec["kind"] == "images" and image_delta_upload_enabled:
                self.progress(
                    ProgressEvent(
                        "asset_compare",
                        f"远端索引缺失：{len(upload_paths)} 个；"
                        f"远端索引内容变化：{len(overwrite_paths)} 个；"
                        f"索引已一致：{len(difference['unchanged_paths'])} 个",
                    )
                )
            dataset_counts = {
                "upload": len(upload_paths),
                "overwrite": len(overwrite_paths),
                "delete": len(delete_paths),
                "index_update": len(index_update_paths),
                "error": 0,
            }
            labels = (
                ("upload", "新增到远端", upload_paths),
                ("overwrite", "本地覆盖远端", overwrite_paths),
                ("delete", "删除远端多余项", delete_paths),
                ("index_update", "仅更新索引元数据", index_update_paths),
            )
            for change_kind, label, paths in labels:
                for path in paths:
                    counts[change_kind] += 1
                    changes.append({"kind": change_kind, "label": f"{spec['label']} · {label}", "path": path})
            datasets.append(
                {
                    "kind": spec["kind"],
                    "label": spec["label"],
                    "source": str(source.resolve()),
                    "remote": str(spec["remote"]),
                    "local_files": len(current_scope),
                    "local_bytes": sum(int(info["size"]) for info in current_scope.values()),
                    "byte_delta": (
                        sum(int(current[path]["size"]) for path in upload_paths)
                        + sum(
                            int(current[path]["size"]) - int(previous[path]["size"])
                            for path in overwrite_paths
                        )
                        - sum(int(previous[path]["size"]) for path in delete_paths)
                    ),
                    "counts": dataset_counts,
                    "total_changes": sum(dataset_counts.values()),
                    "upload_paths": upload_paths,
                    "overwrite_paths": overwrite_paths,
                    "delete_paths": delete_paths,
                    "index_update_paths": index_update_paths,
                    "current_files": current,
                }
            )
        storage = self._storage_projection(datasets, remote_index)
        if storage["storage_warning"]:
            self.progress(ProgressEvent("asset_compare", storage["storage_warning"]))
        return {
            "include_json": include_json,
            "include_images": include_images,
            "manual_update": manual_update,
            "compare_mode": "remote",
            "asset_index_remote": PUBLIC_ASSET_INDEX_URL,
            "asset_index_revision": remote_index["revision"],
            "asset_index_digest": remote_digest,
            "asset_version": asset_version,
            "official_game_version": game_version,
            "official_hotfix_version": hotfix_version,
            "image_profile": selected_profile,
            "image_config": selected_config.to_dict() if selected_config else {},
            "image_config_digest": selected_config.digest() if selected_config else "",
            "image_scope": selected_config.image_containers_filter if selected_config else "",
            "image_map_run_id": str(selected_map_record.get("runId", "")) if selected_map_record else "",
            "image_map_digest": str(selected_map_record.get("pendingMapDigest", "")) if selected_map_record else "",
            "image_map_entries": int(selected_map_record.get("fullMapEntries", 0)) if selected_map_record else 0,
            "image_delta_upload_enabled": image_delta_upload_enabled,
            "image_delta_map_digest": str(selected_map_record.get("deltaMapDigest", "")) if selected_map_record else "",
            "image_delta_map_entries": int(selected_map_record.get("deltaMapEntries", 0)) if selected_map_record else 0,
            "image_delta_export_paths_digest": (
                self._delta_export_paths_digest(image_delta_export_paths)
                if include_images and image_delta_upload_enabled
                else ""
            ),
            "image_delta_export_file_count": len(image_delta_export_paths),
            "image_map_upload_version": map_upload_version,
            "image_map_upload_file": (
                asset_map_filename(selected_profile, map_upload_version)
                if selected_profile and map_upload_version
                else ""
            ),
            "image_map_version_source": (
                "manual" if include_images and self.config.image_map_upload_version.strip() else "official"
            ),
            "datasets": datasets,
            "source": "；".join(str(item["source"]) for item in datasets),
            "remote": "；".join(str(item["remote"]) for item in datasets),
            "local_files": sum(int(item["local_files"]) for item in datasets),
            "local_bytes": sum(int(item["local_bytes"]) for item in datasets),
            "total_changes": sum(counts.values()),
            "counts": counts,
            "changes": changes,
            **storage,
        }

    def plan_json_sync(self) -> dict[str, Any]:
        return self.plan_asset_sync(include_json=True, include_images=False)

    def sync_assets(
        self,
        plan: dict[str, Any],
        current_image_config: ImageParsingConfig | None = None,
        current_image_profile: str | None = None,
    ) -> dict[str, Any]:
        self.token.raise_if_cancelled()
        if not self.config.rclone.is_file():
            raise FileNotFoundError(f"rclone 不存在：{self.config.rclone}")
        if not isinstance(plan, dict) or not plan:
            raise ValidationError("缺少已完成的资产差异比较计划，拒绝正式同步")
        compare_mode = str(plan.get("compare_mode", "remote"))
        if compare_mode != "remote":
            raise ValidationError("资产比较计划的比对方式无效，请重新比较")
        expected_specs = self._asset_specs(
            bool(plan.get("include_json")), bool(plan.get("include_images"))
        )
        datasets = plan.get("datasets")
        if not isinstance(datasets, list) or len(datasets) != len(expected_specs):
            raise ValidationError("资产比较计划与当前选择不一致，请重新比较")
        for dataset, expected in zip(datasets, expected_specs):
            if not isinstance(dataset, dict):
                raise ValidationError("资产比较计划格式无效")
            try:
                source = Path(str(dataset.get("source", ""))).resolve()
            except OSError as exc:
                raise ValidationError(f"资产比较计划中的本地路径无效：{exc}") from exc
            if source != Path(expected["source"]).resolve() or str(dataset.get("remote", "")) != str(expected["remote"]):
                raise ValidationError("资产比较计划与当前同步配置不一致，请重新比较")
        manual_update = bool(plan.get("manual_update", False))
        if manual_update and not (
            bool(plan.get("include_json")) and bool(plan.get("include_images"))
        ):
            raise ValidationError("手动更新计划必须同时包含图片和 Json 全量比较")
        selected_config: ImageParsingConfig | None = None
        image_delta_upload_enabled = bool(plan.get("image_delta_upload_enabled", False))
        expected_delta_upload = bool(
            plan.get("include_images")
            and self.config.asset_upload_from_delta_map
            and not manual_update
        )
        if image_delta_upload_enabled != expected_delta_upload:
            raise ValidationError("GUI 当前差分图片上传选项与比较计划不一致，请重新比较")
        if manual_update and image_delta_upload_enabled:
            raise ValidationError("手动更新计划不能使用差分 Map")
        if not plan.get("include_images") and image_delta_upload_enabled:
            raise ValidationError("Json-only 计划不能启用差分图片上传")
        if bool(plan.get("include_images")) and not manual_update:
            if current_image_profile is None or normalize_image_profile(current_image_profile) != str(
                plan.get("image_profile", "")
            ):
                raise ValidationError("当前图片 profile 与比较计划不一致，请重新比较")
            selected_config = ImageParsingConfig.from_dict(plan.get("image_config"))
            if selected_config.digest() != str(plan.get("image_config_digest", "")):
                raise ValidationError("图片配置摘要与比较计划不一致，请重新比较")
            if current_image_config is None or current_image_config.digest() != selected_config.digest():
                raise ValidationError("图片配置在比较后发生变化，请重新比较")
        current_asset_version = str(plan.get("asset_version", ""))
        if manual_update and not re.fullmatch(r"manual@[0-9]{14}", current_asset_version):
            raise ValidationError("手动更新计划的资产版本标识无效，请重新比较")
        image_map_record: dict[str, Any] | None = None
        if selected_config is not None:
            image_map_record = self._require_image_publish_eligibility(
                str(plan.get("image_profile", "")),
                selected_config,
                verify_artifacts=True,
            )
            _, _, recorded_asset_version = self._asset_versions_from_image_record(
                image_map_record
            )
            if recorded_asset_version != current_asset_version:
                raise ValidationError("图片发布版本在比较后发生变化，请重新比较")
            self.progress(
                ProgressEvent(
                    "asset_upload",
                    f"沿用图片解析阶段已确认的正式资产版本：{current_asset_version}",
                )
            )
            manual_map_version = self.config.image_map_upload_version.strip()
            current_map_upload_version = (
                validate_map_upload_version(manual_map_version)
                if manual_map_version
                else current_asset_version
            )
            if current_map_upload_version != str(
                plan.get("image_map_upload_version", "")
            ):
                raise ValidationError("Map 上传版本在比较后发生变化，请重新比较")
        elif not manual_update:
            self.progress(ProgressEvent("asset_upload", "正式同步前重新读取官方资产版本…"))
            _, _, official_asset_version = self._official_asset_version()
            if official_asset_version != current_asset_version:
                raise ValidationError(
                    f"版本变化：比较时为 {current_asset_version or '未知'}，"
                    f"当前为 {official_asset_version}，请重新比较"
                )
        if image_map_record is not None:
            current_delta_paths = (
                self._image_delta_export_paths(image_map_record)
                if image_delta_upload_enabled
                else []
            )
            if (
                str(image_map_record.get("runId", "")) != str(plan.get("image_map_run_id", ""))
                or str(image_map_record.get("pendingMapDigest", ""))
                != str(plan.get("image_map_digest", ""))
                or int(image_map_record.get("fullMapEntries", -1))
                != int(plan.get("image_map_entries", -2))
                or (
                    image_delta_upload_enabled
                    and (
                        str(image_map_record.get("deltaMapDigest", ""))
                        != str(plan.get("image_delta_map_digest", ""))
                        or int(image_map_record.get("deltaMapEntries", -1))
                        != int(plan.get("image_delta_map_entries", -2))
                        or self._delta_export_paths_digest(current_delta_paths)
                        != str(plan.get("image_delta_export_paths_digest", ""))
                        or len(current_delta_paths)
                        != int(plan.get("image_delta_export_file_count", -1))
                    )
                )
            ):
                raise ValidationError("图片完整 map 在比较后发生变化，请重新比较")
        remote_index = self._read_public_asset_index()
        if (
            self._asset_index_digest(remote_index)
            != str(plan.get("asset_index_digest", ""))
            or remote_index.get("revision") != plan.get("asset_index_revision")
        ):
            raise ValidationError("data 站资产索引在比较后发生变化，请重新比较")
        counts = plan.get("counts")
        if not isinstance(counts, dict):
            raise ValidationError("资产比较计划缺少差异统计，拒绝正式同步")
        if counts.get("error"):
            raise ValidationError("资产差异比较出现错误，拒绝正式同步")
        pending_marker = self.config.work_root / "asset-sync-pending.json"
        old_pending = self._read_asset_pending(pending_marker)
        image_dataset = next(
            (dataset for dataset in datasets if isinstance(dataset, dict) and dataset.get("kind") == "images"),
            None,
        )
        plan_digest = self._asset_plan_digest(plan) if image_dataset is not None else ""
        upload_stats: dict[str, Any] = {
            "uploadedCount": 0,
            "uploadedBytes": 0,
            "batchCount": 0,
            "retryCount": 0,
            "probeCounts": {"exists": 0, "missing": 0, "empty": 0, "indeterminate": 0},
            "finalProbeCounts": {"exists": 0, "missing": 0, "empty": 0, "indeterminate": 0},
        }
        pending: dict[str, Any] | None = None
        if image_dataset is not None:
            upload_paths = self._validate_relative_path_list(
                image_dataset.get("upload_paths"), "图片新增"
            )
            overwrite_paths = self._validate_relative_path_list(
                image_dataset.get("overwrite_paths"), "图片覆盖"
            )
            image_transfer_paths: list[str]
            reusable_pending = False
            recovery_probe_required = False
            if old_pending is not None:
                old_revision = old_pending.get("assetIndexRevision")
                old_digest = old_pending.get("assetIndexDigest")
                if old_revision != plan.get("asset_index_revision") or old_digest != plan.get("asset_index_digest"):
                    raise ValidationError(
                        "旧图片上传 pending 与重新生成计划的远端索引 revision/digest 不一致，"
                        "停止以避免并发覆盖"
                    )
                if old_pending.get("schemaVersion") == 2:
                    expected_identity = {
                        "planDigest": plan_digest,
                        "profile": plan.get("image_profile"),
                        "configDigest": plan.get("image_config_digest"),
                        "mapRunId": plan.get("image_map_run_id"),
                        "mapDigest": plan.get("image_map_digest"),
                        "deltaUploadEnabled": image_delta_upload_enabled,
                        "deltaMapDigest": plan.get("image_delta_map_digest", ""),
                        "deltaMapEntries": plan.get("image_delta_map_entries", 0),
                        "deltaExportPathsDigest": plan.get(
                            "image_delta_export_paths_digest", ""
                        ),
                        "deltaExportFileCount": plan.get(
                            "image_delta_export_file_count", 0
                        ),
                    }
                    if any(old_pending.get(key) != value for key, value in expected_identity.items()):
                        raise ValidationError(
                            "图片上传 pending 与当前配置、map 或本地计划不一致，拒绝续传"
                        )
                    transfer_value = old_pending.get("transferPaths")
                    if not isinstance(transfer_value, list):
                        raise ValidationError("图片上传 pending 缺少 transferPaths")
                    image_transfer_paths = self._validate_relative_path_list(
                        transfer_value, "pending transfer"
                    )
                    reusable_pending = True
                    pending = deepcopy(old_pending)
                    upload_stats["probeCounts"] = dict(
                        old_pending.get("probeCounts", upload_stats["probeCounts"])
                    )
                    recovery_probe_required = bool(old_pending.get("recoveryProbe", False))
                    if image_delta_upload_enabled and recovery_probe_required:
                        raise ValidationError(
                            "差分图片计划不能续用 legacy recovery probe pending，请重新比较并执行"
                        )
                else:
                    if image_delta_upload_enabled:
                        raise ValidationError(
                            "差分图片计划不能续用旧版 pending，请重新比较并执行"
                        )
                    # The interrupted legacy marker had no path list. It is
                    # only a baseline fence; probe the freshly regenerated plan.
                    image_transfer_paths = []
                    recovery_probe_required = True
            else:
                # Normal uploads trust the freshly compared asset index. A
                # public-image existence probe is reserved for legacy recovery.
                image_transfer_paths = sorted(set(upload_paths + overwrite_paths))
            if not reusable_pending:
                if recovery_probe_required:
                    probe = self._probe_image_paths(upload_paths, "新增图片")
                    upload_stats["probeCounts"] = probe["counts"]
                    statuses = probe["statuses"]
                    image_transfer_paths = sorted(
                        [path for path in upload_paths if statuses.get(path) in {"missing", "empty"}]
                        + overwrite_paths
                    )
                pending = {
                    "schemaVersion": 2,
                    "assetIndexRevision": plan.get("asset_index_revision"),
                    "assetIndexDigest": plan.get("asset_index_digest"),
                    "planDigest": plan_digest,
                    "profile": plan.get("image_profile"),
                    "configDigest": plan.get("image_config_digest"),
                    "mapRunId": plan.get("image_map_run_id"),
                    "mapDigest": plan.get("image_map_digest"),
                    "mapEntries": plan.get("image_map_entries"),
                    "deltaUploadEnabled": image_delta_upload_enabled,
                    "deltaMapDigest": plan.get("image_delta_map_digest", ""),
                    "deltaMapEntries": plan.get("image_delta_map_entries", 0),
                    "deltaExportPathsDigest": plan.get(
                        "image_delta_export_paths_digest", ""
                    ),
                    "deltaExportFileCount": plan.get("image_delta_export_file_count", 0),
                    "assetVersion": plan.get("asset_version"),
                    "mapUploadVersion": plan.get("image_map_upload_version"),
                    "recoveryProbe": recovery_probe_required,
                    "transferPaths": image_transfer_paths,
                    "totalCount": len(image_transfer_paths),
                    "completedCount": 0,
                    "remainingPaths": image_transfer_paths,
                    "currentBatch": None,
                    "lastError": "",
                    "retryCount": 0,
                    "probeCounts": upload_stats["probeCounts"],
                }
                self._write_asset_pending(pending_marker, pending)
            else:
                pending["remainingPaths"] = self._validate_relative_path_list(
                    pending.get("remainingPaths"), "pending 剩余"
                )
            if pending is None:
                raise ValidationError("图片上传 pending 初始化失败")
            if image_transfer_paths:
                batch_stats = self._sync_image_batches(
                    image_dataset,
                    image_transfer_paths,
                    pending,
                    pending_marker,
                )
                for key, value in batch_stats.items():
                    upload_stats[key] = value
            else:
                pending["totalCount"] = 0
                pending["completedCount"] = 0
                pending["remainingPaths"] = []
                pending["currentBatch"] = None
                self._write_asset_pending(pending_marker, pending)
            if recovery_probe_required:
                final_probe = self._probe_image_paths(upload_paths, "上传后新增图片")
                upload_stats["finalProbeCounts"] = final_probe["counts"]
                if any(
                    final_probe["counts"].get(key, 0)
                    for key in ("missing", "empty", "indeterminate")
                ):
                    raise ValidationError("上传后新增图片仍有缺失、空对象或不确定对象，拒绝提交索引")
            pending["finalProbeCounts"] = upload_stats["finalProbeCounts"]
            pending["remainingPaths"] = []
            pending["completedCount"] = pending.get("totalCount", 0)
            self._write_asset_pending(pending_marker, pending)
        else:
            # Keep the same marker contract for a Json-only sync, while the
            # image-specific resumable engine remains isolated to images.
            pending = {
                "schemaVersion": 2,
                "assetIndexRevision": plan.get("asset_index_revision"),
                "assetIndexDigest": plan.get("asset_index_digest"),
                "planDigest": "",
                "totalCount": 0,
                "completedCount": 0,
                "remainingPaths": [],
                "currentBatch": None,
                "lastError": "",
            }
            self._write_asset_pending(pending_marker, pending)
        storage = self._storage_projection(datasets, remote_index)
        if storage["storage_warning"]:
            self.progress(ProgressEvent("asset_upload", storage["storage_warning"]))
        if not plan.get("total_changes"):
            self.progress(ProgressEvent("asset_upload", "本地资产与 R2 已一致，无需上传", 1, 1))
            map_commit = (
                self._commit_image_asset_map(
                    str(plan.get("image_profile", "")),
                    image_map_record,
                    str(plan.get("image_map_upload_version", "")),
                )
                if image_map_record is not None
                else {}
            )
            pending_marker.unlink(missing_ok=True)
            return {
                **plan,
                **storage,
                "changed": False,
                "sharedRevision": "",
                **map_commit,
            }

        changed_shared_assets = False
        for dataset in datasets:
            if not dataset.get("total_changes"):
                continue
            label = str(dataset["label"])
            physical_changes = sum(
                len(dataset.get(key, []))
                for key in ("upload_paths", "overwrite_paths", "delete_paths")
            )
            if physical_changes:
                action = (
                    "只上传新增或变更文件，不删除历史图片"
                    if dataset.get("kind") == "images"
                    else "先删除远端多余项，再上传新增或变更文件"
                )
                self.progress(ProgressEvent("asset_upload", f"开始同步{label}；{action}"))
                if dataset.get("kind") != "images":
                    self._sync_local_asset_dataset(dataset)
            else:
                self.progress(
                    ProgressEvent(
                        "asset_upload",
                        f"{label}文件内容未变化，仅更新资产索引元数据",
                    )
                )
            changed_shared_assets = True

        revision = ""
        final_index = remote_index
        if changed_shared_assets:
            revision = datetime.now(timezone.utc).isoformat()
            next_index = merge_asset_index(
                remote_index,
                [dataset for dataset in datasets if dataset.get("total_changes")],
                current_asset_version,
                revision,
            )
            if any(dataset.get("kind") == "json" for dataset in datasets if dataset.get("total_changes")):
                next_index = validate_level_data_dialog_metadata(next_index)
            if self.before_index_upload is not None:
                self.before_index_upload()
            latest_index = self._read_public_asset_index()
            if self._asset_index_digest(latest_index) != self._asset_index_digest(remote_index):
                raise ValidationError("远端并发修改：资产写入期间索引发生变化，拒绝覆盖")
            self._upload_remote_asset_index(next_index)
            verified_index = self._read_remote_asset_index_exact()
            if any(dataset.get("kind") == "json" for dataset in datasets if dataset.get("total_changes")):
                verified_index = validate_level_data_dialog_metadata(verified_index)
            if (
                self._asset_index_digest(verified_index) != self._asset_index_digest(next_index)
                or verified_index.get("revision") != revision
            ):
                raise ValidationError("回读的 asset-sync-index.json 与提交内容不一致，拒绝提交 map")
            if image_dataset is not None:
                changed_paths = self._validate_relative_path_list(
                    image_dataset.get("upload_paths"), "图片新增"
                ) + self._validate_relative_path_list(
                    image_dataset.get("overwrite_paths"), "图片覆盖"
                )
                verified_files = verified_index["datasets"]["images"]["files"]
                local_files = image_dataset["current_files"]
                for path in changed_paths:
                    remote_record = verified_files.get(path)
                    local_record = local_files.get(path)
                    if not isinstance(remote_record, dict) or not isinstance(local_record, dict):
                        raise ValidationError(f"回读索引缺少本批次图片记录：{path}")
                    if (
                        int(remote_record.get("size", -1)) != int(local_record.get("size", -2))
                        or str(remote_record.get("md5", "")).lower() != str(local_record.get("md5", "")).lower()
                        or str(remote_record.get("version", "")) != current_asset_version
                    ):
                        raise ValidationError(f"回读索引中的图片记录不匹配：{path}")
            final_index = next_index
        map_commit = (
            self._commit_image_asset_map(
                str(plan.get("image_profile", "")),
                image_map_record,
                str(plan.get("image_map_upload_version", "")),
            )
            if image_map_record is not None
            else {}
        )
        final_size = self._asset_index_storage(final_index)
        if final_size["bytes"] > R2_STORAGE_WARNING_BYTES:
            self.progress(
                ProgressEvent(
                    "asset_upload",
                    "提醒：上传后索引记录资产总量 "
                    f"{final_size['bytes'] / 1_000_000_000:.2f} GB，超过 10 GB 提醒线",
                )
            )
        self.progress(
            ProgressEvent(
                "asset_upload",
                "资产与索引发布完成"
                if manual_update
                else "资产、索引与 Asset map 发布完成",
                1,
                1,
            )
        )
        pending_marker.unlink(missing_ok=True)
        return {
            **plan,
            "remote_total_bytes": final_size["bytes"],
            "remote_total_files": final_size["count"],
            "changed": True,
            "assetRevision": revision,
            "sharedRevision": "",
            **map_commit,
        }

    @staticmethod
    def _validate_relative_path_list(value: Any, label: str) -> list[str]:
        if not isinstance(value, list):
            raise ValidationError(f"本地差异计划缺少{label}路径列表")
        result: list[str] = []
        for raw_path in value:
            path = str(raw_path).replace("\\", "/")
            if (
                not path
                or path.startswith("/")
                or "\n" in path
                or "\r" in path
                or any(part in {"", ".", ".."} for part in path.split("/"))
                or Path(path).is_absolute()
                or re.match(r"^[A-Za-z]:", path)
            ):
                raise ValidationError(f"本地差异计划包含不安全路径：{raw_path}")
            result.append(path)
        return result

    @staticmethod
    def _rclone_failure_kind(return_code: int, output: str) -> str:
        lowered = output.lower()
        fatal_markers = (
            "access denied",
            "accessdenied",
            "invalidaccesskeyid",
            "signaturedoesnotmatch",
            "invalid token",
            "invalidtoken",
            "no credential",
            "credential",
            "unauthorized",
            "status code: 401",
            "status code: 403",
            " http 401",
            " http 403",
        )
        if any(marker in lowered for marker in fatal_markers):
            return "fatal"
        retry_markers = (
            "no such host",
            "statuscode 0",
            "status code 0",
            "statuscode: 0",
            "status code: 408",
            "status code: 429",
            "http 408",
            "http 429",
            " 408 ",
            " 429 ",
            " 500 ",
            " 501 ",
            " 502 ",
            " 503 ",
            " 504 ",
            " 505 ",
            " 506 ",
            " 507 ",
            " 508 ",
            " 509 ",
            " 510 ",
            " 511 ",
            "statuscode 5",
            "status code: 5",
            "http 5",
            "timeout",
            "timed out",
            "connection reset",
            "connection aborted",
        )
        if any(marker in lowered for marker in retry_markers):
            return "retryable"
        return "fatal" if return_code != 0 else "ok"

    def _run_image_batch(
        self,
        dataset: dict[str, Any],
        paths: list[str],
        batch_number: int,
        log_path: Path,
    ) -> int:
        if not paths:
            return 0
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", suffix=".txt", prefix="ake-image-batch-", delete=False
        ) as stream:
            transfer_file = Path(stream.name)
            stream.write("\n".join(paths) + "\n")
        retries = 0
        try:
            for attempt, concurrency in enumerate(ASSET_UPLOAD_CONCURRENCIES):
                self.token.raise_if_cancelled()
                arguments = [
                    "copy",
                    str(dataset["source"]),
                    str(dataset["remote"]),
                    "--s3-no-check-bucket",
                    "--fast-list",
                    "--checkers",
                    str(concurrency),
                    "--transfers",
                    str(concurrency),
                    "--stats",
                    "10s",
                    "--retries",
                    "1",
                    "--files-from-raw",
                    str(transfer_file),
                    "--no-check-dest",
                    "--no-traverse",
                    "--header-upload",
                    "Cache-Control: public, max-age=86400",
                ]
                started = datetime.now(timezone.utc).isoformat()
                result = subprocess.run(
                    [str(self.config.rclone), *arguments],
                    cwd=str(self.repo_root),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
                output = (result.stdout or "") + (result.stderr or "")
                with log_path.open("a", encoding="utf-8") as stream:
                    stream.write(
                        f"[{started}] batch={batch_number} attempt={attempt + 1} "
                        f"concurrency={concurrency} files={len(paths)}\n"
                    )
                    stream.write(output)
                    if output and not output.endswith("\n"):
                        stream.write("\n")
                if result.returncode == 0:
                    return retries
                failure_kind = self._rclone_failure_kind(result.returncode, output)
                if failure_kind != "retryable" or attempt >= len(ASSET_UPLOAD_BACKOFFS):
                    raise AkeToolError(
                        f"图片批次 {batch_number} 上传失败，退出码 {result.returncode}；"
                        f"完整 rclone 输出见 {log_path}"
                    )
                retries += 1
                delay = ASSET_UPLOAD_BACKOFFS[attempt]
                next_concurrency = ASSET_UPLOAD_CONCURRENCIES[min(attempt + 1, len(ASSET_UPLOAD_CONCURRENCIES) - 1)]
                self.progress(
                    ProgressEvent(
                        "asset_upload",
                        f"图片批次 {batch_number} 遇到可重试网络错误，{delay} 秒后重试；"
                        f"并发降为 {next_concurrency}；累计重试 {retries} 次",
                    )
                )
                time.sleep(delay)
            raise AkeToolError(f"图片批次 {batch_number} 上传失败；完整输出见 {log_path}")
        finally:
            transfer_file.unlink(missing_ok=True)

    def _sync_image_batches(
        self,
        dataset: dict[str, Any],
        transfer_paths: list[str],
        pending: dict[str, Any],
        pending_marker: Path,
    ) -> dict[str, int | str]:
        transfer_paths = self._validate_relative_path_list(transfer_paths, "图片上传")
        current_files = dataset.get("current_files")
        if not isinstance(current_files, dict):
            raise ValidationError("图片上传计划缺少本地文件记录")
        transfer_paths = sorted(set(transfer_paths))
        sizes = {}
        for path in transfer_paths:
            info = current_files.get(path)
            if not isinstance(info, dict):
                raise ValidationError(f"图片上传计划缺少本地文件记录：{path}")
            sizes[path] = int(info.get("size", -1))
            if sizes[path] < 0:
                raise ValidationError(f"图片上传计划文件大小无效：{path}")
        remaining = self._validate_relative_path_list(
            pending.get("remainingPaths", transfer_paths), "pending 剩余"
        )
        allowed = set(transfer_paths)
        if not set(remaining).issubset(allowed):
            raise ValidationError("图片上传 pending 与当前计划路径不一致")
        remaining = sorted(set(remaining))
        batches: list[list[str]] = []
        batch: list[str] = []
        batch_bytes = 0
        for path in remaining:
            size = sizes[path]
            if batch and (
                len(batch) >= ASSET_BATCH_MAX_FILES
                or batch_bytes + size > ASSET_BATCH_MAX_BYTES
            ):
                batches.append(batch)
                batch = []
                batch_bytes = 0
            batch.append(path)
            batch_bytes += size
        if batch:
            batches.append(batch)
        log_path = Path(str(pending.get("rcloneLogPath", ""))).resolve()
        if not str(log_path) or str(log_path) == str(Path.cwd()):
            log_path = TOOL_ROOT / "logs" / f"asset-sync-rclone-{datetime.now().strftime('%Y%m%d-%H%M%S')}.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        pending["rcloneLogPath"] = str(log_path)
        pending["totalCount"] = len(transfer_paths)
        pending["completedCount"] = len(transfer_paths) - len(remaining)
        pending["remainingPaths"] = remaining
        pending.setdefault("retryCount", 0)
        pending.setdefault("lastError", "")
        self._write_asset_pending(pending_marker, pending)
        bytes_uploaded = 0
        retry_count = int(pending.get("retryCount", 0) or 0)
        completed = len(transfer_paths) - len(remaining)
        for batch_number, current_batch in enumerate(batches, 1):
            batch_bytes = sum(sizes[path] for path in current_batch)
            pending["currentBatch"] = {
                "number": batch_number,
                "count": len(current_batch),
                "bytes": batch_bytes,
                "paths": current_batch,
            }
            pending["lastError"] = ""
            self._write_asset_pending(pending_marker, pending)
            try:
                retries = self._run_image_batch(
                    dataset, current_batch, batch_number, log_path
                )
            except Exception as exc:
                pending["lastError"] = str(exc)
                self._write_asset_pending(pending_marker, pending)
                raise
            retry_count += retries
            retry_count = int(retry_count)
            remaining_set = set(remaining)
            remaining_set.difference_update(current_batch)
            remaining = sorted(remaining_set)
            completed = len(transfer_paths) - len(remaining)
            bytes_uploaded += batch_bytes
            pending.update(
                {
                    "completedCount": completed,
                    "remainingPaths": remaining,
                    "retryCount": retry_count,
                    "currentBatch": {
                        "number": batch_number,
                        "count": len(current_batch),
                        "bytes": batch_bytes,
                        "paths": current_batch,
                        "status": "completed",
                    },
                    "lastError": "",
                }
            )
            self._write_asset_pending(pending_marker, pending)
            self.progress(
                ProgressEvent(
                    "asset_upload",
                    f"图片批次完成：{completed}/{len(transfer_paths)} 个，"
                    f"{bytes_uploaded} 字节；批次重试 {retries} 次",
                    completed,
                    len(transfer_paths),
                )
            )
        return {
            "uploadedCount": len(transfer_paths),
            "uploadedBytes": bytes_uploaded,
            "batchCount": len(batches),
            "retryCount": retry_count,
            "rcloneLogPath": str(log_path),
        }

    def _sync_local_asset_dataset(self, dataset: dict[str, Any]) -> None:
        label = str(dataset["label"])
        delete_paths = self._validate_relative_path_list(
            dataset.get("delete_paths"), f"{label}删除"
        )
        if str(dataset.get("kind")) == "images" and delete_paths:
            raise ValidationError("图片增量同步禁止删除远端历史文件")
        upload_paths = self._validate_relative_path_list(
            dataset.get("upload_paths"), f"{label}新增"
        )
        overwrite_paths = self._validate_relative_path_list(
            dataset.get("overwrite_paths"), f"{label}覆盖"
        )
        transfer_paths = upload_paths + overwrite_paths
        with tempfile.TemporaryDirectory(prefix="ake-asset-sync-") as directory:
            temporary = Path(directory)
            if delete_paths:
                delete_file = temporary / "delete-files.txt"
                delete_file.write_text("\n".join(delete_paths) + "\n", encoding="utf-8")
                self.progress(
                    ProgressEvent(
                        "asset_upload",
                        f"正在删除{label}远端多余项：{len(delete_paths)} 个",
                    )
                )
                self._stream_rclone(
                    [
                        "delete",
                        str(dataset["remote"]),
                        "--files-from-raw",
                        str(delete_file),
                        "--s3-no-check-bucket",
                    ],
                    "asset_upload",
                )
            if transfer_paths:
                transfer_file = temporary / "transfer-files.txt"
                transfer_file.write_text("\n".join(transfer_paths) + "\n", encoding="utf-8")
                self.progress(
                    ProgressEvent(
                        "asset_upload",
                        f"正在上传{label}新增或变更项：{len(transfer_paths)} 个",
                    )
                )
                self._stream_rclone(
                    [
                        "copy",
                        str(dataset["source"]),
                        str(dataset["remote"]),
                        *COMMON_RCLONE_ARGS,
                        "--files-from-raw",
                        str(transfer_file),
                        "--no-check-dest",
                        "--no-traverse",
                        "--header-upload",
                        "Cache-Control: public, max-age=86400",
                    ],
                    "asset_upload",
                )
                self.progress(
                    ProgressEvent(
                        "asset_upload",
                        f"{label}新增或变更项上传完成：{len(transfer_paths)} 个",
                    )
                )

    def sync_json_data(self, plan: dict[str, Any]) -> dict[str, Any]:
        return self.sync_assets(plan)

    def delete_r2_version(self, version_id: str) -> dict[str, Any]:
        self.token.raise_if_cancelled()
        if not self.config.rclone.is_file():
            raise FileNotFoundError(f"rclone 不存在：{self.config.rclone}")
        normalized_id = version_id.strip()
        if not re.fullmatch(r"\d+\.\d+\.\d+@[A-Za-z0-9][A-Za-z0-9._-]*", normalized_id):
            raise ValidationError(f"R2 版本 ID 格式无效：{version_id}")
        id_game_version, id_hotfix_version = normalized_id.split("@", 1)
        table_remote = (
            f"{self.remote_base}/public/{id_game_version}/{id_hotfix_version}/TableCfg"
        )
        pending_dir = self.config.work_root / "r2-delete-pending"
        pending_marker = pending_dir / f"{normalized_id}.json"

        manifest = self._read_remote_manifest()
        target = next(
            (
                item
                for item in manifest.get("versions", [])
                if isinstance(item, dict) and str(item.get("id", "")).strip() == normalized_id
            ),
            None,
        )
        if target is not None:
            game_version = str(target.get("gameVersion", "")).strip()
            hotfix_version = str(target.get("hotfixVersion", "")).strip()
            expected_id = f"{game_version}@{hotfix_version}"
            if not re.fullmatch(r"\d+\.\d+\.\d+", game_version) or not re.fullmatch(
                r"[A-Za-z0-9][A-Za-z0-9._-]*", hotfix_version
            ):
                raise ValidationError(f"R2 manifest.json 中版本字段不安全：{normalized_id}")
            if expected_id != normalized_id:
                raise ValidationError(
                    f"R2 manifest.json 版本 ID 与字段不一致：{normalized_id} != {expected_id}"
                )

            pending_dir.mkdir(parents=True, exist_ok=True)
            pending_marker.write_text(
                json.dumps(
                    {"version": normalized_id, "remote": table_remote},
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            updated_at = datetime.now(timezone.utc).isoformat()
            new_manifest = build_manifest_without_version(manifest, normalized_id, updated_at)

            # 先让 manifest 停止引用目标版本，再删除数据。若 purge 失败，只会留下不可见的孤立数据，
            # 本地 pending 标记允许用户从未刷新的列表中重试精确目录清理。
            self.progress(ProgressEvent("r2_delete", f"正在从 manifest 移除版本：{normalized_id}"))
            self._upload_remote_manifest(new_manifest)
            verification = self._read_remote_manifest()
            if any(
                isinstance(item, dict) and str(item.get("id", "")).strip() == normalized_id
                for item in verification.get("versions", [])
            ):
                raise ValidationError(f"R2 manifest.json 校验失败，版本仍然存在：{normalized_id}")
            expected_latest = str(new_manifest.get("latest", "")).strip()
            if str(verification.get("latest", "")).strip() != expected_latest:
                raise ValidationError(
                    f"R2 manifest.json latest 校验失败：预期 {expected_latest or '空'}"
                )
        else:
            if not pending_marker.is_file():
                raise ValidationError(f"R2 manifest.json 中不存在版本：{normalized_id}")
            try:
                pending = json.loads(pending_marker.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise ValidationError(f"R2 删除重试标记无效：{pending_marker}") from exc
            if pending.get("version") != normalized_id or pending.get("remote") != table_remote:
                raise ValidationError(f"R2 删除重试标记与目标不一致：{pending_marker}")
            new_manifest = manifest
            expected_latest = str(manifest.get("latest", "")).strip()
            self.progress(ProgressEvent("r2_delete", f"继续清理上次未完成的 R2 删除：{normalized_id}"))

        self.progress(ProgressEvent("r2_delete", f"正在删除 R2 数据：{table_remote}"))
        try:
            self._stream_rclone(
                ["purge", table_remote, "--s3-no-check-bucket"],
                "r2_delete",
            )
        except Exception as exc:
            raise AkeToolError(
                f"版本已从 manifest 移除，但 R2 数据清理失败；目标可能成为孤立目录：{table_remote}。{exc}"
            ) from exc

        remaining = self._capture_rclone(
            ["lsf", table_remote, "--s3-no-check-bucket", "--max-depth", "1"],
            allow_failure=True,
        )
        if remaining.strip():
            raise ValidationError(f"R2 数据删除后仍检测到文件：{table_remote}")
        pending_marker.unlink(missing_ok=True)
        self.progress(ProgressEvent("r2_delete", f"R2 版本已删除：{normalized_id}", 1, 1))
        return {
            "deleted_version": normalized_id,
            "deleted_remote": table_remote,
            "latest": expected_latest,
            "remaining_count": len(new_manifest.get("versions", [])),
            "updatedAt": str(new_manifest.get("updatedAt", "")),
            "versions": [
                dict(item) for item in new_manifest.get("versions", []) if isinstance(item, dict)
            ],
        }

    def _read_remote_manifest(self) -> dict[str, Any]:
        manifest_text = self._capture_rclone(
            ["cat", f"{self.remote_base}/manifest.json", "--s3-no-check-bucket"]
        )
        try:
            manifest = json.loads(manifest_text)
        except json.JSONDecodeError as exc:
            raise ValidationError("R2 manifest.json 不是有效 JSON") from exc
        if not isinstance(manifest, dict):
            raise ValidationError("R2 manifest.json 根节点不是对象")
        return manifest

    def _upload_remote_manifest(
        self,
        manifest: dict[str, Any],
        stage: str = "r2_delete",
    ) -> None:
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                suffix=".json",
                prefix="akedata-manifest-delete-",
                delete=False,
            ) as stream:
                json.dump(manifest, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                temporary_path = Path(stream.name)
            self._stream_rclone(
                [
                    "copyto",
                    str(temporary_path),
                    f"{self.remote_base}/manifest.json",
                    *COMMON_RCLONE_ARGS,
                    "--header-upload",
                    "Cache-Control: no-cache, max-age=0",
                ],
                stage,
            )
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    def upload_table_cfg(
        self,
        latest: LatestInfo,
        publish_latest: bool = True,
    ) -> dict[str, Any]:
        self.token.raise_if_cancelled()
        if not self.config.rclone.is_file():
            raise FileNotFoundError(f"rclone 不存在：{self.config.rclone}")
        table_root = self.config.public_root / "TableCfg"
        if not table_root.is_dir():
            raise FileNotFoundError(f"待上传 TableCfg 不存在：{table_root}")

        game_version, hotfix_version = resolve_r2_versions(latest)

        remote_base = f"{self.config.r2_remote}:{self.config.r2_bucket}"
        table_remote = f"{remote_base}/public/{game_version}/{hotfix_version}/TableCfg"
        version_id = f"{game_version}@{hotfix_version}"
        pending_dir = self.config.work_root / "release-pending"
        pending_marker = pending_dir / f"{game_version}@{hotfix_version}.json"
        existing = self._capture_rclone(["lsf", table_remote, "--s3-no-check-bucket", "--max-depth", "1"], allow_failure=True)
        manifest_text = self._capture_rclone(
            ["cat", f"{remote_base}/manifest.json", "--s3-no-check-bucket"],
            allow_failure=True,
        )
        try:
            remote_manifest = json.loads(manifest_text) if manifest_text.strip() else None
        except json.JSONDecodeError as exc:
            raise ValidationError("R2 manifest.json 不是有效 JSON") from exc
        manifest_has_version = any(
            isinstance(item, dict) and str(item.get("id", "")) == version_id
            for item in (remote_manifest or {}).get("versions", [])
        )
        current_latest = str((remote_manifest or {}).get("latest", "")).strip()
        if (
            existing.strip()
            and manifest_has_version
            and (not publish_latest or current_latest == version_id)
        ):
            pending_marker.unlink(missing_ok=True)
            self.progress(ProgressEvent("upload", f"R2 版本已完整存在，跳过重复上传：{version_id}", 1, 1))
            return self._upload_result(
                version_id,
                table_remote,
                remote_base,
                published_latest=current_latest == version_id,
            )
        if existing.strip() and not manifest_has_version and not pending_marker.is_file():
            raise ValidationError(f"R2 版本目录已经存在且不是本工具的未完成任务，拒绝覆盖：{table_remote}")

        if not existing.strip():
            self.progress(ProgressEvent("upload", f"开始上传 TableCfg：{table_remote}"))
            self._stream_rclone(
                [
                    "copy",
                    str(table_root),
                    table_remote,
                    *COMMON_RCLONE_ARGS,
                    "--immutable",
                    "--header-upload",
                    "Cache-Control: public, max-age=31536000, immutable",
                ],
                "upload",
            )
            pending_dir.mkdir(parents=True, exist_ok=True)
            pending_marker.write_text(
                json.dumps({"version": version_id, "remote": table_remote}, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        elif not manifest_has_version:
            self.progress(ProgressEvent("upload", f"继续未完成的 R2 manifest 发布：{version_id}"))
        else:
            self.progress(ProgressEvent("upload", f"R2 数据已存在，仅更新 latest 指针：{version_id}"))

        published_at = datetime.now(timezone.utc).isoformat()
        manifest = build_manifest(
            remote_manifest,
            game_version,
            hotfix_version,
            published_at,
            publish_latest=publish_latest,
        )

        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                suffix=".json",
                prefix="akedata-manifest-",
                delete=False,
            ) as stream:
                json.dump(manifest, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
                temporary_path = Path(stream.name)
            self._stream_rclone(
                [
                    "copyto",
                    str(temporary_path),
                    f"{remote_base}/manifest.json",
                    *COMMON_RCLONE_ARGS,
                    "--header-upload",
                    "Cache-Control: no-cache, max-age=0",
                ],
                "upload",
            )
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

        verification_text = self._capture_rclone(
            ["cat", f"{remote_base}/manifest.json", "--s3-no-check-bucket"]
        )
        try:
            verification = json.loads(verification_text)
        except json.JSONDecodeError as exc:
            raise ValidationError("上传后的 R2 manifest.json 不是有效 JSON") from exc
        expected_latest = str(manifest.get("latest", ""))
        if str(verification.get("latest", "")) != expected_latest:
            raise ValidationError(
                f"R2 manifest.json 校验失败：latest={verification.get('latest')!r}，预期 {expected_latest!r}"
            )
        if not any(
            isinstance(item, dict) and str(item.get("id", "")) == version_id
            for item in verification.get("versions", [])
        ):
            raise ValidationError(f"R2 manifest.json 校验失败：缺少版本 {version_id}")
        pending_marker.unlink(missing_ok=True)
        latest_message = "并设为 latest" if expected_latest == version_id else f"；latest 保持 {expected_latest}"
        self.progress(ProgressEvent("upload", f"R2 发布完成：{version_id} {latest_message}", 1, 1))
        return self._upload_result(
            version_id,
            table_remote,
            remote_base,
            published_latest=expected_latest == version_id,
        )

    @staticmethod
    def _upload_result(
        version_id: str,
        table_remote: str,
        remote_base: str,
        published_latest: bool,
    ) -> dict[str, Any]:
        return {
            "r2_version_id": version_id,
            "r2_table_remote": table_remote,
            "r2_manifest_remote": f"{remote_base}/manifest.json",
            "r2_published_latest": published_latest,
        }

    def _capture_rclone(self, arguments: list[str], allow_failure: bool = False) -> str:
        result = self._capture_rclone_result(arguments)
        if result.returncode != 0 and not allow_failure:
            raise AkeToolError(result.stderr.strip() or f"rclone 失败，退出码 {result.returncode}")
        return result.stdout

    def _capture_rclone_result(
        self, arguments: list[str]
    ) -> subprocess.CompletedProcess[str]:
        self.token.raise_if_cancelled()
        return subprocess.run(
            [str(self.config.rclone), *arguments],
            cwd=str(self.repo_root),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )

    def _stream_rclone(self, arguments: list[str], stage: str) -> None:
        process = subprocess.Popen(
            [str(self.config.rclone), *arguments],
            cwd=str(self.repo_root),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=os.environ.copy(),
        )
        assert process.stdout is not None
        try:
            for raw_line in process.stdout:
                if self.token.is_cancelled:
                    process.terminate()
                    raise CancelledError("任务已取消")
                line = raw_line.strip()
                if line:
                    self.progress(ProgressEvent(stage, line))
            return_code = process.wait()
        finally:
            process.stdout.close()
        if return_code != 0:
            raise AkeToolError(f"rclone 失败，退出码 {return_code}")
