from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from .errors import ValidationError
from .models import CancellationToken


def is_linked_file(path: Path) -> bool:
    if path.is_symlink():
        return True
    try:
        return path.is_file() and path.stat().st_nlink > 1
    except FileNotFoundError:
        return False


def is_directory_link(path: Path) -> bool:
    is_junction = getattr(path, "is_junction", None)
    return path.is_symlink() or bool(is_junction and is_junction())


def linked_paths(root: Path) -> list[Path]:
    linked: list[Path] = []
    if not root.exists():
        return linked
    if is_directory_link(root):
        return [root]
    for current, directory_names, file_names in os.walk(root, followlinks=False):
        current_path = Path(current)
        for name in list(directory_names):
            candidate = current_path / name
            if is_directory_link(candidate):
                linked.append(candidate)
                directory_names.remove(name)
        for name in file_names:
            candidate = current_path / name
            if is_linked_file(candidate):
                linked.append(candidate)
    return linked


def assert_no_linked_files(root: Path, label: str) -> None:
    linked = linked_paths(root)
    if linked:
        sample = "、".join(str(path) for path in linked[:3])
        suffix = "" if len(linked) <= 3 else f" 等 {len(linked)} 项"
        raise ValidationError(f"{label} 中存在硬链接、符号链接或目录联接：{sample}{suffix}")


def copy_file_contents(
    source: Path,
    target: Path,
    token: CancellationToken | None = None,
    chunk_size: int = 8 * 1024 * 1024,
) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"复制源文件不存在：{source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.name}.ake-copy-{uuid.uuid4().hex}.tmp")
    try:
        with source.open("rb") as input_stream, temporary.open("xb") as output_stream:
            while chunk := input_stream.read(chunk_size):
                if token is not None:
                    token.raise_if_cancelled()
                output_stream.write(chunk)
        shutil.copystat(source, temporary, follow_symlinks=True)
        os.replace(temporary, target)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    if is_linked_file(target):
        raise ValidationError(f"内容复制后目标仍是链接文件：{target}")


def copy_tree_contents(
    source: Path,
    target: Path,
    token: CancellationToken | None = None,
) -> int:
    if not source.is_dir():
        raise FileNotFoundError(f"复制源目录不存在：{source}")
    if is_directory_link(source):
        raise ValidationError(f"复制源目录是符号链接或目录联接：{source}")
    if target.exists():
        raise FileExistsError(f"复制目标目录已存在：{target}")
    target.mkdir(parents=True)
    copied = 0
    try:
        for current, directory_names, file_names in os.walk(source, followlinks=False):
            if token is not None:
                token.raise_if_cancelled()
            current_path = Path(current)
            relative = current_path.relative_to(source)
            target_current = target / relative
            for name in directory_names:
                directory = current_path / name
                if is_directory_link(directory):
                    raise ValidationError(f"复制源目录中存在符号链接或目录联接：{directory}")
                (target_current / name).mkdir(parents=True, exist_ok=True)
            for name in file_names:
                copy_file_contents(current_path / name, target_current / name, token)
                copied += 1
        assert_no_linked_files(target, "复制目标目录")
        return copied
    except Exception:
        if target.exists():
            shutil.rmtree(target)
        raise
