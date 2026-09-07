from __future__ import annotations

import base64
import hashlib
import json
import os
import queue
import re
import shutil
import subprocess
import threading
import time
import zipfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from .asset_maps import AssetMapHistoryLoader, sha256_file
from .config import TOOL_ROOT, AppConfig
from .downloader import BLOCK_IDS, DownloadManager, entries_for_blocks, safe_target
from .errors import AkeToolError, ValidationError
from .file_copy import (
    assert_no_linked_files,
    copy_file_contents,
    copy_tree_contents,
    is_linked_file,
)
from .hotfix_api import HotfixClient
from .image_paths import (
    IMAGE_PROFILE_FULL,
    IMAGE_PROFILE_STANDARD,
    ImageParsingConfig,
    ImagePathMatcher,
    normalize_image_profile,
)
from .index_crypto import DEFAULT_KEY, INITIAL_KEY, decrypt_index
from .models import (
    CancellationToken,
    DownloadEntry,
    HotfixInfo,
    LatestInfo,
    ProgressCallback,
    ProgressEvent,
    ResourcePart,
    SeedInfo,
    null_progress,
)
from .release import resolve_r2_versions
from .unpacker import format_command
from .vfs_validation_cache import VfsValidationCache, latest_identity


IMAGE_BLOCKS = ("Bundle", "InitialBundle", "BundleManifest")
IMAGE_RUNNER_SOURCE = Path(__file__).with_name("BeyondSdkImageRunner.java")
VFS_KEY_RUNNER_SOURCE = Path(__file__).with_name("BeyondSdkVfsKeyRunner.java")
# beyond-sdk 的 Json 导出前置任务会检查这些 VFS 类型。全部由工具提前准备，
# 避免 SDK 因任一依赖缺失而自行下载资源。
JSON_SDK_BLOCKS = (
    "TableCfg",
    "Json",
    "InitialExtendData",
    "ExtendData",
)
JSON_PUBLISH_DATASETS = (
    "BuffData",
    "LevelData",
    "LevelScriptData",
    "MissionRuntimeAsset",
    "SkillData",
    "SpawnerConfig",
)


def _resolve_json_publish_sources(source_root: Path) -> dict[str, Path]:
    sources: dict[str, Path] = {}
    missing: list[str] = []
    for name in JSON_PUBLISH_DATASETS:
        source = source_root / name
        if not source.is_dir() or not any(path.is_file() for path in source.rglob("*")):
            missing.append(name)
        else:
            sources[name] = source
    if missing:
        raise ValidationError(
            "Json 解析输出缺少发布目标目录或目录为空：" + "、".join(missing)
        )
    return sources


def _load_indexes(root: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for name, key in (("index_main.json", DEFAULT_KEY), ("index_initial.json", INITIAL_KEY)):
        path = root / name
        if not path.is_file():
            raise FileNotFoundError(f"缺少 VFS 索引：{path}")
        _, data, _ = decrypt_index(path.read_text(encoding="utf-8-sig").strip(), hint_key=key)
        results.append(data)
    return results


def _entries(
    indexes: Iterable[dict[str, Any]],
    blocks: Iterable[str] = IMAGE_BLOCKS,
) -> list[DownloadEntry]:
    by_name: dict[str, DownloadEntry] = {}
    for index in indexes:
        for entry in entries_for_blocks(index, blocks):
            by_name[entry.name] = entry
    return sorted(by_name.values(), key=lambda item: item.name.lower())


def _md5(
    path: Path,
    token: CancellationToken,
    progress: Callable[[int, int], None] | None = None,
) -> str:
    digest = hashlib.md5()
    total = path.stat().st_size
    completed = 0
    with path.open("rb") as stream:
        while chunk := stream.read(4 * 1024 * 1024):
            token.raise_if_cancelled()
            digest.update(chunk)
            completed += len(chunk)
            if progress is not None:
                progress(completed, total)
    return digest.hexdigest()


def _matches(
    path: Path,
    entry: DownloadEntry,
    token: CancellationToken,
    verify_md5: bool,
    progress: Callable[[int, int], None] | None = None,
) -> bool:
    if not path.is_file() or (entry.size and path.stat().st_size != entry.size):
        return False
    return not (verify_md5 and entry.md5) or _md5(path, token, progress) == entry.md5


def _delta_export_paths(root: Path) -> list[str]:
    if not root.is_dir():
        return []
    result: list[str] = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root).as_posix()
        parts = relative.split("/")
        if (
            not relative
            or any(part in {"", ".", ".."} for part in parts)
            or "\n" in relative
            or "\r" in relative
        ):
            raise ValidationError(f"差分导出文件路径不安全：{relative}")
        result.append(f"assets/{relative}")
    return sorted(set(result))


def _delta_export_paths_digest(paths: Iterable[str]) -> str:
    payload = json.dumps(sorted(set(paths)), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class ImageAssetPipeline:
    def __init__(
        self,
        config: AppConfig,
        progress: ProgressCallback = null_progress,
        token: CancellationToken | None = None,
        client: HotfixClient | None = None,
        downloader: DownloadManager | None = None,
        image_profile: str = IMAGE_PROFILE_STANDARD,
        image_config: ImageParsingConfig | None = None,
        map_history_loader: AssetMapHistoryLoader | None = None,
    ) -> None:
        self.config = config
        self.progress = progress
        self.token = token or CancellationToken()
        self.vfs_root = config.image_work_root / "VFS"
        self.json_output_root = config.image_work_root / "json-output"
        self.state_path = config.image_work_root / "image-state.json"
        self.client = client or HotfixClient(
            timeout=config.request_timeout,
            appcode=config.appcode,
        )
        self.downloader = downloader or DownloadManager(
            timeout=config.request_timeout,
            retries=config.retries,
            verify_md5=True,
            session=getattr(self.client, "session", None),
        )
        self._latest_plans: dict[tuple[str, ...], dict[str, Any]] = {}
        self._log_path: Path | None = None
        self.image_profile = normalize_image_profile(image_profile)
        self.image_config = image_config or config.image_config(self.image_profile)
        self.image_matcher = ImagePathMatcher(self.image_config)
        self.output_root = config.image_work_root / "output" / self.image_profile
        self.map_history_loader = map_history_loader or AssetMapHistoryLoader(
            timeout=config.request_timeout
        )
        self._active_run_id = ""

    def _emit(
        self,
        stage: str,
        message: str,
        current: int = 0,
        total: int = 0,
        level: str = "info",
    ) -> None:
        event = ProgressEvent(stage, message, current, total, level)
        if self._log_path is not None:
            self._write_log(event)
        self.progress(event)

    def _write_log(self, event: ProgressEvent) -> None:
        if self._log_path is None:
            return
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._log_path.open("a", encoding="utf-8") as stream:
            stream.write(
                f"{timestamp} [{event.level.upper()}] [{event.stage}] {event.message}\n"
            )

    @staticmethod
    def _version_values(latest: LatestInfo) -> dict[str, str]:
        return {
            "image_game_version": latest.seed.game_version,
            "image_seed_version": latest.seed.seed_version,
            "image_hotfix_version": latest.hotfix.res_version,
            "image_main_version": latest.hotfix.parts["main"].version,
            "image_initial_version": latest.hotfix.parts["initial"].version,
        }

    @staticmethod
    def _json_version_values(latest: LatestInfo) -> dict[str, str]:
        return {
            "json_game_version": latest.seed.game_version,
            "json_seed_version": latest.seed.seed_version,
            "json_hotfix_version": latest.hotfix.res_version,
            "json_main_version": latest.hotfix.parts["main"].version,
            "json_initial_version": latest.hotfix.parts["initial"].version,
        }

    @staticmethod
    def _latest_runtime_values(prefix: str, latest: LatestInfo) -> dict[str, str]:
        return {
            f"{prefix}_seed_rand_str": latest.seed.rand_str,
            f"{prefix}_seed_package_path": latest.seed.package_path,
            f"{prefix}_hotfix_url": latest.hotfix.request_url,
        }

    @staticmethod
    def _cached_json_version_values(state: dict[str, Any]) -> dict[str, str]:
        keys = (
            "json_game_version",
            "json_seed_version",
            "json_hotfix_version",
            "json_main_version",
            "json_initial_version",
        )
        values = {key: str(state.get(key, "")).strip() for key in keys}
        if any(not value for value in values.values()):
            raise ValidationError("Json 解析状态缺少已确认的版本信息，请重新执行解析")
        return values

    @staticmethod
    def _cached_image_version_values(
        state: dict[str, Any],
        authorization: dict[str, Any],
    ) -> dict[str, str]:
        version_keys = (
            "image_game_version",
            "image_hotfix_version",
            "image_initial_version",
            "image_main_version",
            "image_seed_version",
        )
        values = {key: str(state.get(key, "")).strip() for key in version_keys}
        if all(values.values()):
            return values

        identity = authorization.get("versionIdentity")
        if isinstance(identity, list) and len(identity) == len(version_keys):
            values = {
                key: str(value).strip()
                for key, value in zip(version_keys, identity)
            }
        if any(not value for value in values.values()):
            raise ValidationError("图片发布授权缺少已确认的版本信息，请重新执行解析")
        return values

    @classmethod
    def _version_identity(cls, latest: LatestInfo) -> tuple[str, ...]:
        values = cls._version_values(latest)
        return tuple(values[key] for key in sorted(values))

    @staticmethod
    def _safe_version(value: str) -> str:
        return re.sub(r"[^0-9A-Za-z._-]+", "_", value).strip("._") or "unknown"

    @staticmethod
    def _metadata_matches(local: DownloadEntry | None, latest: DownloadEntry) -> bool:
        return bool(
            local
            and local.size == latest.size
            and local.md5
            and latest.md5
            and local.md5.lower() == latest.md5.lower()
        )

    def _remove_obsolete_version_directories(
        self,
        parent: Path,
        current_version: str,
        stage: str,
        label: str,
    ) -> None:
        if not parent.is_dir():
            return
        work_root = self.config.image_work_root.resolve()
        resolved_parent = parent.resolve()
        if work_root not in resolved_parent.parents:
            raise ValidationError(f"拒绝清理素材工作目录之外的路径：{resolved_parent}")
        for path in parent.iterdir():
            self.token.raise_if_cancelled()
            if not path.is_dir() or path.name == current_version:
                continue
            self._emit(stage, f"删除旧版本{label}：{path}")
            shutil.rmtree(path)

    def _get_resource_plan(
        self,
        blocks: tuple[str, ...],
        stage: str,
        label: str,
    ) -> dict[str, Any]:
        if blocks in self._latest_plans:
            return self._latest_plans[blocks]
        self.token.raise_if_cancelled()
        self._emit(stage, f"查询官方最新游戏版本与 {label} Hotfix…")
        latest = self.client.get_latest()
        version_name = self._safe_version(latest.hotfix.res_version or latest.seed.seed_version)
        indexes_root = self.config.image_work_root / "indexes"
        cache_parent = self.config.image_work_root / "hotfix-cache"
        self._remove_obsolete_version_directories(indexes_root, version_name, stage, "索引")
        self._remove_obsolete_version_directories(cache_parent, version_name, stage, " Hotfix 缓存")
        index_dir = indexes_root / version_name
        latest_entries: list[DownloadEntry] = []
        entry_parts: dict[str, ResourcePart] = {}
        for part_name in ("main", "initial"):
            self.token.raise_if_cancelled()
            part = latest.hotfix.parts[part_name]
            self._emit(stage, f"下载并解密最新 {part_name} 索引：{part.version}")
            try:
                _, index_data = self.client.download_index(part, index_dir)
            except AkeToolError:
                cached_index = index_dir / f"index_{part_name}.json"
                if not cached_index.is_file():
                    raise
                index_data = json.loads(cached_index.read_text(encoding="utf-8-sig"))
                self._emit(
                    stage,
                    f"最新索引下载失败，使用同一 Hotfix 的本地缓存：{cached_index}",
                )
            for entry in entries_for_blocks(index_data, blocks):
                if not entry.md5:
                    raise ValidationError(f"最新 Hotfix 索引缺少 MD5：{entry.name}")
                latest_entries.append(entry)
                entry_parts[entry.name] = part
        latest_by_name = {entry.name: entry for entry in latest_entries}
        latest_entries = sorted(latest_by_name.values(), key=lambda item: item.name.lower())
        if not latest_entries:
            raise ValidationError(f"最新 Hotfix main/initial 索引中没有 {label} VFS 区块")

        def optional_game_entries(configured_path: str, root: Path, source_label: str) -> dict[str, DownloadEntry]:
            if not configured_path.strip() or not root.is_dir():
                self._emit(
                    stage,
                    f"{source_label} 不存在，跳过本地复用并使用 Hotfix：{configured_path or '未配置'}",
                )
                return {}
            try:
                return {entry.name: entry for entry in _entries(_load_indexes(root), blocks)}
            except (OSError, ValidationError) as exc:
                self._emit(stage, f"{source_label} 索引不可用，改用 Hotfix：{exc}")
                return {}

        streaming_available = bool(self.config.game_streaming_assets_dir.strip()) and self.config.streaming_assets_root.is_dir()
        persistent_available = bool(self.config.game_persistent_dir.strip()) and self.config.persistent_root.is_dir()
        base_by_name = optional_game_entries(
            self.config.game_streaming_assets_dir,
            self.config.streaming_assets_root,
            "StreamingAssets",
        )
        persistent_by_name = optional_game_entries(
            self.config.game_persistent_dir,
            self.config.persistent_root,
            "Persistent",
        )
        cache_root = cache_parent / version_name
        sources: dict[str, tuple[str, Path | None]] = {}
        source_counts = {
            "workspace": 0,
            "streaming": 0,
            "persistent": 0,
            "cache": 0,
            "remote": 0,
        }
        remote_entries: list[DownloadEntry] = []
        for entry in latest_entries:
            streaming_path = (
                safe_target(self.config.streaming_assets_root, entry.name)
                if streaming_available
                else None
            )
            persistent_path = (
                safe_target(self.config.persistent_root, entry.name)
                if persistent_available
                else None
            )
            cached_path = safe_target(cache_root, entry.name)
            if streaming_path is not None and streaming_path.is_file() and self._metadata_matches(
                base_by_name.get(entry.name), entry
            ):
                sources[entry.name] = ("streaming", streaming_path)
                source_counts["streaming"] += 1
            elif persistent_path is not None and persistent_path.is_file() and self._metadata_matches(
                persistent_by_name.get(entry.name), entry
            ):
                sources[entry.name] = ("persistent", persistent_path)
                source_counts["persistent"] += 1
            elif _matches(cached_path, entry, self.token, False):
                sources[entry.name] = ("cache", cached_path)
                source_counts["cache"] += 1
            else:
                sources[entry.name] = ("remote", None)
                source_counts["remote"] += 1
                remote_entries.append(entry)
        plan = {
            "latest": latest,
            "entries": latest_entries,
            "entry_parts": entry_parts,
            "sources": sources,
            "source_counts": source_counts,
            "remote_entries": remote_entries,
            "cache_root": cache_root,
        }
        self._latest_plans[blocks] = plan
        return plan

    def _apply_workspace_vfs_reuse(
        self,
        plan: dict[str, Any],
        stage: str,
        trusted_names: set[str] | None = None,
    ) -> int:
        entries: list[DownloadEntry] = plan["entries"]
        sources: dict[str, tuple[str, Path | None]] = plan["sources"]
        counts: dict[str, int] = plan["source_counts"]
        trusted_names = trusted_names or set()
        reused = 0
        total_entries = len(entries)
        self._emit(
            stage,
            f"应用已使用版本的工作 VFS 缓存：可信复用 {len(trusted_names)} 个文件…",
        )
        for entry in entries:
            self.token.raise_if_cancelled()
            if entry.name not in trusted_names:
                continue
            target = safe_target(self.config.image_work_root, entry.name)
            previous_kind, _ = sources[entry.name]
            if previous_kind != "workspace":
                counts[previous_kind] = max(0, counts[previous_kind] - 1)
                counts["workspace"] += 1
            sources[entry.name] = ("workspace", target)
            reused += 1
        plan["remote_entries"] = [
            entry
            for entry in plan["remote_entries"]
            if sources[entry.name][0] == "remote"
        ]
        self._emit(
            stage,
            f"工作 VFS 缓存应用完成：直接复用 {reused} 个，仍需下载 {counts['remote']} 个",
            total_entries,
            total_entries,
        )
        return reused

    @staticmethod
    def _block_entries(
        entries: Iterable[DownloadEntry],
        block: str,
    ) -> list[DownloadEntry]:
        block_id = BLOCK_IDS[block]
        return [entry for entry in entries if f"/{block_id}/" in f"/{entry.name}"]

    def _prepare_vfs_cache(
        self,
        latest: LatestInfo,
        entries: list[DownloadEntry],
        blocks: tuple[str, ...],
        stage: str,
    ) -> tuple[VfsValidationCache, dict[str, str], set[str], set[str]]:
        cache = VfsValidationCache(self.config)
        identity = latest_identity(latest)
        hit_blocks: set[str] = set()
        trusted_names: set[str] = set()
        for block in blocks:
            self.token.raise_if_cancelled()
            block_entries = self._block_entries(entries, block)
            if cache.trusted(
                block,
                identity,
                self.config.image_work_root,
                self.vfs_root,
                block_entries,
            ):
                hit_blocks.add(block)
                trusted_names.update(entry.name for entry in block_entries)
                self._emit(
                    stage,
                    f"VFS 可信缓存命中：{block}，版本 {identity['seedVersion']}，"
                    f"Hotfix {identity['hotfixVersion']}，跳过 {len(block_entries)} 个文件的 MD5",
                )
            else:
                if cache.records.get(block, {}).get("verified") is True:
                    cache.invalidate(block)
                    cache.persist()
                self._emit(
                    stage,
                    f"VFS 可信缓存未命中：{block}，组装后对最终文件执行一次 MD5",
                )
        return cache, identity, hit_blocks, trusted_names

    def _finish_vfs_cache(
        self,
        cache: VfsValidationCache,
        identity: dict[str, str],
        entries: list[DownloadEntry],
        blocks: tuple[str, ...],
        stage: str,
    ) -> None:
        for block in blocks:
            block_entries = self._block_entries(entries, block)
            cache.stage_verified(
                block,
                identity,
                self.config.image_work_root,
                self.vfs_root,
                len(block_entries),
            )
            self._emit(
                stage,
                f"VFS 区块校验完成并记录：{block}，{len(block_entries)} 个文件",
            )
        self.token.raise_if_cancelled()
        cache.persist()

    def _get_latest_plan(self) -> dict[str, Any]:
        return self._get_resource_plan(IMAGE_BLOCKS, "image_analyze", "图片")

    def _get_json_plan(self) -> dict[str, Any]:
        return self._get_resource_plan(JSON_SDK_BLOCKS, "json_analyze", "Json")

    def _load_state(self) -> dict[str, Any]:
        if not self.state_path.is_file():
            return {}
        try:
            data = json.loads(self.state_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _write_state_data(self, state: dict[str, Any]) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.state_path.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(state, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(self.state_path)

    def _invalidate_profile_authorization(self, reason: str) -> None:
        state = self._load_state()
        profiles = state.get("profiles")
        record = profiles.get(self.image_profile) if isinstance(profiles, dict) else None
        if isinstance(record, dict) and record.get("publishAuthorized"):
            record["publishAuthorized"] = False
            record["invalidReason"] = reason
            record["invalidatedAt"] = datetime.now(timezone.utc).isoformat()
            self._write_state_data(state)

    def _activate_profile(self) -> None:
        state = self._load_state()
        previous = str(state.get("activeImageProfile", ""))
        profiles = state.get("profiles")
        if not isinstance(profiles, dict):
            profiles = {}
            state["profiles"] = profiles
        if previous and previous != self.image_profile:
            previous_record = profiles.get(previous)
            if (
                isinstance(previous_record, dict)
                and previous_record.get("publishAuthorized")
                and not previous_record.get("published")
            ):
                previous_record["publishAuthorized"] = False
                previous_record["invalidReason"] = f"切换到 {self.image_profile} profile 后授权失效"
                previous_record["invalidatedAt"] = datetime.now(timezone.utc).isoformat()
        state["activeImageProfile"] = self.image_profile
        self._write_state_data(state)

    @staticmethod
    def _tree_digest(root: Path) -> str:
        digest = hashlib.sha256()
        if not root.is_dir():
            return digest.hexdigest()
        for path in sorted((item for item in root.rglob("*") if item.is_file())):
            relative = path.relative_to(root).as_posix()
            digest.update(relative.encode("utf-8"))
            digest.update(b"\0")
            digest.update(str(path.stat().st_size).encode("ascii"))
            digest.update(b"\0")
            digest.update(sha256_file(path).encode("ascii"))
            digest.update(b"\n")
        return digest.hexdigest()

    def _cached_latest_from_state(
        self,
        prefix: str,
        completed_key: str,
        missing_message: str,
    ) -> LatestInfo:
        state = self._load_state()
        if not state.get(completed_key):
            raise ValidationError(missing_message)

        version_values = {
            "game": str(state.get(f"{prefix}_game_version", "")).strip(),
            "seed": str(state.get(f"{prefix}_seed_version", "")).strip(),
            "hotfix": str(state.get(f"{prefix}_hotfix_version", "")).strip(),
            "main": str(state.get(f"{prefix}_main_version", "")).strip(),
            "initial": str(state.get(f"{prefix}_initial_version", "")).strip(),
        }
        if any(not value for value in version_values.values()):
            raise ValidationError(f"{prefix} 状态缺少已确认的版本信息，请重新执行分析与准备")

        for plan in self._latest_plans.values():
            latest = plan.get("latest")
            if not isinstance(latest, LatestInfo):
                continue
            cached = (
                self._version_values(latest)
                if prefix == "image"
                else self._json_version_values(latest)
            )
            if all(str(state.get(key, "")) == value for key, value in cached.items()):
                return latest

        package_path = str(state.get(f"{prefix}_seed_package_path", "")).strip()
        hotfix_url = str(state.get(f"{prefix}_hotfix_url", "")).strip()
        if not package_path or not hotfix_url:
            raise ValidationError(
                f"{prefix} 状态缺少已缓存的 Seed/Hotfix 运行参数，请重新执行分析与准备"
            )
        return LatestInfo(
            seed=SeedInfo(
                game_version=version_values["game"],
                seed_version=version_values["seed"],
                rand_str=str(state.get(f"{prefix}_seed_rand_str", "")),
                package_path=package_path,
            ),
            hotfix=HotfixInfo(
                request_url=hotfix_url,
                res_version=version_values["hotfix"],
                parts={
                    "main": ResourcePart("main", "", version_values["main"]),
                    "initial": ResourcePart("initial", "", version_values["initial"]),
                },
            ),
        )

    def _require_latest_state(self, completed_key: str) -> LatestInfo:
        return self._cached_latest_from_state(
            "image",
            completed_key,
            "缺少已完成的最新图片步骤状态，请先重新合并并解析图片 VFS",
        )

    def _require_json_latest_state(self, completed_key: str) -> LatestInfo:
        return self._cached_latest_from_state(
            "json",
            completed_key,
            "缺少已完成的 Json VFS 准备状态，请先准备并校验 775A31D1",
        )

    def _download_progress(self, event: ProgressEvent) -> None:
        self._emit(
            "image_prepare",
            f"Hotfix：{event.message}",
            event.current,
            event.total,
            event.level,
        )

    def _json_download_progress(self, event: ProgressEvent) -> None:
        self._emit(
            "json_prepare",
            f"Hotfix：{event.message}",
            event.current,
            event.total,
            event.level,
        )

    def run_steps(self, stages: Iterable[str]) -> dict[str, Any]:
        stages = list(stages)
        if any(stage.startswith("image_") for stage in stages):
            self._active_run_id = uuid.uuid4().hex
            self._activate_profile()
        if stages:
            if all(stage.startswith("json_") for stage in stages):
                log_prefix = "json-job"
            elif all(stage.startswith("image_") for stage in stages):
                log_prefix = "image-job"
            else:
                log_prefix = "asset-job"
            log_stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
            self._log_path = TOOL_ROOT / "logs" / f"{log_prefix}-{log_stamp}.log"
            first_stage = stages[0]
            self._emit(first_stage, f"日志文件：{self._log_path}")
        allowed = {
            "image_analyze",
            "image_prepare",
            "image_extract",
            "image_publish",
            "json_analyze",
            "json_prepare",
            "json_extract",
            "json_publish",
        }
        result: dict[str, Any] = {}
        try:
            for stage in stages:
                if stage not in allowed:
                    raise ValidationError(f"未知素材流程步骤：{stage}")
                self.token.raise_if_cancelled()
                if stage == "image_analyze":
                    result.update(self.analyze())
                elif stage == "image_prepare":
                    result.update(self.prepare_vfs())
                elif stage == "image_extract":
                    result.update(self.extract())
                elif stage == "image_publish":
                    result.update(self.publish())
                elif stage == "json_analyze":
                    result.update(self.analyze_json())
                elif stage == "json_prepare":
                    result.update(self.prepare_json_vfs())
                elif stage == "json_extract":
                    result.update(self.extract_json())
                elif stage == "json_publish":
                    result.update(self.publish_json())
                result["last_stage"] = stage
                if stage.startswith("image_"):
                    result.update(
                        {
                            "image_profile": self.image_profile,
                            "image_config_digest": self.image_config.digest(),
                            "image_run_id": self._active_run_id,
                        }
                    )
                self._save_state(result)
        except Exception as exc:
            failed_stage = stage if "stage" in locals() else "asset"
            if failed_stage == "image_publish":
                self._invalidate_profile_authorization(f"发布失败：{exc}")
            self._write_log(ProgressEvent(failed_stage, f"任务失败：{exc}", level="error"))
            raise
        if self._log_path is not None:
            result["log_path"] = str(self._log_path)
        return result

    def analyze(self) -> dict[str, Any]:
        self.config.validate_images(require_sources=True)
        plan = self._get_latest_plan()
        latest: LatestInfo = plan["latest"]
        latest_entries: list[DownloadEntry] = plan["entries"]
        counts: dict[str, int] = plan["source_counts"]
        remote_entries: list[DownloadEntry] = plan["remote_entries"]
        total_bytes = sum(entry.size for entry in latest_entries)
        result = {
            "image_file_count": len(latest_entries),
            "image_total_bytes": total_bytes,
            "image_base_reused": counts["streaming"],
            "image_patch_files": counts["persistent"],
            "image_hotfix_cache_files": counts["cache"],
            "image_remote_files": counts["remote"],
            "image_remote_bytes": sum(entry.size for entry in remote_entries),
            "image_blocks": list(IMAGE_BLOCKS),
            "image_vfs_path": str(self.vfs_root),
            "image_output_path": str(self.output_root),
            **self._latest_runtime_values("image", latest),
            **self._version_values(latest),
        }
        self._emit(
            "image_analyze",
            f"最新版本分析完成：游戏 {latest.seed.game_version}，Seed {latest.seed.seed_version}，"
            f"Hotfix {latest.hotfix.res_version}；{len(latest_entries)} 个文件，"
            f"本体复用 {counts['streaming']}，Persistent 复用 {counts['persistent']}，"
            f"Hotfix 缓存复用 {counts['cache']}，需下载 {counts['remote']}",
            len(latest_entries),
            len(latest_entries),
        )
        return result

    def analyze_json(self) -> dict[str, Any]:
        self.config.validate_images(require_sources=True)
        plan = self._get_json_plan()
        latest: LatestInfo = plan["latest"]
        latest_entries: list[DownloadEntry] = plan["entries"]
        counts: dict[str, int] = plan["source_counts"]
        remote_entries: list[DownloadEntry] = plan["remote_entries"]
        total_bytes = sum(entry.size for entry in latest_entries)
        result = {
            "json_file_count": len(latest_entries),
            "json_total_bytes": total_bytes,
            "json_base_reused": counts["streaming"],
            "json_patch_files": counts["persistent"],
            "json_hotfix_cache_files": counts["cache"],
            "json_remote_files": counts["remote"],
            "json_remote_bytes": sum(entry.size for entry in remote_entries),
            "json_block": BLOCK_IDS["Json"],
            "json_cache_path": str(self.config.image_work_root),
            "json_vfs_path": str(self.vfs_root / BLOCK_IDS["Json"]),
            "json_output_path": str(self.json_output_root),
            **self._latest_runtime_values("json", latest),
            **self._json_version_values(latest),
        }
        self._emit(
            "json_analyze",
            f"Json 分析完成：游戏 {latest.seed.game_version}，Hotfix {latest.hotfix.res_version}；"
            f"{len(latest_entries)} 个文件，需下载 {counts['remote']} 个",
            len(latest_entries),
            len(latest_entries),
        )
        return result

    def prepare_vfs(self) -> dict[str, Any]:
        info = self.analyze()
        plan = self._get_latest_plan()
        latest: LatestInfo = plan["latest"]
        latest_entries: list[DownloadEntry] = plan["entries"]
        latest_by_name = {entry.name: entry for entry in latest_entries}
        entry_parts: dict[str, ResourcePart] = plan["entry_parts"]
        sources: dict[str, tuple[str, Path | None]] = plan["sources"]
        cache_root: Path = plan["cache_root"]
        self.vfs_root.mkdir(parents=True, exist_ok=True)
        vfs_cache, vfs_identity, vfs_hit_blocks, vfs_trusted_names = self._prepare_vfs_cache(
            latest,
            latest_entries,
            IMAGE_BLOCKS,
            "image_prepare",
        )
        reused = self._apply_workspace_vfs_reuse(
            plan,
            "image_prepare",
            vfs_trusted_names,
        )
        info["image_work_vfs_reused"] = reused
        info["image_remote_files"] = plan["source_counts"]["remote"]
        info["image_remote_bytes"] = sum(
            entry.size for entry in plan["remote_entries"]
        )

        remote_by_part: dict[str, list[DownloadEntry]] = {"main": [], "initial": []}
        for entry in plan["remote_entries"]:
            remote_by_part[entry_parts[entry.name].name].append(entry)
        for part_name, entries in remote_by_part.items():
            if not entries:
                continue
            part = latest.hotfix.parts[part_name]
            self._emit(
                "image_prepare",
                f"从最新 Hotfix {part_name} 下载 {len(entries)} 个本地缺失或过期文件…",
            )
            self.downloader.download_entries(
                part.path,
                entries,
                cache_root,
                self.token,
                self._download_progress,
                verify_md5=False,
            )

        self._emit("image_prepare", "按最新 Hotfix 索引组装图片 VFS…")
        for index, entry in enumerate(latest_entries, 1):
            self.token.raise_if_cancelled()
            target = safe_target(self.config.image_work_root, entry.name)
            planned_kind, planned_source = sources[entry.name]
            if (
                planned_kind == "workspace"
                and planned_source == target
            ):
                source_kind = "工作 VFS 复用"
            else:
                source_kind, local_source = planned_kind, planned_source
                source = (
                    safe_target(cache_root, entry.name)
                    if source_kind == "remote"
                    else local_source
                )
                if source is None or not source.is_file():
                    raise FileNotFoundError(f"无法定位最新图片 VFS 文件：{entry.name}")
                self._materialize(source, target, allow_size_skip=False)
            self._emit(
                "image_prepare",
                f"组装 [{index}/{len(latest_entries)}] [{source_kind}] {entry.name}",
                index,
                len(latest_entries),
            )

        expected_targets = {
            (self.vfs_root / Path(name).relative_to("VFS")).resolve()
            for name in latest_by_name
        }
        for block in IMAGE_BLOCKS:
            block_id = BLOCK_IDS[block]
            block_root = self.vfs_root / block_id
            if block_root.is_dir():
                for path in block_root.iterdir():
                    if path.is_file() and path.resolve() not in expected_targets:
                        path.unlink()

        self._emit("image_prepare", "按官方最新 Hotfix 索引校验合并后的 VFS…")
        for block in IMAGE_BLOCKS:
            block_entries = self._block_entries(latest_entries, block)
            if block in vfs_hit_blocks:
                continue
            for entry in block_entries:
                self.token.raise_if_cancelled()
                target = self.vfs_root / Path(entry.name).relative_to("VFS")
                if not _matches(target, entry, self.token, True):
                    raise ValidationError(f"合并后文件校验失败：{target}")
                self._emit(
                    "image_prepare",
                    f"校验 {entry.name}",
                    0,
                    0,
                )
        self._finish_vfs_cache(
            vfs_cache,
            vfs_identity,
            latest_entries,
            IMAGE_BLOCKS,
            "image_prepare",
        )
        info["image_prepared"] = True
        info["image_prepared_hotfix_version"] = latest.hotfix.res_version
        return info

    def prepare_json_vfs(self) -> dict[str, Any]:
        info = self.analyze_json()
        plan = self._get_json_plan()
        latest: LatestInfo = plan["latest"]
        latest_entries: list[DownloadEntry] = plan["entries"]
        entry_parts: dict[str, ResourcePart] = plan["entry_parts"]
        sources: dict[str, tuple[str, Path | None]] = plan["sources"]
        cache_root: Path = plan["cache_root"]
        self.vfs_root.mkdir(parents=True, exist_ok=True)
        vfs_cache, vfs_identity, vfs_hit_blocks, vfs_trusted_names = self._prepare_vfs_cache(
            latest,
            latest_entries,
            JSON_SDK_BLOCKS,
            "json_prepare",
        )
        reused = self._apply_workspace_vfs_reuse(
            plan,
            "json_prepare",
            vfs_trusted_names,
        )
        info["json_work_vfs_reused"] = reused
        info["json_remote_files"] = plan["source_counts"]["remote"]
        info["json_remote_bytes"] = sum(
            entry.size for entry in plan["remote_entries"]
        )

        remote_by_part: dict[str, list[DownloadEntry]] = {"main": [], "initial": []}
        for entry in plan["remote_entries"]:
            remote_by_part[entry_parts[entry.name].name].append(entry)
        for part_name, entries in remote_by_part.items():
            if not entries:
                continue
            part = latest.hotfix.parts[part_name]
            self._emit(
                "json_prepare",
                f"SDK 启动前从最新 Hotfix {part_name} 补齐 {len(entries)} 个 VFS 文件…",
            )
            self.downloader.download_entries(
                part.path,
                entries,
                cache_root,
                self.token,
                self._json_download_progress,
                verify_md5=False,
            )

        self._emit("json_prepare", "在 SDK 启动前组装 Json 解析所需的完整 VFS…")
        for index, entry in enumerate(latest_entries, 1):
            self.token.raise_if_cancelled()
            target = safe_target(self.config.image_work_root, entry.name)
            planned_kind, planned_source = sources[entry.name]
            if (
                planned_kind == "workspace"
                and planned_source == target
            ):
                source_kind = "工作 VFS 复用"
            else:
                source_kind, local_source = planned_kind, planned_source
                source = safe_target(cache_root, entry.name) if source_kind == "remote" else local_source
                if source is None or not source.is_file():
                    raise FileNotFoundError(f"无法定位 Json 解析所需 VFS 文件：{entry.name}")
                self._materialize(source, target, allow_size_skip=False)
            self._emit(
                "json_prepare",
                f"准备 [{index}/{len(latest_entries)}] [{source_kind}] {entry.name}",
                index,
                len(latest_entries),
            )

        expected_targets = {
            (self.vfs_root / Path(entry.name).relative_to("VFS")).resolve()
            for entry in latest_entries
        }
        for block in JSON_SDK_BLOCKS:
            block_root = self.vfs_root / BLOCK_IDS[block]
            if not block_root.is_dir():
                continue
            for path in block_root.iterdir():
                if path.is_file() and path.resolve() not in expected_targets:
                    path.unlink()

        self._emit("json_prepare", "逐个校验 SDK 所需 VFS 文件的大小与 MD5…")
        for block in JSON_SDK_BLOCKS:
            block_entries = self._block_entries(latest_entries, block)
            if block in vfs_hit_blocks:
                continue
            for entry in block_entries:
                self.token.raise_if_cancelled()
                target = self.vfs_root / Path(entry.name).relative_to("VFS")
                if not _matches(target, entry, self.token, True):
                    raise ValidationError(f"SDK 启动前 VFS 文件校验失败：{target}")
                self._emit("json_prepare", f"校验 {entry.name}", 0, 0)
        self._finish_vfs_cache(
            vfs_cache,
            vfs_identity,
            latest_entries,
            JSON_SDK_BLOCKS,
            "json_prepare",
        )

        json_block_root = self.vfs_root / BLOCK_IDS["Json"]
        json_block_entries = [
            entry for entry in latest_entries if f"/{BLOCK_IDS['Json']}/" in f"/{entry.name}"
        ]
        if not json_block_root.is_dir() or not json_block_entries:
            raise ValidationError(f"SDK 启动前缺少 Json 输入目录：{json_block_root}")
        info.update(
            {
                "json_prepared": True,
                "json_prepared_files": len(latest_entries),
                "json_block_files": len(json_block_entries),
                "json_prepared_hotfix_version": latest.hotfix.res_version,
            }
        )
        return info

    def _verify_json_sdk_inputs(self, plan: dict[str, Any]) -> int:
        entries: list[DownloadEntry] = plan["entries"]
        json_block_id = BLOCK_IDS["Json"]
        json_count = 0
        if not VfsValidationCache.files_match(self.vfs_root, entries):
            raise ValidationError("拒绝启动 SDK：Json 解析所需文件缺失或大小不符")
        for entry in entries:
            if f"/{json_block_id}/" in f"/{entry.name}":
                json_count += 1
        json_root = self.vfs_root / json_block_id
        if json_count == 0 or not json_root.is_dir():
            raise ValidationError(f"拒绝启动 SDK：Json 输入路径不正确：{json_root}")
        return json_count

    def _prepare_json_sdk_indexes(self, state: dict[str, Any]) -> None:
        hotfix_version = str(state.get("json_hotfix_version", "")).strip()
        if not hotfix_version:
            raise ValidationError("Json 准备状态中缺少 Hotfix 版本，请重新执行前两步")
        index_dir = (
            self.config.image_work_root
            / "indexes"
            / self._safe_version(hotfix_version)
        )
        for part_name in ("main", "initial"):
            source = index_dir / f"index_{part_name}.json"
            if not source.is_file():
                raise FileNotFoundError(
                    f"SDK 启动前缺少已分析的 {part_name} 索引：{source}"
                )
            try:
                payload = json.loads(source.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise ValidationError(f"无法读取已分析的 {part_name} 索引：{source}") from exc
            if not isinstance(payload, dict):
                raise ValidationError(f"已分析的 {part_name} 索引格式不正确：{source}")
            part_version = str(state.get(f"json_{part_name}_version", "")).strip()
            if not part_version:
                raise ValidationError(
                    f"Json 准备状态中缺少 {part_name} 版本，请重新执行前两步"
                )
            payload["version"] = part_version
            payload["isInitial"] = part_name == "initial"
            target = self.config.image_work_root / source.name
            temporary = target.with_suffix(".json.tmp")
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            temporary.replace(target)
        self._emit(
            "json_extract",
            "已将前两步的 main/initial 索引写入 SDK 缓存根目录，"
            "exportJsonData 将比较后复用现有 .chk。",
        )

    def _json_sdk_target(self) -> str:
        try:
            with zipfile.ZipFile(self.config.image_sdk) as archive:
                class_names = [
                    name
                    for name in archive.namelist()
                    if name.endswith(".class")
                    and any(token in name for token in ("VFS", "Vfs", "Json"))
                ]
                supports_export = False
                for name in class_names:
                    content = archive.read(name)
                    if b"unpackJson" in content:
                        return "unpackJson"
                    if b"exportJsonData" in content:
                        supports_export = True
                if supports_export:
                    return "exportJsonData"
        except (OSError, KeyError, zipfile.BadZipFile) as exc:
            raise ValidationError(
                f"无法读取 beyond-sdk.jar 任务信息：{self.config.image_sdk}"
            ) from exc
        raise ValidationError(
            "当前 beyond-sdk.jar 未提供 unpackJson 或 exportJsonData 任务"
        )

    def extract_json(self) -> dict[str, Any]:
        self.config.validate_images(require_sources=False)
        latest = self._require_json_latest_state("json_prepared_hotfix_version")
        if not self.config.image_sdk.is_file():
            raise FileNotFoundError(f"beyond-sdk.jar 不存在：{self.config.image_sdk}")

        state = self._load_state()
        json_count = int(state.get("json_block_files", 0))
        json_input_root = self.vfs_root / BLOCK_IDS["Json"]
        if not state.get("json_prepared") or json_count <= 0 or not json_input_root.is_dir():
            raise ValidationError(
                "Json 前两步的准备状态不完整，请先单步执行索引分析和 VFS 准备"
            )
        self._emit(
            "json_extract",
            "已读取前两步的完成状态，跳过索引重新分析和逐文件校验。",
        )
        self._assert_vfs_is_independent()
        self._prepare_json_sdk_indexes(state)
        if self.json_output_root.exists():
            resolved = self.json_output_root.resolve()
            if self.config.image_work_root.resolve() not in resolved.parents:
                raise ValidationError(f"拒绝清理工作目录之外的路径：{resolved}")
            self._emit("json_extract", f"清理上次 Json 解析输出：{resolved}")
            shutil.rmtree(resolved)
        self.json_output_root.mkdir(parents=True, exist_ok=True)

        sdk_target = self._json_sdk_target()
        command = [
            self.config.java_path,
            "-Xmx32G",
            "--enable-native-access=ALL-UNNAMED",
            "-jar",
            str(self.config.image_sdk),
            "vfs",
            str(self.config.image_work_root),
            str(self.json_output_root),
            sdk_target,
            "--no-vfs-update",
        ]
        if sdk_target == "exportJsonData":
            command.extend(("--json-export-parallelism", "1"))
        self._emit(
            "json_extract",
            f"已准备并校验 {json_count} 个 775A31D1 文件，"
            f"启动 beyond-sdk {sdk_target}…",
        )
        self._emit("json_extract", f"执行命令：{format_command(command)}")
        started = time.monotonic()
        process = subprocess.Popen(
            command,
            cwd=self.config.image_sdk.parent,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        lines: queue.Queue[str | None] = queue.Queue()

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:
                lines.put(line.rstrip())
            lines.put(None)

        threading.Thread(target=read_output, daemon=True).start()
        reader_finished = False
        try:
            while process.poll() is None or not reader_finished:
                if self.token.is_cancelled:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    self.token.raise_if_cancelled()
                try:
                    line = lines.get(timeout=0.2)
                    if line is None:
                        reader_finished = True
                    elif line:
                        self._emit("json_extract", line)
                except queue.Empty:
                    pass
            if process.returncode:
                raise AkeToolError(
                    f"beyond-sdk.jar Json 解析失败，退出码 {process.returncode}"
                )
        finally:
            if process.poll() is None:
                process.kill()

        elapsed = time.monotonic() - started
        try:
            json_source_root = self._json_publish_source_root()
        except ValidationError as exc:
            raise ValidationError(
                "beyond-sdk.jar 已结束，但没有生成包含文件的 Json 数据目录；"
                f"本次使用的 SDK 任务为 {sdk_target}"
            ) from exc
        output_files = sum(1 for path in json_source_root.rglob("*") if path.is_file())
        assert_no_linked_files(self.json_output_root, "Json 解析输出")
        self._emit(
            "json_extract",
            f"Json 解析完成：{output_files} 个文件，耗时 {elapsed / 60:.1f} 分钟",
        )
        return {
            "json_extracted_files": output_files,
            "json_extract_seconds": round(elapsed, 2),
            "json_output_path": str(self.json_output_root),
            "json_content_path": str(json_source_root),
            "json_input_path": str(json_input_root),
            "json_sdk_target": sdk_target,
            "json_extracted_hotfix_version": latest.hotfix.res_version,
            **self._json_version_values(latest),
        }

    def _json_publish_source_root(self) -> Path:
        candidates = (
            self.json_output_root / "data" / "Json",
            self.json_output_root / "data" / "Data" / "Json",
            self.json_output_root / "data",
            self.json_output_root / "Json",
            self.json_output_root / "Data" / "Json",
            self.json_output_root,
        )
        for candidate in candidates:
            if not candidate.is_dir():
                continue
            if any(path.is_file() for path in candidate.rglob("*")):
                return candidate
        expected = "、".join(str(path) for path in candidates)
        raise ValidationError(f"Json 解析输出中未找到包含文件的数据目录，已检查：{expected}")

    def publish_json(self) -> dict[str, Any]:
        state = self._load_state()
        if not state.get("json_extracted_hotfix_version"):
            raise ValidationError("缺少已完成的 Json 解析状态，请先重新解析 Json")
        version_values = self._cached_json_version_values(state)
        source_root = self._json_publish_source_root().resolve()
        output_root = self.json_output_root.resolve()
        if source_root != output_root and output_root not in source_root.parents:
            raise ValidationError(f"拒绝发布工作目录之外的 Json 输出：{source_root}")

        public_json_root = (self.config.public_root / "Json").resolve()
        if not public_json_root.is_dir():
            raise FileNotFoundError(f"public/Json 不存在：{public_json_root}")
        matched_sources = _resolve_json_publish_sources(source_root)

        staging_root = (self.config.public_root / ".ake-json-publish-staging").resolve()
        public_root = self.config.public_root.resolve()
        if public_root not in staging_root.parents:
            raise ValidationError(f"拒绝使用 public 之外的发布工作目录：{staging_root}")
        if staging_root.exists():
            shutil.rmtree(staging_root)
        staging_root.mkdir(parents=True)

        total_files = 0
        try:
            for name, source in sorted(matched_sources.items()):
                self.token.raise_if_cancelled()
                staged = staging_root / name
                file_count = copy_tree_contents(source, staged, self.token)
                if file_count == 0:
                    raise ValidationError(f"Json 输出目录为空，拒绝发布：{source}")
                total_files += file_count
                self._emit("json_publish", f"已暂存 {name}：{file_count} 个文件")

            for index, name in enumerate(sorted(matched_sources), 1):
                self.token.raise_if_cancelled()
                target = public_json_root / name
                staged = staging_root / name
                if target.exists():
                    shutil.rmtree(target)
                os.replace(staged, target)
                assert_no_linked_files(target, f"public/Json/{name}")
                self._emit(
                    "json_publish",
                    f"发布 [{index}/{len(matched_sources)}] public/Json/{name}",
                    index,
                    len(matched_sources),
                )
        finally:
            if staging_root.exists():
                shutil.rmtree(staging_root)

        self._emit(
            "json_publish",
            f"Json 发布完成：{len(matched_sources)} 个对应目录，{total_files} 个文件",
        )
        return {
            "json_published_directories": sorted(matched_sources),
            "json_published_files": total_files,
            "json_publish_source": str(source_root),
            "json_published_hotfix_version": version_values["json_hotfix_version"],
            **version_values,
        }

    def _assert_vfs_is_independent(self) -> None:
        assert_no_linked_files(self.vfs_root, "工作 VFS")

    def _materialize(self, source: Path, target: Path, allow_size_skip: bool) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        if (
            allow_size_skip
            and target.is_file()
            and not is_linked_file(target)
            and target.stat().st_size == source.stat().st_size
        ):
            return
        copy_file_contents(source, target, self.token)

    def _resolve_vfs_key(
        self,
        latest: LatestInfo,
        runtime_root: Path,
    ) -> str:
        cache_path = runtime_root / ".vfs-key.json"
        game_assembly = runtime_root / "GameAssembly.dll"
        if cache_path.is_file() and game_assembly.is_file():
            try:
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                assembly_stat = game_assembly.stat()
                candidate = str(cached["key"])
                decoded = base64.b64decode(candidate, validate=True)
                if (
                    len(decoded) == 32
                    and int(cached["game_assembly_size"]) == assembly_stat.st_size
                    and int(cached["game_assembly_mtime_ns"]) == assembly_stat.st_mtime_ns
                ):
                    self._emit("image_extract", f"使用已缓存的 VFS key：{cache_path}")
                    return candidate
            except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError):
                pass

        if not VFS_KEY_RUNNER_SOURCE.is_file():
            raise FileNotFoundError(f"beyond-sdk VFS key 启动器不存在：{VFS_KEY_RUNNER_SOURCE}")
        command = [
            self.config.java_path,
            "--enable-native-access=ALL-UNNAMED",
            "--class-path",
            str(self.config.image_sdk),
            str(VFS_KEY_RUNNER_SOURCE),
            str(self.vfs_root),
            str(runtime_root),
            latest.seed.seed_version,
            latest.seed.package_path,
        ]
        self._emit("image_extract", f"隔离获取 VFS key：{format_command(command)}")
        process = subprocess.Popen(
            command,
            cwd=self.config.image_sdk.parent,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        lines: queue.Queue[str | None] = queue.Queue()

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:
                lines.put(line.rstrip())
            lines.put(None)

        threading.Thread(target=read_output, daemon=True).start()
        encoded_key: str | None = None
        try:
            while encoded_key is None:
                if self.token.is_cancelled:
                    self.token.raise_if_cancelled()
                try:
                    line = lines.get(timeout=0.2)
                except queue.Empty:
                    if process.poll() is not None:
                        break
                    continue
                if line is None:
                    break
                if line.startswith("VFS_KEY_BASE64="):
                    candidate = line.removeprefix("VFS_KEY_BASE64=").strip()
                    try:
                        decoded = base64.b64decode(candidate, validate=True)
                    except ValueError as exc:
                        raise AkeToolError("beyond-sdk 返回了无效的 VFS key") from exc
                    if len(decoded) != 32:
                        raise AkeToolError(f"beyond-sdk 返回的 VFS key 长度错误：{len(decoded)}")
                    encoded_key = candidate
                elif line:
                    self._emit("image_extract", line)
        finally:
            if process.poll() is None:
                process.kill()
            process.wait()
        if encoded_key is None:
            raise AkeToolError(f"beyond-sdk 未返回 VFS key，退出码 {process.returncode}")
        assembly_stat = game_assembly.stat()
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = cache_path.with_name(f".{cache_path.name}.tmp-{os.getpid()}")
        temporary.write_text(
            json.dumps(
                {
                    "game_assembly_size": assembly_stat.st_size,
                    "game_assembly_mtime_ns": assembly_stat.st_mtime_ns,
                    "key": encoded_key,
                },
                ensure_ascii=True,
                indent=2,
            ),
            encoding="utf-8",
        )
        os.replace(temporary, cache_path)
        return encoded_key

    def extract(self) -> dict[str, Any]:
        self.config.validate_images(require_sources=False)
        latest = self._require_latest_state("image_prepared")
        if not self.config.image_sdk.is_file():
            raise FileNotFoundError(f"beyond-sdk.jar 不存在：{self.config.image_sdk}")
        if not self.vfs_root.is_dir():
            raise FileNotFoundError(f"尚未准备图片 VFS：{self.vfs_root}")
        if not IMAGE_RUNNER_SOURCE.is_file():
            raise FileNotFoundError(f"beyond-sdk 图片本地启动器不存在：{IMAGE_RUNNER_SOURCE}")
        runtime_root = (
            self.config.image_work_root
            / "il2cpp-host-runtime"
            / latest.seed.game_version
        )
        self._assert_vfs_is_independent()
        encoded_vfs_key = self._resolve_vfs_key(latest, runtime_root)
        game_version, hotfix_main_version = resolve_r2_versions(latest)
        asset_version = f"{game_version}@{hotfix_main_version}"
        self._emit(
            "image_extract",
            f"增量模式：profile={self.image_profile}，版本={asset_version}，"
            f"manifest={self.map_history_loader.manifest_url}",
        )
        history_profiles = (
            (IMAGE_PROFILE_FULL, IMAGE_PROFILE_STANDARD)
            if self.image_profile == IMAGE_PROFILE_FULL
            else (self.image_profile,)
        )
        history_by_profile = self.map_history_loader.load_many(
            history_profiles,
            self.config.image_work_root / "map-cache",
        )
        history = history_by_profile[self.image_profile]
        comparison_histories = tuple(
            item for item in history_by_profile.values() if not item.bootstrap
        )
        comparison_bootstrap = not comparison_histories
        for item in history_by_profile.values():
            if item.bootstrap:
                self._emit(
                    "image_extract",
                    f"{item.profile_key} 历史 map 不存在（{item.source}）",
                )
                continue
            self._emit(
                "image_extract",
                f"{item.profile_key} 历史 map：{item.filename}，版本 {item.version}，"
                f"条目 {item.entry_count}，SHA256 {item.sha256}",
            )
            self._emit(
                "image_extract",
                (
                    f"{item.profile_key} 历史 map 缓存命中并通过 manifest 校验：{item.map_path}"
                    if item.source == "validated_cache_hit"
                    else f"{item.profile_key} 历史 map 缓存未命中，已下载校验并缓存：{item.map_path}"
                ),
            )
        if comparison_bootstrap:
            self._emit(
                "image_extract",
                "所有比对用历史 map 均不存在，首次引导将导出完整当前 map",
            )
        elif self.image_profile == IMAGE_PROFILE_FULL:
            compared = " + ".join(item.profile_key for item in comparison_histories)
            self._emit(
                "image_extract",
                f"全量差分将使用联合历史 hash：{compared}",
            )

        run_root = (
            self.config.image_work_root
            / "image-runs"
            / self.image_profile
            / self._active_run_id
        ).resolve()
        work_root = self.config.image_work_root.resolve()
        if work_root not in run_root.parents:
            raise ValidationError(f"图片运行目录不安全：{run_root}")
        if run_root.exists():
            shutil.rmtree(run_root)
        delta_output = run_root / "delta-output"
        delta_output.mkdir(parents=True, exist_ok=True)
        remote_map = run_root / "assets.remote.map"
        containers_filter = self.image_config.image_containers_filter
        started = time.monotonic()
        command = [
            self.config.java_path,
            "-Xmx32G",
            "--enable-native-access=ALL-UNNAMED",
            "--class-path",
            str(self.config.image_sdk),
            str(IMAGE_RUNNER_SOURCE),
            str(self.vfs_root),
            str(run_root),
            str(delta_output),
            containers_filter,
            str(history.map_path) if history.map_path else "-",
            str(remote_map),
            str(history.entry_count if history.map_path else 0),
        ]
        if self.image_profile == IMAGE_PROFILE_FULL:
            standard_history = history_by_profile[IMAGE_PROFILE_STANDARD]
            command.extend(
                [
                    str(standard_history.map_path) if standard_history.map_path else "-",
                    str(standard_history.entry_count if standard_history.map_path else 0),
                ]
            )
        self._emit("image_extract", f"containers_filter：{containers_filter}")
        self._emit("image_extract", f"执行命令：{format_command(command)}")
        self._emit("image_extract", "启动 beyond-sdk.jar：一次构图、一次原生 map 差分、最多一次导出…")
        process_env = os.environ.copy()
        process_env["PERLICA_VFS_KEY_BASE64"] = encoded_vfs_key
        process = subprocess.Popen(
            command,
            cwd=self.config.image_sdk.parent,
            env=process_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        lines: queue.Queue[str | None] = queue.Queue()
        metrics: dict[str, int] | None = None

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:
                lines.put(line.rstrip())
            lines.put(None)

        threading.Thread(target=read_output, daemon=True).start()
        reader_finished = False
        try:
            while process.poll() is None or not reader_finished:
                if self.token.is_cancelled:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    self.token.raise_if_cancelled()
                try:
                    line = lines.get(timeout=0.2)
                    if line is None:
                        reader_finished = True
                    elif line.startswith("AKE_MAP_RESULT|"):
                        try:
                            metrics = {
                                key: int(value)
                                for key, value in (
                                    part.split("=", 1) for part in line.split("|")[1:]
                                )
                            }
                        except (ValueError, TypeError) as exc:
                            raise AkeToolError("beyond-sdk 返回了无效的 map 差分统计") from exc
                        self._emit("image_extract", line)
                    elif line:
                        self._emit("image_extract", line)
                except queue.Empty:
                    pass
            if process.returncode:
                raise AkeToolError(f"beyond-sdk.jar 图片解析失败，退出码 {process.returncode}")
        finally:
            if process.poll() is None:
                process.kill()
        if metrics is None:
            raise AkeToolError("beyond-sdk 未返回原生 map 差分统计")

        elapsed = time.monotonic() - started
        full_map = run_root / "assets.full.map"
        delta_map = run_root / "assets.delta.map"
        for label, path in (("完整", full_map), ("增量", delta_map), ("远端候选", remote_map)):
            if not path.is_file() or path.stat().st_size == 0:
                raise ValidationError(f"beyond-sdk 未生成有效的{label}原生 map：{path}")
        expected_history_entries = sum(
            item.entry_count for item in comparison_histories
        )
        if metrics["old"] != expected_history_entries:
            raise ValidationError(
                "历史 map 解码总条目数与 manifest 不一致："
                f"{metrics['old']} != {expected_history_entries}"
            )
        if comparison_bootstrap and (
            metrics["delta"] != metrics["full"] or metrics["skipped"] != 0
        ):
            raise ValidationError("首次引导差分统计异常：delta 必须等于完整当前 map")
        delta_asset_root = delta_output / "assets"
        delta_file_count = (
            sum(1 for path in delta_asset_root.rglob("*") if path.is_file())
            if delta_asset_root.is_dir()
            else 0
        )
        if metrics["delta"] > 0 and delta_file_count == 0:
            raise ValidationError("增量 map 非空，但 SDK delta-output/assets 中没有素材")
        if delta_asset_root.is_dir():
            assert_no_linked_files(delta_asset_root, "图片增量解析输出 assets")
        delta_export_paths = _delta_export_paths(delta_asset_root)
        self._emit("image_extract", f"差分导出文件：{len(delta_export_paths)} 个")
        persistent_assets = self.output_root / "assets"
        persistent_assets.mkdir(parents=True, exist_ok=True)
        merged_added = 0
        merged_overwritten = 0
        merged_unchanged = 0
        if delta_asset_root.is_dir():
            for source in sorted(path for path in delta_asset_root.rglob("*") if path.is_file()):
                self.token.raise_if_cancelled()
                relative = source.relative_to(delta_asset_root)
                target = (persistent_assets / relative).resolve()
                if self.output_root.resolve() not in target.parents:
                    raise ValidationError(f"增量合并路径不安全：{relative}")
                if target.is_file() and target.stat().st_size == source.stat().st_size:
                    if _md5(target, self.token) == _md5(source, self.token):
                        merged_unchanged += 1
                        continue
                if target.exists():
                    merged_overwritten += 1
                else:
                    merged_added += 1
                copy_file_contents(source, target, self.token)
        assert_no_linked_files(persistent_assets, "图片持久增量输出 assets")
        persistent_count = sum(1 for path in persistent_assets.rglob("*") if path.is_file())
        output_digest = self._tree_digest(self.output_root)
        self._emit(
            "image_extract",
            f"原生 map 差分完成：完整 {metrics['full']}，历史有效 hash {metrics['oldHashes']}，"
            f"跳过 {metrics['skipped']}，增量 {metrics['delta']}，无效当前 hash {metrics['invalidCurrent']}；"
            f"source 规范化 {metrics['normalizedSources']}；增量文件 {delta_file_count}；"
            f"合并新增 {merged_added}、覆盖 {merged_overwritten}、未变化 {merged_unchanged}；"
            f"耗时 {elapsed / 60:.1f} 分钟",
        )
        return {
            "image_extracted_files": delta_file_count,
            "image_extract_seconds": round(elapsed, 2),
            "image_output_path": str(self.output_root),
            "image_extracted_hotfix_version": latest.hotfix.res_version,
            "image_asset_version": asset_version,
            "image_output_profile": self.image_profile,
            "image_output_config_digest": self.image_config.digest(),
            "image_publish_authorized": True,
            "image_authorization_steps": ["image_analyze", "image_prepare", "image_extract"],
            "image_version_identity": list(self._version_identity(latest)),
            "image_jar_digest": sha256_file(self.config.image_sdk),
            "image_output_digest": output_digest,
            "image_persistent_files": persistent_count,
            "image_full_map_path": str(full_map),
            "image_full_map_digest": sha256_file(full_map),
            "image_full_map_entries": metrics["full"],
            "image_delta_map_path": str(delta_map),
            "image_delta_map_digest": sha256_file(delta_map),
            "image_delta_map_entries": metrics["delta"],
            "image_delta_export_paths": delta_export_paths,
            "image_delta_export_file_count": len(delta_export_paths),
            "image_delta_export_paths_digest": _delta_export_paths_digest(delta_export_paths),
            "image_pending_map_path": str(remote_map),
            "image_pending_map_digest": sha256_file(remote_map),
            "image_history_map_path": str(history.map_path or ""),
            "image_history_map_digest": history.sha256,
            "image_history_map_entries": history.entry_count,
            "image_history_map_version": history.version,
            "image_comparison_history_entries": metrics["old"],
            "image_comparison_history_hashes": metrics["oldHashes"],
            "image_comparison_history_profiles": [
                item.profile for item in comparison_histories
            ],
            "image_comparison_history_versions": {
                item.profile: item.version for item in comparison_histories
            },
            "image_map_bootstrap": comparison_bootstrap,
            "image_map_manifest_url": history.manifest_url,
            "image_map_skipped_entries": metrics["skipped"],
            "image_map_invalid_current_hashes": metrics["invalidCurrent"],
            "image_map_normalized_sources": metrics["normalizedSources"],
            "image_map_committed": False,
            "image_merge_added": merged_added,
            "image_merge_overwritten": merged_overwritten,
            "image_merge_unchanged": merged_unchanged,
            **self._version_values(latest),
        }

    def publish(self) -> dict[str, Any]:
        state = self._load_state()
        profiles = state.get("profiles")
        authorization = profiles.get(self.image_profile) if isinstance(profiles, dict) else None
        if not isinstance(authorization, dict) or not authorization.get("publishAuthorized"):
            raise ValidationError("图片发布授权无效：请先完成当前 profile 的步骤 1、2、3")
        if authorization.get("profile") != self.image_profile:
            raise ValidationError("解析状态不匹配：共享输出不是由当前 profile 生成")
        if authorization.get("configDigest") != self.image_config.digest():
            raise ValidationError("解析状态不匹配：当前生效配置在解析后发生变化")
        if authorization.get("completedSteps") != [
            "image_analyze",
            "image_prepare",
            "image_extract",
        ]:
            raise ValidationError("图片发布授权缺少完整的步骤 1、2、3 状态")
        for key, label in (
            ("fullMapPath", "完整 map"),
            ("deltaMapPath", "增量 map"),
            ("pendingMapPath", "待提交远端 map"),
        ):
            path = Path(str(authorization.get(key, "")))
            digest_key = {
                "fullMapPath": "fullMapDigest",
                "deltaMapPath": "deltaMapDigest",
                "pendingMapPath": "pendingMapDigest",
            }[key]
            if not path.is_file() or sha256_file(path) != authorization.get(digest_key):
                raise ValidationError(f"图片发布授权失效：{label} 缺失或摘要变化")
        if sha256_file(self.config.image_sdk) != authorization.get("jarDigest"):
            raise ValidationError("图片发布授权失效：beyond-sdk.jar 已变化")
        if self._tree_digest(self.output_root) != authorization.get("outputDigest"):
            raise ValidationError("图片发布授权失效：持久增量输出在解析后发生变化")
        version_values = self._cached_image_version_values(state, authorization)
        asset_version = str(authorization.get("assetVersion", "")).strip()
        if not re.fullmatch(
            r"\d+\.\d+\.\d+@[A-Za-z0-9][A-Za-z0-9._-]*",
            asset_version,
        ):
            raise ValidationError("图片发布授权中的正式资产版本无效，请重新解析")
        if not self.output_root.is_dir():
            raise FileNotFoundError(f"尚无图片解析输出：{self.output_root}")
        delta_export_paths_value = authorization.get("deltaExportPaths")
        if not isinstance(delta_export_paths_value, list) or any(
            not isinstance(path, str) for path in delta_export_paths_value
        ):
            raise ValidationError("图片发布授权缺少有效的差分导出路径列表，请重新执行图片解析")
        delta_export_paths = sorted(set(delta_export_paths_value))
        if any(
            not path.startswith("assets/")
            or path.startswith("/")
            or re.match(r"^[A-Za-z]:", path)
            or "\n" in path
            or "\r" in path
            or any(part in {"", ".", ".."} for part in path.split("/"))
            or Path(path).is_absolute()
            for path in delta_export_paths
        ):
            raise ValidationError("图片发布授权包含不安全的差分导出路径，请重新执行图片解析")
        if int(authorization.get("deltaMapEntries", 0)) > 0 and not delta_export_paths:
            raise ValidationError("增量 map 非空但没有差分导出路径，拒绝发布")
        if int(authorization.get("deltaExportFileCount", -1)) != len(delta_export_paths):
            raise ValidationError("差分导出文件数量与图片状态不一致，请重新执行图片解析")
        if str(authorization.get("deltaExportPathsDigest", "")) != _delta_export_paths_digest(
            delta_export_paths
        ):
            raise ValidationError("差分导出路径摘要与图片状态不一致，请重新执行图片解析")
        source_root = (self.output_root / "assets").resolve()
        output_root = self.output_root.resolve()
        if output_root not in source_root.parents:
            raise ValidationError(f"拒绝发布图片输出目录之外的路径：{source_root}")
        if not source_root.is_dir():
            raise FileNotFoundError(f"图片解析输出中不存在 assets 目录：{source_root}")
        assert_no_linked_files(source_root, "图片解析输出 assets")
        source_files = {
            f"assets/{path.relative_to(source_root).as_posix()}": path
            for path in source_root.rglob("*")
            if path.is_file()
            and self.image_matcher.matches(
                f"assets/{path.relative_to(source_root).as_posix()}"
            )
        }
        if not source_files and int(authorization.get("deltaMapEntries", 0)) > 0:
            raise ValidationError("增量 map 非空但持久图片输出为空，拒绝发布")

        public_root = self.config.public_root.resolve()
        image_root = (public_root / "images").resolve()
        if public_root not in image_root.parents or not image_root.is_dir():
            raise FileNotFoundError(f"public/images 不存在或不在 public 目录内：{image_root}")
        target_root = image_root / "assets"
        target_root.mkdir(parents=True, exist_ok=True)
        if not target_root.is_dir():
            raise ValidationError(f"图片发布目标不是目录：{target_root}")
        existing_files = {
            path.relative_to(image_root).as_posix(): path
            for path in image_root.rglob("*")
            if path.is_file()
        }
        managed_existing = {
            relative: path
            for relative, path in existing_files.items()
            if self.image_matcher.matches(relative)
        }
        outside_count = len(existing_files) - len(managed_existing)
        added = 0
        overwritten = 0
        unchanged = 0
        for relative, source in sorted(source_files.items()):
            self.token.raise_if_cancelled()
            target = (image_root / relative).resolve()
            if image_root not in target.parents:
                raise ValidationError(f"图片发布路径不安全：{relative}")
            if target.is_file() and target.stat().st_size == source.stat().st_size:
                if _md5(target, self.token) == _md5(source, self.token):
                    unchanged += 1
                    continue
            if target.exists():
                overwritten += 1
            else:
                added += 1
            copy_file_contents(source, target, self.token)
        assert_no_linked_files(target_root, "public/images/assets")
        missing_delta_paths: list[str] = []
        for relative in delta_export_paths:
            target = (image_root / relative).resolve()
            if image_root not in target.parents or not target.is_file() or is_linked_file(target):
                missing_delta_paths.append(relative)
        if missing_delta_paths:
            sample = "、".join(missing_delta_paths[:5])
            suffix = "" if len(missing_delta_paths) <= 5 else f" 等 {len(missing_delta_paths)} 项"
            raise ValidationError(
                f"图片发布后仍缺少 {len(missing_delta_paths)} 个差分导出文件：{sample}{suffix}；"
                "请重新执行图片发布"
            )

        self._emit(
            "image_publish",
            f"图片发布完成：新增 {added}，覆盖 {overwritten}，不删除历史文件，"
            f"范围内未变化 {unchanged}，保留范围外 {outside_count}",
        )
        published_at = datetime.now(timezone.utc).isoformat()
        return {
            "image_published_files": added + overwritten + unchanged,
            "image_publish_added": added,
            "image_publish_overwritten": overwritten,
            "image_publish_deleted": 0,
            "image_publish_unchanged": unchanged,
            "image_publish_outside_scope": outside_count,
            "image_published_hotfix_version": version_values["image_hotfix_version"],
            "image_published_profile": self.image_profile,
            "image_published_config_digest": self.image_config.digest(),
            "image_published_asset_version": asset_version,
            "image_published_at": published_at,
            "image_publish_scope": self.image_config.image_containers_filter,
            "image_publish_run_id": str(authorization.get("runId", "")),
            **version_values,
        }

    def _save_state(self, values: dict[str, Any]) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        current: dict[str, Any] = {}
        if self.state_path.is_file():
            try:
                current = json.loads(self.state_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                current = {}
        last_stage = str(values.get("last_stage", ""))
        profile = str(values.get("image_profile", ""))
        profiles = current.get("profiles")
        if not isinstance(profiles, dict):
            profiles = {}
        if last_stage == "image_analyze" and profile:
            profiles[profile] = {
                "profile": profile,
                "published": False,
                "publishAuthorized": False,
                "mapCommitted": False,
                "configDigest": str(values.get("image_config_digest", "")),
                "gameVersion": str(values.get("image_game_version", "")),
                "seedVersion": str(values.get("image_seed_version", "")),
                "hotfixVersion": str(values.get("image_hotfix_version", "")),
                "completedSteps": ["image_analyze"],
                "invalidReason": "新流程尚未完成步骤 2、3、4",
            }
        elif last_stage == "image_prepare" and profile:
            record = profiles.get(profile)
            if not isinstance(record, dict):
                record = {}
            record.update(
                {
                    "profile": profile,
                    "published": False,
                    "publishAuthorized": False,
                    "mapCommitted": False,
                    "configDigest": str(values.get("image_config_digest", "")),
                    "gameVersion": str(values.get("image_game_version", "")),
                    "seedVersion": str(values.get("image_seed_version", "")),
                    "hotfixVersion": str(values.get("image_hotfix_version", "")),
                    "completedSteps": ["image_analyze", "image_prepare"],
                    "invalidReason": "VFS 已准备，尚未完成步骤 3、4",
                }
            )
            profiles[profile] = record
        elif last_stage == "image_extract" and profile:
            profiles[profile] = {
                "profile": profile,
                "runId": str(values.get("image_run_id", "")),
                "published": False,
                "publishAuthorized": bool(values.get("image_publish_authorized")),
                "mapCommitted": False,
                "configDigest": str(values.get("image_config_digest", "")),
                "assetVersion": str(values.get("image_asset_version", "")),
                "gameVersion": str(values.get("image_game_version", "")),
                "seedVersion": str(values.get("image_seed_version", "")),
                "hotfixVersion": str(values.get("image_hotfix_version", "")),
                "versionIdentity": list(values.get("image_version_identity", [])),
                "completedSteps": list(values.get("image_authorization_steps", [])),
                "jarDigest": str(values.get("image_jar_digest", "")),
                "outputRoot": str(values.get("image_output_path", "")),
                "outputDigest": str(values.get("image_output_digest", "")),
                "persistentFiles": int(values.get("image_persistent_files", 0)),
                "fullMapPath": str(values.get("image_full_map_path", "")),
                "fullMapDigest": str(values.get("image_full_map_digest", "")),
                "fullMapEntries": int(values.get("image_full_map_entries", 0)),
                "deltaMapPath": str(values.get("image_delta_map_path", "")),
                "deltaMapDigest": str(values.get("image_delta_map_digest", "")),
                "deltaMapEntries": int(values.get("image_delta_map_entries", 0)),
                "deltaExportPaths": list(values.get("image_delta_export_paths", [])),
                "deltaExportFileCount": int(values.get("image_delta_export_file_count", 0)),
                "deltaExportPathsDigest": str(
                    values.get("image_delta_export_paths_digest", "")
                ),
                "historyMapPath": str(values.get("image_history_map_path", "")),
                "historyMapDigest": str(values.get("image_history_map_digest", "")),
                "historyMapEntries": int(values.get("image_history_map_entries", 0)),
                "historyMapVersion": str(values.get("image_history_map_version", "")),
                "comparisonHistoryEntries": int(
                    values.get("image_comparison_history_entries", 0)
                ),
                "comparisonHistoryHashes": int(
                    values.get("image_comparison_history_hashes", 0)
                ),
                "comparisonHistoryProfiles": list(
                    values.get("image_comparison_history_profiles", [])
                ),
                "comparisonHistoryVersions": dict(
                    values.get("image_comparison_history_versions", {})
                ),
                "bootstrap": bool(values.get("image_map_bootstrap")),
                "skippedEntries": int(values.get("image_map_skipped_entries", 0)),
                "invalidCurrentHashes": int(values.get("image_map_invalid_current_hashes", 0)),
                "normalizedSources": int(values.get("image_map_normalized_sources", 0)),
                "pendingMapPath": str(values.get("image_pending_map_path", "")),
                "pendingMapDigest": str(values.get("image_pending_map_digest", "")),
                "manifestUrl": str(values.get("image_map_manifest_url", "")),
                "extractedAt": datetime.now(timezone.utc).isoformat(),
                "invalidReason": "本次增量解析尚未发布到 public",
            }
            current["lastOutput"] = {
                "profile": profile,
                "configDigest": str(values.get("image_config_digest", "")),
                "runId": str(values.get("image_run_id", "")),
                "assetVersion": str(values.get("image_asset_version", "")),
                "generatedAt": datetime.now(timezone.utc).isoformat(),
            }
        elif last_stage == "image_publish" and profile:
            record = profiles.get(profile)
            if not isinstance(record, dict):
                record = {}
            record.update(
                {
                    "profile": profile,
                    "published": True,
                    "publishAuthorized": False,
                    "publishConsumed": True,
                    "configDigest": str(values.get("image_published_config_digest", "")),
                    "assetVersion": str(values.get("image_published_asset_version", "")),
                    "gameVersion": str(values.get("image_game_version", "")),
                    "seedVersion": str(values.get("image_seed_version", "")),
                    "hotfixVersion": str(values.get("image_hotfix_version", "")),
                    "publishedAt": str(values.get("image_published_at", "")),
                    "scope": str(values.get("image_publish_scope", "")),
                    "scopeDigest": hashlib.sha256(
                        str(values.get("image_publish_scope", "")).encode("utf-8")
                    ).hexdigest(),
                    "completedSteps": [
                        "image_analyze",
                        "image_prepare",
                        "image_extract",
                        "image_publish",
                    ],
                    "invalidReason": "",
                }
            )
            profiles[profile] = record
        elif last_stage == "json_analyze":
            for key in (
                "json_prepared",
                "json_prepared_hotfix_version",
                "json_extracted_hotfix_version",
                "json_published_hotfix_version",
            ):
                current.pop(key, None)
        elif last_stage == "json_prepare":
            current.pop("json_extracted_hotfix_version", None)
            current.pop("json_published_hotfix_version", None)
        elif last_stage == "json_extract":
            current.pop("json_published_hotfix_version", None)
        current["schemaVersion"] = 3
        current["profiles"] = profiles
        current.update(values)
        self._write_state_data(current)
