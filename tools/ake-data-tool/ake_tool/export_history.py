"""Bounded export history; never cleans public data or shared VFS/runtime roots."""
from __future__ import annotations

import shutil
from pathlib import Path

from .errors import ValidationError
from .file_copy import is_directory_link


EXPORT_HISTORY_LIMIT = 3


def prune_exports(work_root: Path, roots: list[Path], *, keep: int = EXPORT_HISTORY_LIMIT,
                  protected=(), extra_exports=(), report=None) -> None:
    work_root = work_root.resolve()
    protected = {Path(path).resolve() for path in protected}
    candidates = []
    for root in roots:
        if not root.exists():
            continue
        resolved = root.resolve()
        if is_directory_link(root) or work_root not in resolved.parents:
            raise ValidationError(f"拒绝清理工作目录之外的历史导出：{root}")
        for path in root.iterdir():
            if path.is_dir() and not is_directory_link(path):
                candidates.append(path)
    for path in extra_exports:
        if not path.exists():
            continue
        resolved = path.resolve()
        if is_directory_link(path) or work_root not in resolved.parents:
            raise ValidationError(f"旧版导出目录越界：{path}")
        if path.is_dir():
            candidates.append(path)
    candidates.sort(key=lambda path: path.stat().st_mtime_ns, reverse=True)
    pinned = {path.resolve() for path in candidates if any(
        path.resolve() == item or path.resolve() in item.parents for item in protected)}
    retained = set(pinned)
    for path in candidates:
        resolved = path.resolve()
        if resolved in retained:
            continue
        if len(retained) < keep:
            retained.add(resolved)
            continue
        # Recheck the exact destructive target against its enumerated parent.
        if resolved.parent != path.parent.resolve() or work_root not in resolved.parents:
            raise ValidationError(f"历史导出清理路径越界：{path}")
        shutil.rmtree(resolved)
        if report is not None:
            report(resolved)
