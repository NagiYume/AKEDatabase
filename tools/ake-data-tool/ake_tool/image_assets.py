from __future__ import annotations

import base64
import hashlib
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

from .asset_maps import AssetMapHistory, AssetMapHistoryLoader, sha256_file
from .config import TOOL_ROOT, AppConfig
from .downloader import BLOCK_IDS, DownloadManager, entries_for_blocks, safe_target
from .errors import AkeToolError, ValidationError
from .file_copy import (
    assert_no_linked_files,
    copy_file_contents,
    move_file_contents,
    sync_file_contents,
    sync_tree_contents,
    is_linked_file,
)
from .hotfix_api import HotfixClient
from .file_facts import file_digest
from .export_history import prune_exports
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
from .image_parser_identity import image_parser_digest
from .json_unpacker import resolve_json_runtime, run_json_export
from .vfs_validation_cache import VfsValidationCache, latest_identity
from .vfs_update import VfsUpdater


IMAGE_BLOCKS = ("Bundle", "InitialBundle", "BundleManifest")


def _stop_image_process(process: subprocess.Popen) -> None:
    """Stop the worker and any Windows venv launcher child on cancellation."""
    if process.poll() is not None:
        return
    if os.name == "nt":
        try:
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                check=False, timeout=10,
            )
        except (OSError, subprocess.TimeoutExpired):
            pass
    if process.poll() is None:
        process.kill()
    process.wait()


# Json 宿主所需的表、字符串池和哈希依赖；统一由准备流程提供。
JSON_BLOCKS = (
    "TableCfg",
    "Json",
    "InitialExtendData",
    "ExtendData",
)


def _resolve_json_publish_sources(source_root: Path) -> dict[str, Path]:
    assert_no_linked_files(source_root, "Json 解析输出")
    sources: dict[str, Path] = {}
    for source in sorted(source_root.iterdir()):
        if source.is_file() or (
            source.is_dir() and any(path.is_file() for path in source.rglob("*"))
        ):
            sources[source.name] = source
    if not sources:
        raise ValidationError(f"Json 解析输出为空，拒绝发布：{source_root}")
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
    return file_digest(path, token=token, progress=progress)


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
        ignore_image_map: bool = False,
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
            concurrency=config.download_concurrency,
            timeout=config.request_timeout,
            retries=config.retries,
            verify_md5=True,
            session=getattr(self.client, "session", None),
        )
        self._latest_plans: dict[tuple[str, ...], dict[str, Any]] = {}
        self._log_path: Path | None = None
        self.image_profile = normalize_image_profile(image_profile)
        self.image_config = image_config or config.image_config(self.image_profile)
        self.ignore_image_map = ignore_image_map
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

        updater = VfsUpdater(self.config.image_work_root, self.client, self.downloader, self.token,
                             legacy_records=self.config.vfs_validation_records)
        cache_root = cache_parent / version_name
        sources: dict[str, tuple[str, Path | None]] = {}
        source_counts = dict(workspace=0, streaming=0, persistent=0, cache=0, remote=0)
        remote_entries: list[DownloadEntry] = []
        for entry in latest_entries:
            self.token.raise_if_cancelled()
            block = next(b for b in blocks if entry.name.startswith("VFS/" + BLOCK_IDS[b] + "/"))
            workspace = safe_target(self.config.image_work_root, entry.name)
            candidates = [("workspace", workspace)]
            if updater.mode(block, latest) == "full":
                candidates.extend((label, safe_target(root, entry.name)) for label, configured, root in (
                    ("streaming", self.config.game_streaming_assets_dir, self.config.streaming_assets_root),
                    ("persistent", self.config.game_persistent_dir, self.config.persistent_root),
                ) if configured.strip() and root.is_dir())
            for label, path in candidates:
                if updater.matches(path, entry, label == "workspace" and updater.trusted_entry(block, latest, entry)):
                    sources[entry.name] = (label, path)
                    source_counts[label] += 1
                    break
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

    @staticmethod
    def _block_entries(
        entries: Iterable[DownloadEntry],
        block: str,
    ) -> list[DownloadEntry]:
        block_id = BLOCK_IDS[block]
        return [entry for entry in entries if f"/{block_id}/" in f"/{entry.name}"]

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
        return self._get_resource_plan(JSON_BLOCKS, "json_analyze", "Json")

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
        finally:
            try:
                self._prune_export_history(stages)
            except (OSError, ValidationError) as exc:
                self._emit("cleanup", f"历史导出清理未完成，将在下次解析时重试：{exc}")
        if self._log_path is not None:
            result["log_path"] = str(self._log_path)
        return result

    def _prune_export_history(self, stages: list[str]) -> None:
        # Cleanup also bounds failed exports. State-referenced maps are kept
        # so an unfinished upload still has its required artifacts.
        if "image_extract" in stages:
            state = self._load_state()
            record = (state.get("profiles") or {}).get(self.image_profile) or {}
            protected = [record[key] for key in ("fullMapPath", "deltaMapPath", "pendingMapPath")
                         if record.get(key)]
            prune_exports(self.config.image_work_root,
                          [self.config.image_work_root / "image-runs" / self.image_profile],
                          protected=protected,
                          report=lambda path: self._emit("image_extract", f"清理历史导出：{path}"))
        if "json_extract" in stages:
            legacy_exports = [path for path in (self.config.image_work_root / "json-python-validation").glob("*")
                              if (path / "data").is_dir() or (path / "output" / "data").is_dir()]
            legacy_exports.extend(self.config.image_work_root.glob("json-diagnostic-*/output"))
            prune_exports(self.config.image_work_root,
                          [self.config.image_work_root / "json-python-runs"],
                          keep=2 if self.json_output_root.exists() else 3,
                          extra_exports=legacy_exports,
                          report=lambda path: self._emit("json_extract", f"清理历史导出：{path}"))

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
            "image_work_vfs_reused": counts["workspace"],
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
            f"工作 VFS 复用 {counts['workspace']}，本体复用 {counts['streaming']}，Persistent 复用 {counts['persistent']}，"
            f"Hotfix 缓存复用 {counts['cache']}，需下载 {counts['remote']}",
            len(latest_entries),
            len(latest_entries),
        )
        return result

    def analyze_json(self) -> dict[str, Any]:
        self.config.validate_json()
        plan = self._get_json_plan()
        latest: LatestInfo = plan["latest"]
        latest_entries: list[DownloadEntry] = plan["entries"]
        counts: dict[str, int] = plan["source_counts"]
        remote_entries: list[DownloadEntry] = plan["remote_entries"]
        total_bytes = sum(entry.size for entry in latest_entries)
        result = {
            "json_file_count": len(latest_entries),
            "json_work_vfs_reused": counts["workspace"],
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

    def _prepare_work_vfs(self, plan, blocks, stage):
        updater = VfsUpdater(self.config.image_work_root, self.client, self.downloader,
                             self.token, lambda event: self._emit(stage, event.message,
                                                                  event.current, event.total),
                             legacy_records=self.config.vfs_validation_records)
        game_roots = [root for configured, root in (
            (self.config.game_streaming_assets_dir, self.config.streaming_assets_root),
            (self.config.game_persistent_dir, self.config.persistent_root),
        ) if configured.strip() and root.is_dir()]
        counts = updater.prepare(plan["latest"], plan["entries"], plan["entry_parts"], blocks, game_roots)
        self._finish_vfs_cache(VfsValidationCache(self.config), latest_identity(plan["latest"]),
                               plan["entries"], blocks, stage)
        return counts

    def prepare_vfs(self) -> dict[str, Any]:
        info = self.analyze()
        plan = self._get_latest_plan()
        counts = self._prepare_work_vfs(plan, IMAGE_BLOCKS, "image_prepare")
        info.update(image_work_vfs_reused=counts["workspace"], image_vfs_update_counts=counts,
                    image_remote_files=counts["downloaded"] + counts["patched"],
                    image_remote_bytes=counts["full_bytes"] + counts["patch_bytes"],
                    image_prepared=True, image_prepared_hotfix_version=plan["latest"].hotfix.res_version)
        return info

    def prepare_json_vfs(self) -> dict[str, Any]:
        info = self.analyze_json()
        plan = self._get_json_plan()
        counts = self._prepare_work_vfs(plan, JSON_BLOCKS, "json_prepare")
        json_entries = self._block_entries(plan["entries"], "Json")
        if not json_entries:
            raise ValidationError("Json 解析前缺少 Json 输入区块")
        info.update(json_work_vfs_reused=counts["workspace"], json_vfs_update_counts=counts,
                    json_remote_files=counts["downloaded"] + counts["patched"],
                    json_remote_bytes=counts["full_bytes"] + counts["patch_bytes"],
                    json_prepared=True, json_prepared_files=len(plan["entries"]),
                    json_block_files=len(json_entries),
                    json_prepared_hotfix_version=plan["latest"].hotfix.res_version)
        return info

    def _verify_json_inputs(self, plan: dict[str, Any]) -> int:
        entries: list[DownloadEntry] = plan["entries"]
        json_block_id = BLOCK_IDS["Json"]
        json_count = 0
        if not VfsValidationCache.files_match(self.vfs_root, entries):
            raise ValidationError("拒绝解析 Json： 解析所需文件缺失或大小不符")
        for entry in entries:
            if f"/{json_block_id}/" in f"/{entry.name}":
                json_count += 1
        json_root = self.vfs_root / json_block_id
        if json_count == 0 or not json_root.is_dir():
            raise ValidationError(f"拒绝解析 Json： 输入路径不正确：{json_root}")
        return json_count

    def extract_json(self) -> dict[str, Any]:
        self.config.validate_json()
        latest = self._require_json_latest_state("json_prepared_hotfix_version")
        state = self._load_state()
        json_input_root = self.vfs_root / BLOCK_IDS["Json"]
        if not state.get("json_prepared") or int(state.get("json_block_files", 0)) <= 0 or not json_input_root.is_dir():
            raise ValidationError("Json VFS 准备状态不完整，请先执行索引分析和 VFS 准备")
        self._assert_vfs_is_independent()
        runtime = resolve_json_runtime(self.config.image_work_root, latest.seed.game_version, latest.seed.seed_version)
        run_root = self.config.image_work_root / "json-python-runs" / (datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])
        self._emit("json_extract", f"使用 Python Json 宿主，运行时：{runtime}；独立输出：{run_root}")
        report = run_json_export(self.config.image_work_root, run_root, runtime, self.token,
                                 lambda line: self._emit("json_extract", line))
        self.token.raise_if_cancelled()
        # Failed runs retain diagnostics without exposing partial data for publication.
        # Revoke the previous extraction authorization before replacing its directory.
        for key in ("json_extracted_hotfix_version", "json_published_hotfix_version"):
            state.pop(key, None)
        self._write_state_data(state)
        if self.json_output_root.exists():
            resolved = self.json_output_root.resolve()
            if self.config.image_work_root.resolve() not in resolved.parents:
                raise ValidationError(f"拒绝替换工作目录之外的 Json 输出：{resolved}")
            # Keep the last two prior attempts alongside the current output,
            # without copying their contents or retaining unbounded backups.
            history_root = self.config.image_work_root / "json-python-runs"
            history_root.mkdir(parents=True, exist_ok=True)
            previous = history_root / ("previous-" + datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])
            resolved.rename(previous)
        run_root.rename(self.json_output_root)
        source = self.json_output_root / "data" / "Json"
        self._emit("json_extract", f"Python Json 解析完成：{report['selected']} 个文件；未支持条目 {len(report['unsupported'])} 个，详见 export-report-0.json")
        return {
            "json_extracted_files": report["selected"],
            "json_extract_seconds": report["seconds"],
            "json_output_path": str(self.json_output_root),
            "json_content_path": str(source),
            "json_input_path": str(json_input_root),
            "json_parser": "python-il2cpp",
            "json_runtime_path": str(runtime),
            "json_unsupported_entries": report["unsupported"],
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
        published_directories = sorted(
            name for name, source in matched_sources.items() if source.is_dir()
        )
        published_root_files = sorted(
            name for name, source in matched_sources.items() if source.is_file()
        )
        assert_no_linked_files(public_json_root, "public/Json")

        total_files = 0
        for index, (name, source) in enumerate(sorted(matched_sources.items()), 1):
            self.token.raise_if_cancelled()
            target = public_json_root / name
            if source.is_dir():
                file_count = sync_tree_contents(source, target, self.token, checked=True)
            else:
                if target.is_dir():
                    shutil.rmtree(target)
                sync_file_contents(source, target, self.token)
                file_count = 1
            total_files += file_count
            self._emit("json_publish", f"增量发布 [{index}/{len(matched_sources)}] {name}：{file_count} 个文件",
                       index, len(matched_sources))

        self._emit(
            "json_publish",
            f"Json 发布完成：{len(published_directories)} 个目录、"
            f"{len(published_root_files)} 个根目录文件，共 {total_files} 个文件",
        )
        return {
            "json_published_directories": published_directories,
            "json_published_root_files": published_root_files,
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

    def _resolve_vfs_key(self, latest: LatestInfo, runtime_root: Path) -> str:
        # Use the same uniquely versioned complete runtime as the Json host.
        runtime = resolve_json_runtime(
            self.config.image_work_root, latest.seed.game_version, latest.seed.seed_version
        )
        command = [sys.executable, "-u", "-m", "ake_tool.json_host.image_key",
                   str(runtime), str(runtime_root / "image-key-persistent" /
                                     self._safe_version(latest.seed.seed_version))]
        self._emit("image_extract", f"使用 Python 宿主获取 VFS key：{runtime}")
        process = subprocess.Popen(
            command, cwd=TOOL_ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"},
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        lines: queue.Queue[str | None] = queue.Queue()

        def read_output() -> None:
            assert process.stdout is not None
            try:
                for line in process.stdout:
                    lines.put(line.rstrip())
            finally:
                lines.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        encoded_key = None
        deadline = time.monotonic() + 300
        try:
            while True:
                self.token.raise_if_cancelled()
                if time.monotonic() >= deadline:
                    raise TimeoutError("Python VFS key 宿主超时")
                try:
                    line = lines.get(timeout=0.2)
                except queue.Empty:
                    continue
                if line is None:
                    break
                if line.startswith("VFS_KEY_BASE64="):
                    if encoded_key is not None:
                        raise AkeToolError("Python VFS key 宿主返回多个 key")
                    candidate = line.removeprefix("VFS_KEY_BASE64=").strip()
                    try:
                        decoded = base64.b64decode(candidate, validate=True)
                    except ValueError as exc:
                        raise AkeToolError("Python VFS key 宿主返回无效 key") from exc
                    if len(decoded) != 32:
                        raise AkeToolError("Python VFS key 宿主返回的 key 长度错误")
                    encoded_key = candidate
                elif line:
                    self._emit("image_extract", line)
            if process.wait() != 0 or encoded_key is None:
                raise AkeToolError("Python VFS key 宿主失败或没有返回 key")
            return encoded_key
        finally:
            if process.poll() is None:
                _stop_image_process(process)
            reader.join(timeout=5)
            if process.stdout is not None:
                process.stdout.close()

    def extract(self) -> dict[str, Any]:
        self.config.validate_images(require_sources=False)
        latest = self._require_latest_state("image_prepared")
        if not self.vfs_root.is_dir():
            raise FileNotFoundError(f"尚未准备图片 VFS：{self.vfs_root}")
        runtime_root = (
            self.config.image_work_root
            / "il2cpp-host-runtime"
            / latest.seed.game_version
        )
        self._assert_vfs_is_independent()
        encoded_vfs_key = self._resolve_vfs_key(latest, runtime_root)
        runtime = resolve_json_runtime(self.config.image_work_root, latest.seed.game_version,
                                       latest.seed.seed_version)
        builtin_root = runtime / "Endfield_Data" / "Resources"
        if not (builtin_root / "unity default resources").is_file():
            game_data = self.config.streaming_assets_root.parent
            candidate = game_data / "Resources"
            game_assembly = game_data.parent / "GameAssembly.dll"
            runtime_assembly = runtime / "GameAssembly.dll"
            if (self.config.game_streaming_assets_dir.strip()
                    and (candidate / "unity default resources").is_file()
                    and game_assembly.is_file()
                    and game_assembly.stat().st_size == runtime_assembly.stat().st_size
                    and sha256_file(game_assembly) == sha256_file(runtime_assembly)):
                builtin_root = candidate
        if (builtin_root / "unity default resources").is_file():
            self._emit("image_extract", f"Unity 内置资源目录：{builtin_root}")
        else:
            builtin_root = None
            self._emit("image_extract", "未找到与当前运行时匹配的 Unity 内置资源；如需内置对象将停止并提示")
        game_version, hotfix_main_version = resolve_r2_versions(latest)
        asset_version = f"{game_version}@{hotfix_main_version}"
        self._emit(
            "image_extract",
            f"{'无视 map 全部导出' if self.ignore_image_map else '增量模式'}：profile={self.image_profile}，版本={asset_version}，"
            f"manifest={self.map_history_loader.manifest_url}",
        )
        history_profiles = (
            (IMAGE_PROFILE_FULL, IMAGE_PROFILE_STANDARD)
            if self.image_profile == IMAGE_PROFILE_FULL
            else (self.image_profile,)
        )
        if self.ignore_image_map:
            history_by_profile = {
                profile: AssetMapHistory(
                    profile=profile, profile_key=profile,
                    manifest_url=self.map_history_loader.manifest_url,
                    bootstrap=True, source="ignored",
                )
                for profile in history_profiles
            }
            self._emit("image_extract", "无视 map 导出已开启：不读取历史 map，导出所有匹配图片")
        else:
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
            if self.ignore_image_map:
                continue
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
        if comparison_bootstrap and not self.ignore_image_map:
            self._emit(
                "image_extract",
                "所有比对用历史 map 均不存在，首次引导将导出完整当前 map",
            )
        elif not self.ignore_image_map and self.image_profile == IMAGE_PROFILE_FULL:
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
        parser_digest = image_parser_digest()
        command = [sys.executable, "-u", "-m", "ake_tool.image_memory_runner"] + [
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
        if builtin_root is not None:
            command.extend(["--unity-resources", str(builtin_root)])
        self._emit("image_extract", f"containers_filter：{containers_filter}")
        self._emit("image_extract", f"执行命令：{format_command(command)}")
        self._emit("image_extract", "启动 Python 图片解析：按清单筛选并逐 Bundle 构图导出…")
        process_env = os.environ.copy()
        process_env["PERLICA_VFS_KEY_BASE64"] = encoded_vfs_key
        process_env["PYTHONIOENCODING"] = "utf-8"
        process_env["PYTHONDONTWRITEBYTECODE"] = "1"
        process_env["AKE_IMAGE_BUNDLE_CACHE_GIB"] = str(self.config.image_bundle_cache_gib)
        process_env["AKE_IMAGE_PARSE_WORKERS"] = str(self.config.image_parse_workers)
        process = subprocess.Popen(
            command,
            cwd=TOOL_ROOT,
            env=process_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        lines: queue.Queue[str | None] = queue.Queue()
        metrics: dict[str, int] | None = None
        next_progress = time.monotonic() + 30
        previous_output: tuple[int, int, int] | None = None

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
                    _stop_image_process(process)
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
                            raise AkeToolError("Python 图片解析器返回了无效的 map 差分统计") from exc
                        self._emit("image_extract", line)
                    elif line:
                        self._emit("image_extract", line)
                except queue.Empty:
                    pass
                if process.poll() is None and time.monotonic() >= next_progress:
                    file_count = 0
                    byte_count = 0
                    newest_write = 0
                    try:
                        for directory, _, filenames in os.walk(delta_output):
                            for filename in filenames:
                                path = Path(directory) / filename
                                try:
                                    info = path.stat()
                                except FileNotFoundError:
                                    continue
                                file_count += 1
                                byte_count += info.st_size
                                newest_write = max(newest_write, info.st_mtime_ns)
                        output_snapshot = (file_count, byte_count, newest_write)
                        activity = (
                            "本次观察到输出变化"
                            if previous_output is not None and output_snapshot != previous_output
                            else "首次统计" if previous_output is None
                            else "本次未观察到文件变化，不能据此判定卡死"
                        )
                        previous_output = output_snapshot
                        self._emit(
                            "image_extract",
                            f"解析进程仍在运行，已耗时 {(time.monotonic() - started) / 60:.1f} 分钟；"
                            f"输出目录现有 {file_count} 个文件、{byte_count / (1024 * 1024):.1f} MiB；"
                            f"{activity}（包含正在写入的文件，不代表完成数量）",
                        )
                    except OSError as exc:
                        self._emit("image_extract", f"解析进程仍在运行，暂时无法统计输出：{exc}")
                    next_progress = time.monotonic() + 30
            if process.returncode:
                raise AkeToolError(f"Python 图片解析失败，退出码 {process.returncode}")
        finally:
            if process.poll() is None:
                _stop_image_process(process)
        if metrics is None:
            raise AkeToolError("Python 图片解析器未返回 map 差分统计")
        if metrics.get("failures", 0):
            raise ValidationError(f'图片构图存在 {metrics["failures"]} 个错误，拒绝发布')
        if metrics.get("warnings", 0):
            self._emit("image_extract", f'图片构图有 {metrics["warnings"]} 条未解析外部引用；'
                       f'内容可能不完整，详见 {run_root / "unresolved-cabs.json"}')
        if image_parser_digest() != parser_digest:
            raise ValidationError("图片解析期间 Python 解析器发生变化，拒绝合并输出")

        elapsed = time.monotonic() - started
        full_map = run_root / "assets.full.map"
        delta_map = run_root / "assets.delta.map"
        for label, path in (("完整", full_map), ("增量", delta_map), ("远端候选", remote_map)):
            if not path.is_file() or path.stat().st_size == 0:
                raise ValidationError(f"Python 图片解析器未生成有效的{label}原生 map：{path}")
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
            raise ValidationError("增量 map 非空，但 delta-output/assets 中没有素材")
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
                if target.exists():
                    merged_overwritten += 1
                else:
                    merged_added += 1
                move_file_contents(source, target, self.token)
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
            "image_parser_digest": parser_digest,
            # Compatibility fields: full-history scans are no longer performed.
            "image_output_digest": "",
            "image_persistent_files": None,
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
            "image_map_bootstrap": comparison_bootstrap and not self.ignore_image_map,
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
        if image_parser_digest() != authorization.get("parserDigest"):
            raise ValidationError("图片发布授权失效：Python 解析器已变化或旧状态需要重新解析")
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
        source_files = {}
        for relative in delta_export_paths:
            path = (self.output_root / relative).resolve()
            if source_root not in path.parents or not path.is_file() or is_linked_file(path):
                raise ValidationError(f"差分图片解析输出缺失或路径无效：{relative}")
            if not self.image_matcher.matches(relative):
                raise ValidationError(f"差分图片不在当前配置范围内：{relative}")
            source_files[relative] = path
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
        # Historical files outside deltaExportPaths are neither scanned nor changed.
        added = 0
        overwritten = 0
        unchanged = 0
        for relative, source in sorted(source_files.items()):
            self.token.raise_if_cancelled()
            target = (image_root / relative).resolve()
            if image_root not in target.parents:
                raise ValidationError(f"图片发布路径不安全：{relative}")
            existed = target.exists()
            if not sync_file_contents(source, target, self.token):
                unchanged += 1
                continue
            if existed:
                overwritten += 1
            else:
                added += 1
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
            f"本次增量内未变化 {unchanged}；未扫描范围外历史文件",
        )
        published_at = datetime.now(timezone.utc).isoformat()
        return {
            "image_published_files": added + overwritten + unchanged,
            "image_publish_added": added,
            "image_publish_overwritten": overwritten,
            "image_publish_deleted": 0,
            "image_publish_unchanged": unchanged,
            "image_publish_outside_scope": None,
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
                "parserDigest": str(values.get("image_parser_digest", "")),
                "outputRoot": str(values.get("image_output_path", "")),
                "outputDigest": str(values.get("image_output_digest", "")),
                "persistentFiles": values.get("image_persistent_files"),
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
