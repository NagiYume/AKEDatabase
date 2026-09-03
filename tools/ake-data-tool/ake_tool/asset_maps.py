from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from .errors import ValidationError
from .image_paths import IMAGE_PROFILE_FULL, IMAGE_PROFILE_STANDARD, normalize_image_profile
from .public_http import public_download_headers


ASSET_MAP_MANIFEST_URL = "https://data.akedata.wiki/map/manifest.json"
ASSET_MAP_SCHEMA_VERSION = 1
_PROFILE_KEYS = {
    IMAGE_PROFILE_STANDARD: "normal",
    IMAGE_PROFILE_FULL: "full",
}
_SAFE_VERSION = re.compile(r"^[0-9A-Za-z._@-]+$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_MAP_UPLOAD_VERSION = re.compile(r"^\d+\.\d+\.\d+@[0-9A-Za-z._-]+$")


def map_profile_key(profile: str) -> str:
    return _PROFILE_KEYS[normalize_image_profile(profile)]


def asset_map_filename(profile: str, version: str) -> str:
    normalized_profile = normalize_image_profile(profile)
    clean_version = str(version).strip()
    if not clean_version or not _SAFE_VERSION.fullmatch(clean_version):
        raise ValidationError(f"Asset map 版本不安全：{version}")
    suffix = "-full" if normalized_profile == IMAGE_PROFILE_FULL else ""
    return f"{clean_version}{suffix}.map"


def validate_map_upload_version(value: str) -> str:
    normalized = str(value).strip()
    if not _MAP_UPLOAD_VERSION.fullmatch(normalized):
        raise ValidationError(
            "Map 上传版本格式无效，应类似 1.2.5@1242134-1"
        )
    return normalized


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(4 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    if not root.is_dir():
        return digest.hexdigest()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(path.stat().st_size).encode("ascii"))
        digest.update(b"\0")
        digest.update(sha256_file(path).encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def validate_map_manifest(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("schemaVersion") != ASSET_MAP_SCHEMA_VERSION:
        raise ValidationError("Asset map manifest schemaVersion 必须为 1")
    profiles = value.get("profiles")
    if not isinstance(profiles, dict):
        raise ValidationError("Asset map manifest 缺少 profiles")
    clean_profiles: dict[str, dict[str, Any]] = {}
    for key, record in profiles.items():
        if key not in _PROFILE_KEYS.values():
            continue
        if not isinstance(record, dict):
            raise ValidationError(f"Asset map manifest 的 {key} profile 格式无效")
        version = str(record.get("version", "")).strip()
        profile = IMAGE_PROFILE_FULL if key == "full" else IMAGE_PROFILE_STANDARD
        expected_file = asset_map_filename(profile, version)
        filename = str(record.get("file", "")).strip()
        if filename != expected_file:
            raise ValidationError(
                f"Asset map manifest 的 {key}.file 无效：应为 {expected_file}"
            )
        try:
            size = int(record.get("size"))
            entry_count = int(record.get("entryCount"))
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"Asset map manifest 的 {key} 数值字段无效") from exc
        sha256 = str(record.get("sha256", "")).strip().lower()
        if size < 0 or entry_count < 0 or not _SHA256.fullmatch(sha256):
            raise ValidationError(f"Asset map manifest 的 {key} 摘要或计数字段无效")
        published_at = str(record.get("publishedAt", "")).strip()
        if not published_at:
            raise ValidationError(f"Asset map manifest 的 {key}.publishedAt 不能为空")
        clean_profiles[key] = {
            "version": version,
            "file": filename,
            "size": size,
            "sha256": sha256,
            "entryCount": entry_count,
            "publishedAt": published_at,
        }
    result = deepcopy(value)
    result["schemaVersion"] = ASSET_MAP_SCHEMA_VERSION
    result["profiles"] = clean_profiles
    return result


@dataclass(frozen=True)
class AssetMapHistory:
    profile: str
    profile_key: str
    manifest_url: str
    bootstrap: bool
    map_path: Path | None = None
    version: str = ""
    filename: str = ""
    size: int = 0
    sha256: str = ""
    entry_count: int = 0
    published_at: str = ""
    source: str = "manifest"


class AssetMapHistoryLoader:
    def __init__(
        self,
        timeout: int,
        manifest_url: str = ASSET_MAP_MANIFEST_URL,
        opener: Callable[..., Any] | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.timeout = timeout
        self.manifest_url = manifest_url
        self.opener = opener or urllib.request.urlopen
        self.clock = clock

    def _read_url(self, url: str) -> bytes:
        separator = "&" if "?" in url else "?"
        request = urllib.request.Request(
            f"{url}{separator}t={int(self.clock() * 1000)}",
            headers=public_download_headers(
                "application/json, application/octet-stream"
            ),
        )
        try:
            with self.opener(request, timeout=self.timeout) as response:
                status = int(getattr(response, "status", 200))
                if status >= 400:
                    raise urllib.error.HTTPError(url, status, "HTTP error", {}, None)
                return response.read()
        except urllib.error.HTTPError:
            raise
        except (OSError, TimeoutError) as exc:
            raise ValidationError(f"Asset map 下载失败：{url}：{exc}") from exc

    def load_many(
        self,
        profiles: Iterable[str],
        cache_root: Path,
    ) -> dict[str, AssetMapHistory]:
        normalized_profiles = tuple(
            dict.fromkeys(normalize_image_profile(profile) for profile in profiles)
        )
        if not normalized_profiles:
            return {}
        try:
            raw_manifest = self._read_url(self.manifest_url)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return {
                    profile: AssetMapHistory(
                        profile,
                        map_profile_key(profile),
                        self.manifest_url,
                        True,
                        source="manifest_404",
                    )
                    for profile in normalized_profiles
                }
            raise ValidationError(
                f"Asset map manifest HTTP {exc.code}，拒绝退化为全量解析"
            ) from exc
        try:
            manifest = validate_map_manifest(json.loads(raw_manifest.decode("utf-8-sig")))
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError("Asset map manifest 不是有效 JSON") from exc

        return {
            profile: self._load_manifest_profile(profile, manifest, cache_root)
            for profile in normalized_profiles
        }

    def load(self, profile: str, cache_root: Path) -> AssetMapHistory:
        normalized_profile = normalize_image_profile(profile)
        return self.load_many((normalized_profile,), cache_root)[normalized_profile]

    def _load_manifest_profile(
        self,
        normalized_profile: str,
        manifest: dict[str, Any],
        cache_root: Path,
    ) -> AssetMapHistory:
        profile_key = map_profile_key(normalized_profile)
        record = manifest["profiles"].get(profile_key)
        if record is None:
            return AssetMapHistory(
                normalized_profile,
                profile_key,
                self.manifest_url,
                True,
                source="profile_missing",
            )
        target = cache_root / profile_key / record["file"]
        if (
            target.is_file()
            and target.stat().st_size == record["size"]
            and sha256_file(target) == record["sha256"]
        ):
            return AssetMapHistory(
                normalized_profile,
                profile_key,
                self.manifest_url,
                False,
                target,
                record["version"],
                record["file"],
                record["size"],
                record["sha256"],
                record["entryCount"],
                record["publishedAt"],
                "validated_cache_hit",
            )
        map_url = urllib.parse.urljoin(self.manifest_url, record["file"])
        try:
            payload = self._read_url(map_url)
        except urllib.error.HTTPError as exc:
            raise ValidationError(
                f"历史 Asset map HTTP {exc.code}，拒绝退化为全量解析"
            ) from exc
        if len(payload) != record["size"]:
            raise ValidationError(
                f"历史 Asset map 大小校验失败：期望 {record['size']}，实际 {len(payload)}"
            )
        digest = hashlib.sha256(payload).hexdigest()
        if digest != record["sha256"]:
            raise ValidationError("历史 Asset map SHA256 校验失败")
        cache_root.mkdir(parents=True, exist_ok=True)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(f".{target.name}.tmp-{os.getpid()}")
        temporary.write_bytes(payload)
        os.replace(temporary, target)
        return AssetMapHistory(
            normalized_profile,
            profile_key,
            self.manifest_url,
            False,
            target,
            record["version"],
            record["file"],
            record["size"],
            record["sha256"],
            record["entryCount"],
            record["publishedAt"],
            "download",
        )


def build_map_manifest_record(
    profile: str,
    version: str,
    path: Path,
    entry_count: int,
    published_at: str | None = None,
) -> dict[str, Any]:
    return {
        "version": version,
        "file": asset_map_filename(profile, version),
        "size": path.stat().st_size,
        "sha256": sha256_file(path),
        "entryCount": int(entry_count),
        "publishedAt": published_at or datetime.now(timezone.utc).isoformat(),
    }
