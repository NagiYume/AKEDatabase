from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .downloader import BLOCK_IDS, safe_target
from .errors import ValidationError
from .file_copy import is_linked_file
from .models import DownloadEntry


VFS_VALIDATION_BLOCKS = tuple(BLOCK_IDS)


def default_validation_records() -> dict[str, dict[str, Any]]:
    return {
        name: {"blockId": block_id, "verified": False}
        for name, block_id in BLOCK_IDS.items()
    }


def _normalized_path(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    return str(Path(raw).expanduser().resolve())


def _valid_verified_record(name: str, value: dict[str, Any]) -> dict[str, Any] | None:
    if str(value.get("blockId", "")).upper() != BLOCK_IDS[name]:
        return None
    if value.get("verified") is not True:
        return {"blockId": BLOCK_IDS[name], "verified": False}
    required = (
        "workDir",
        "vfsRoot",
        "gameVersion",
        "seedVersion",
        "hotfixVersion",
        "mainVersion",
        "initialVersion",
    )
    if any(not str(value.get(key, "")).strip() for key in required):
        return None
    try:
        file_count = int(value.get("fileCount", -1))
    except (TypeError, ValueError):
        return None
    if file_count < 0:
        return None
    return {
        "blockId": BLOCK_IDS[name],
        "verified": True,
        "workDir": _normalized_path(value["workDir"]),
        "vfsRoot": _normalized_path(value["vfsRoot"]),
        "gameVersion": str(value["gameVersion"]).strip(),
        "seedVersion": str(value["seedVersion"]).strip(),
        "hotfixVersion": str(value["hotfixVersion"]).strip(),
        "mainVersion": str(value["mainVersion"]).strip(),
        "initialVersion": str(value["initialVersion"]).strip(),
        "fileCount": file_count,
        "validatedAt": str(value.get("validatedAt", "")).strip(),
    }


def normalize_validation_records(value: Any) -> dict[str, dict[str, Any]]:
    records = default_validation_records()
    if not isinstance(value, dict):
        return records
    for name in VFS_VALIDATION_BLOCKS:
        raw = value.get(name)
        if not isinstance(raw, dict):
            continue
        normalized = _valid_verified_record(name, raw)
        if normalized is not None:
            records[name] = normalized
    return records


def latest_identity(latest: Any) -> dict[str, str]:
    return {
        "gameVersion": str(latest.seed.game_version).strip(),
        "seedVersion": str(latest.seed.seed_version).strip(),
        "hotfixVersion": str(latest.hotfix.res_version).strip(),
        "mainVersion": str(latest.hotfix.parts["main"].version).strip(),
        "initialVersion": str(latest.hotfix.parts["initial"].version).strip(),
    }


def entry_relative_path(name: str) -> str:
    parts = str(name).replace("\\", "/").split("/")
    if parts and parts[0] == "VFS":
        parts = parts[1:]
    return "/".join(parts)


class VfsValidationCache:
    def __init__(self, config: Any) -> None:
        self.config = config
        self.records = normalize_validation_records(
            getattr(config, "vfs_validation_records", None)
        )
        self.config.vfs_validation_records = deepcopy(self.records)

    def _record_matches_identity(
        self,
        block: str,
        identity: dict[str, str],
        work_dir: Path,
        vfs_root: Path,
        entries: list[DownloadEntry],
    ) -> bool:
        if block not in BLOCK_IDS or not entries:
            return False
        record = self.records.get(block)
        if not isinstance(record, dict) or record.get("verified") is not True:
            return False
        if str(record.get("blockId", "")).upper() != BLOCK_IDS[block]:
            return False
        if _normalized_path(record.get("workDir")) != _normalized_path(work_dir):
            return False
        if _normalized_path(record.get("vfsRoot")) != _normalized_path(vfs_root):
            return False
        if any(str(record.get(key, "")) != str(value) for key, value in identity.items()):
            return False
        try:
            if int(record.get("fileCount", -1)) != len(entries):
                return False
        except (TypeError, ValueError):
            return False
        return True

    @staticmethod
    def files_match(vfs_root: Path, entries: Iterable[DownloadEntry]) -> bool:
        root = vfs_root.resolve()
        for entry in entries:
            target = safe_target(root, entry_relative_path(entry.name))
            if not target.is_file() or is_linked_file(target):
                return False
            if target.stat().st_size != entry.size:
                return False
        return True

    def trusted(
        self,
        block: str,
        identity: dict[str, str],
        work_dir: Path,
        vfs_root: Path,
        entries: list[DownloadEntry],
    ) -> bool:
        return self._record_matches_identity(block, identity, work_dir, vfs_root, entries) and self.files_match(
            vfs_root, entries
        )

    def stage_verified(
        self,
        block: str,
        identity: dict[str, str],
        work_dir: Path,
        vfs_root: Path,
        file_count: int,
    ) -> None:
        if block not in BLOCK_IDS:
            raise ValidationError(f"未知 VFS 区块：{block}")
        self.records[block] = {
            "blockId": BLOCK_IDS[block],
            "verified": True,
            "workDir": _normalized_path(work_dir),
            "vfsRoot": _normalized_path(vfs_root),
            **{key: str(value) for key, value in identity.items()},
            "fileCount": int(file_count),
            "validatedAt": datetime.now(timezone.utc).isoformat(),
        }
        self.config.vfs_validation_records = deepcopy(self.records)

    def invalidate(self, block: str) -> None:
        if block in BLOCK_IDS:
            self.records[block] = {"blockId": BLOCK_IDS[block], "verified": False}
            self.config.vfs_validation_records = deepcopy(self.records)

    def persist(self) -> None:
        from .config import save_config

        save_config(self.config)

