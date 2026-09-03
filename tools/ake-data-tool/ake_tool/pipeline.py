from __future__ import annotations

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import TOOL_ROOT, AppConfig
from .downloader import DownloadManager, entries_for_blocks, safe_target
from .errors import AkeToolError, CancelledError, ValidationError
from .file_copy import assert_no_linked_files, copy_file_contents
from .hotfix_api import HotfixClient
from .index_crypto import DEFAULT_KEY, INITIAL_KEY, decrypt_index
from .models import (
    CancellationToken,
    DownloadEntry,
    LatestInfo,
    ProgressCallback,
    ProgressEvent,
    ResourcePart,
    null_progress,
)
from .release import ReleaseManager
from .state_store import StateStore
from .unpacker import BeyondSdkTableUnpacker
from .vfs_validation_cache import VfsValidationCache, latest_identity


TABLECFG_HOTFIX_BLOCKS = ("TableCfg",)
SDK_INDEX_PARTS = ("main", "initial")
PIPELINE_STAGES = ("check", "download", "unpack", "validate", "publish", "upload")


class Pipeline:
    def __init__(
        self,
        config: AppConfig,
        progress: ProgressCallback = null_progress,
        token: CancellationToken | None = None,
    ) -> None:
        self.config = config
        self.external_progress = progress
        self.token = token or CancellationToken()
        self._last_logged_message = ""
        self._log_path: Path | None = None
        self.client = HotfixClient(timeout=config.request_timeout, appcode=config.appcode)
        self.downloader = DownloadManager(
            timeout=config.request_timeout,
            retries=config.retries,
            verify_md5=config.verify_md5,
            session=self.client.session,
        )

    def _emit(self, event: ProgressEvent) -> None:
        if self._log_path is not None and event.message != self._last_logged_message:
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with self._log_path.open("a", encoding="utf-8") as stream:
                stream.write(f"{timestamp} [{event.level.upper()}] [{event.stage}] {event.message}\n")
            self._last_logged_message = event.message
        self.external_progress(event)

    def check_latest(self) -> LatestInfo:
        self.token.raise_if_cancelled()
        if self.config.manual_version_enabled:
            self._emit(
                ProgressEvent(
                    "check",
                    f"正在查询手动游戏版本 {self.config.manual_seed_version} 的最新 Hotfix",
                )
            )
            latest = self.client.get_for_version(
                self.config.manual_seed_version,
                self.config.manual_rand_str,
            )
        else:
            self._emit(ProgressEvent("check", "正在获取官方当前最新 Seed 信息"))
            latest = self.client.get_latest()
        self._emit(
            ProgressEvent(
                "check",
                f"最新版本：游戏 {latest.seed.game_version}，Seed {latest.seed.seed_version}，Hotfix {latest.hotfix.res_version}",
                1,
                1,
            )
        )
        return latest

    def run(self) -> dict[str, Any]:
        return self.run_steps(list(PIPELINE_STAGES))

    def run_steps(self, stages: list[str]) -> dict[str, Any]:
        stages = list(dict.fromkeys(stages))
        invalid = [stage for stage in stages if stage not in PIPELINE_STAGES]
        if invalid:
            raise ValueError(f"未知流程步骤：{', '.join(invalid)}")
        if not stages:
            raise ValueError("没有选择任何流程步骤")
        self.config.validate(require_tool="unpack" in stages)
        if "upload" in stages and not self.config.rclone.is_file():
            raise FileNotFoundError(f"rclone 不存在：{self.config.rclone}")
        work_root = self.config.work_root
        work_root.mkdir(parents=True, exist_ok=True)
        log_stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        self._log_path = TOOL_ROOT / "logs" / f"table-job-{log_stamp}.log"
        self._emit(ProgressEvent("check", f"日志文件：{self._log_path}"))

        try:
            latest = self.check_latest()
            self.token.raise_if_cancelled()
            job_name = self._safe_job_name(latest.hotfix.res_version or latest.seed.seed_version)
            jobs_root = work_root / "jobs"
            if any(stage in {"download", "unpack"} for stage in stages):
                self._remove_obsolete_jobs(jobs_root, job_name)
            job_root = jobs_root / job_name
            job_root.mkdir(parents=True, exist_ok=True)
            self._write_metadata(job_root, latest)
            state: dict[str, Any] = {
                "game_version": latest.seed.game_version,
                "seed_version": latest.seed.seed_version,
                "rand_str": latest.seed.rand_str,
                "hotfix_res_version": latest.hotfix.res_version,
                "hotfix_url": latest.hotfix.request_url,
                "main_version": latest.hotfix.parts["main"].version,
                "initial_version": latest.hotfix.parts["initial"].version,
                "log_path": str(self._log_path),
                "job_path": str(job_root),
            }
            store = StateStore(work_root)
            if "check" in stages:
                store.save_stage(latest.hotfix.res_version, "check", state)

            for stage in stages:
                if stage == "check":
                    continue
                self.token.raise_if_cancelled()
                if stage == "download":
                    values = self._stage_download(latest, job_root)
                elif stage == "unpack":
                    values = self._stage_unpack(latest, job_root)
                elif stage == "validate":
                    values = self._stage_validate(job_root)
                elif stage == "publish":
                    values = self._stage_publish(job_root)
                elif stage == "upload":
                    self._validate_table_cfg(self.config.public_root / "TableCfg", stage="upload")
                    publish_latest = (
                        not self.config.manual_version_enabled
                        or self.config.manual_publish_latest
                    )
                    values = ReleaseManager(self.config, self.token, self._emit).upload_table_cfg(
                        latest,
                        publish_latest=publish_latest,
                    )
                else:
                    raise ValueError(f"未知流程步骤：{stage}")
                state.update(values)
                store.save_stage(latest.hotfix.res_version, stage, state)

            self._emit(
                ProgressEvent(
                    "complete",
                    f"所选步骤执行完成：{', '.join(stages)}",
                    1,
                    1,
                )
            )

            if not self.config.keep_job_files and "publish" in stages:
                self._safe_remove(job_root, work_root / "jobs")
            return state
        except CancelledError:
            self._emit(ProgressEvent("cancelled", "任务已取消；未更新成功版本状态", level="warning"))
            raise
        except Exception as exc:
            self._emit(ProgressEvent("failed", f"任务失败：{exc}", level="error"))
            raise

    def _stage_download(self, latest: LatestInfo, job_root: Path) -> dict[str, Any]:
        index_dir = job_root / "indexes"
        source_root = job_root / "source"
        source_root.mkdir(parents=True, exist_ok=True)
        latest_entries: list[DownloadEntry] = []
        entry_parts: dict[str, ResourcePart] = {}
        self._emit(
            ProgressEvent(
                "download",
                "TableCfg 来源规则：优先复制版本匹配的游戏文件，缺失时从 Hotfix 下载",
            )
        )
        for part_name in SDK_INDEX_PARTS:
            self.token.raise_if_cancelled()
            part = latest.hotfix.parts[part_name]
            self._emit(ProgressEvent("download", f"下载并解密 {part_name} 索引"))
            index_path, index_data = self.client.download_index(part, index_dir)
            self._write_sdk_index(
                index_path,
                source_root / index_path.name,
                index_data,
                part.version,
                part_name == "initial",
            )
            entries = entries_for_blocks(index_data, TABLECFG_HOTFIX_BLOCKS)
            if not entries:
                self._emit(ProgressEvent("download", f"{part_name} 索引中没有匹配区块，跳过", level="warning"))
                continue
            for entry in entries:
                latest_entries.append(entry)
                entry_parts[entry.name] = part

        latest_by_name = {entry.name: entry for entry in latest_entries}
        latest_entries = sorted(latest_by_name.values(), key=lambda item: item.name.lower())
        if not latest_entries:
            raise ValidationError("所有索引中都没有找到需要下载的文件")

        vfs_root = source_root / "VFS"
        vfs_cache = VfsValidationCache(self.config)
        vfs_identity = latest_identity(latest)
        table_cache_hit = vfs_cache.trusted(
            "TableCfg",
            vfs_identity,
            self.config.work_root,
            vfs_root,
            latest_entries,
        )
        trusted_names = {entry.name for entry in latest_entries} if table_cache_hit else set()
        if table_cache_hit:
            self._emit(
                ProgressEvent(
                    "download",
                    f"VFS 可信缓存命中：TableCfg，版本 {vfs_identity['seedVersion']}，"
                    f"Hotfix {vfs_identity['hotfixVersion']}，跳过 {len(latest_entries)} 个文件的 MD5",
                )
            )
        else:
            if vfs_cache.records.get("TableCfg", {}).get("verified") is True:
                vfs_cache.invalidate("TableCfg")
                vfs_cache.persist()
            self._emit(
                ProgressEvent("download", "VFS 可信缓存未命中：TableCfg，执行完整 MD5")
            )

        streaming_entries = self._load_game_entries(
            self.config.game_streaming_assets_dir,
            self.config.streaming_assets_root,
            "StreamingAssets",
        )
        persistent_entries = self._load_game_entries(
            self.config.game_persistent_dir,
            self.config.persistent_root,
            "Persistent",
        )
        copied = 0
        for index, entry in enumerate(latest_entries, 1):
            target = safe_target(source_root, entry.name)
            local_source: Path | None = None
            source_label = ""
            for label, root, local_entries in (
                ("StreamingAssets", self.config.streaming_assets_root, streaming_entries),
                ("Persistent", self.config.persistent_root, persistent_entries),
            ):
                if self._metadata_matches(local_entries.get(entry.name), entry):
                    candidate = safe_target(root, entry.name)
                    if candidate.is_file():
                        local_source = candidate
                        source_label = label
                        break
            if local_source is not None and not target.is_file():
                copy_file_contents(local_source, target, self.token)
                copied += 1
                self._emit(
                    ProgressEvent(
                        "download",
                        f"复制 [{index}/{len(latest_entries)}] [{source_label}] {entry.name}",
                        index,
                        len(latest_entries),
                    )
                )

        prepared_files: list[Path] = []
        for part_name in SDK_INDEX_PARTS:
            part = latest.hotfix.parts[part_name]
            part_entries = [
                entry for entry in latest_entries if entry_parts[entry.name].name == part_name
            ]
            prepared_files.extend(
                self.downloader.download_entries(
                    part.path,
                    part_entries,
                    source_root,
                    self.token,
                    self._emit,
                    trusted_names=trusted_names,
                )
            )
        assert_no_linked_files(source_root, "TableCfg SDK 输入目录")
        if not VfsValidationCache.files_match(vfs_root, latest_entries):
            raise ValidationError("TableCfg VFS 文件大小校验失败")
        self.token.raise_if_cancelled()
        vfs_cache.stage_verified(
            "TableCfg",
            vfs_identity,
            self.config.work_root,
            vfs_root,
            len(latest_entries),
        )
        self.token.raise_if_cancelled()
        vfs_cache.persist()
        self._emit(
            ProgressEvent(
                "download",
                f"VFS 区块校验完成并记录：TableCfg，{len(latest_entries)} 个文件",
            )
        )
        total_bytes = sum(entry.size for entry in latest_entries)
        self._emit(
            ProgressEvent(
                "download",
                f"SDK 输入准备完成，共 {len(prepared_files)} 个文件，本地复制 {copied} 个",
                1,
                1,
            )
        )
        return {
            "downloaded_files": len(prepared_files),
            "downloaded_bytes": total_bytes,
            "game_files_copied": copied,
            "table_sdk_blocks": list(TABLECFG_HOTFIX_BLOCKS),
        }

    def _stage_unpack(self, latest: LatestInfo, job_root: Path) -> dict[str, Any]:
        source_root = job_root / "source"
        unpack_root = job_root / "unpacked"
        data_root = BeyondSdkTableUnpacker(
            self.config.image_sdk,
            self.config.java_path,
        ).unpack(
            source_root,
            unpack_root,
            self.token,
            self._emit,
        )
        self._emit(ProgressEvent("unpack", f"解包/解析完成：{data_root}", 1, 1))
        return {
            "staged_data_path": str(data_root),
            "unpack_task": "standalone VFSTableCfgExtractor",
        }

    def _stage_validate(self, job_root: Path) -> dict[str, Any]:
        staged_data = self._staged_data_root(job_root)
        if not staged_data.is_dir():
            raise FileNotFoundError(f"没有可验证的解包结果，请先执行解包步骤：{staged_data}")
        values: dict[str, Any] = {}
        if "TableCfg" in self.config.blocks:
            table_dir = staged_data / "TableCfg"
            values["table_count"] = self._validate_table_cfg(table_dir)
            values["staged_table_path"] = str(table_dir)
        self._emit(ProgressEvent("validate", f"工作目录解析结果验证通过：{staged_data}", 1, 1))
        return values

    def _stage_publish(self, job_root: Path) -> dict[str, Any]:
        public_root = self.config.public_root
        public_root.mkdir(parents=True, exist_ok=True)
        values: dict[str, Any] = {}
        if "TableCfg" in self.config.blocks:
            source = self._staged_data_root(job_root) / "TableCfg"
            self._validate_table_cfg(source, stage="publish")
            destination = self._replace_directory_copy(
                source, public_root / "TableCfg"
            )
            values["public_table_path"] = str(destination)
        self._emit(ProgressEvent("publish", f"本地 public 发布完成：{public_root}", 1, 1))
        return values

    @staticmethod
    def _safe_job_name(value: str) -> str:
        cleaned = re.sub(r"[^0-9A-Za-z._-]+", "_", value).strip("._")
        return cleaned or datetime.now().strftime("job-%Y%m%d-%H%M%S")

    @staticmethod
    def _format_size(size: int) -> str:
        value = float(size)
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if value < 1024 or unit == "TB":
                return f"{value:.2f} {unit}"
            value /= 1024
        return f"{size} B"

    @staticmethod
    def _write_metadata(job_root: Path, latest: LatestInfo) -> None:
        metadata = {
            "seed": {
                "game_version": latest.seed.game_version,
                "seed_version": latest.seed.seed_version,
                "rand_str": latest.seed.rand_str,
                "package_path": latest.seed.package_path,
            },
            "hotfix_url": latest.hotfix.request_url,
            "hotfix": latest.hotfix.raw,
        }
        path = job_root / "metadata.json"
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(path)

    @staticmethod
    def _write_sdk_index(
        source: Path,
        target: Path,
        index_data: dict[str, Any],
        version: str,
        is_initial: bool,
    ) -> None:
        if not source.is_file():
            raise FileNotFoundError(f"缺少已下载索引：{source}")
        payload = dict(index_data)
        payload["version"] = version
        payload["isInitial"] = is_initial
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(target)

    def _load_game_entries(
        self,
        configured_path: str,
        root: Path,
        label: str,
    ) -> dict[str, DownloadEntry]:
        if not configured_path.strip() or not root.is_dir():
            self._emit(
                ProgressEvent(
                    "download",
                    f"{label} 不存在，跳过本地复用并使用 Hotfix：{configured_path or '未配置'}",
                    level="warning",
                )
            )
            return {}
        entries: dict[str, DownloadEntry] = {}
        for part_name, key in (("main", DEFAULT_KEY), ("initial", INITIAL_KEY)):
            index_path = root / f"index_{part_name}.json"
            if not index_path.is_file():
                self._emit(
                    ProgressEvent(
                        "download",
                        f"{label} 缺少 {index_path.name}，该部分使用 Hotfix",
                        level="warning",
                    )
                )
                continue
            try:
                _, index_data, _ = decrypt_index(
                    index_path.read_text(encoding="utf-8-sig").strip(),
                    hint_key=key,
                )
            except (OSError, ValidationError) as exc:
                self._emit(
                    ProgressEvent(
                        "download",
                        f"{label} 的 {index_path.name} 无法读取，改用 Hotfix：{exc}",
                        level="warning",
                    )
                )
                continue
            for entry in entries_for_blocks(index_data, TABLECFG_HOTFIX_BLOCKS):
                entries[entry.name] = entry
        return entries

    @staticmethod
    def _metadata_matches(local: DownloadEntry | None, latest: DownloadEntry) -> bool:
        return bool(
            local
            and local.size == latest.size
            and local.md5
            and latest.md5
            and local.md5.lower() == latest.md5.lower()
        )

    @staticmethod
    def _staged_data_root(job_root: Path) -> Path:
        candidates = (
            job_root / "unpacked" / "data" / "Data",
            job_root / "unpacked" / "Data",
            job_root / "unpacked" / "data",
        )
        for candidate in candidates:
            if (candidate / "TableCfg").is_dir():
                return candidate
        return candidates[0]

    def _validate_table_cfg(self, table_dir: Path, stage: str = "validate") -> int:
        self._emit(ProgressEvent(stage, f"验证 TableCfg：{table_dir}"))
        if not table_dir.is_dir():
            raise ValidationError(f"TableCfg 目录不存在：{table_dir}")
        json_files = list(table_dir.glob("*.json"))
        if not json_files:
            raise ValidationError("TableCfg 中没有 JSON 文件")
        missing = [name for name in self.config.required_tables if not (table_dir / name).is_file()]
        if missing:
            raise ValidationError(f"TableCfg 缺少关键文件：{', '.join(missing)}")
        for name in self.config.required_tables:
            self.token.raise_if_cancelled()
            try:
                with (table_dir / name).open("r", encoding="utf-8") as stream:
                    json.load(stream)
            except (OSError, json.JSONDecodeError) as exc:
                raise ValidationError(f"关键表不是有效 JSON：{name}：{exc}") from exc
        self._emit(ProgressEvent(stage, f"验证通过，共 {len(json_files)} 个 JSON 文件", 1, 1))
        return len(json_files)

    def _replace_directory_copy(
        self,
        source: Path,
        destination: Path,
    ) -> Path:
        self.token.raise_if_cancelled()
        if not source.is_dir():
            raise FileNotFoundError(f"待发布目录不存在：{source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.parent / f".{destination.name}.ake-staging-{self._timestamp()}"
        if temporary.exists():
            self._safe_remove(temporary, destination.parent)

        files = [path for path in source.rglob("*") if path.is_file()]
        total = sum(path.stat().st_size for path in files)
        copied = 0
        last_reported_percent = -1
        stage = "publish" if self.config.public_root == destination.parent or self.config.public_root in destination.parents else "validate"
        self._emit(ProgressEvent(stage, f"准备目录：{source} -> {destination}", 0, total))
        temporary.mkdir(parents=True)
        try:
            for file_path in files:
                self.token.raise_if_cancelled()
                relative = file_path.relative_to(source)
                target = temporary / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                copy_file_contents(file_path, target, self.token)
                copied += file_path.stat().st_size
                percent = int(copied * 100 / total) if total else 100
                if percent != last_reported_percent or copied == total:
                    self._emit(ProgressEvent(stage, f"复制 {destination.name}/{relative}", copied, total))
                    last_reported_percent = percent
        except Exception:
            self._safe_remove(temporary, destination.parent)
            raise

        assert_no_linked_files(temporary, f"{destination.name} 暂存目录")

        if destination.exists():
            self._emit(ProgressEvent(stage, f"删除旧目录：{destination}"))
            self._safe_remove(destination, destination.parent)
        try:
            shutil.move(str(temporary), str(destination))
            assert_no_linked_files(destination, f"{destination.name} 正式目录")
        except Exception:
            raise
        return destination

    @staticmethod
    def _timestamp() -> str:
        return datetime.now().strftime("%Y%m%d-%H%M%S-%f")

    def _remove_obsolete_jobs(self, jobs_root: Path, current_job_name: str) -> None:
        if not jobs_root.is_dir():
            return
        for path in jobs_root.iterdir():
            self.token.raise_if_cancelled()
            if not path.is_dir() or path.name == current_job_name:
                continue
            self._emit(ProgressEvent("download", f"删除旧版本任务数据：{path}"))
            self._safe_remove(path, jobs_root)

    @staticmethod
    def _safe_remove(path: Path, allowed_parent: Path) -> None:
        resolved = path.resolve()
        parent = allowed_parent.resolve()
        if resolved == parent or parent not in resolved.parents:
            raise AkeToolError(f"拒绝删除范围外目录：{resolved}")
        if resolved.exists():
            shutil.rmtree(resolved)
