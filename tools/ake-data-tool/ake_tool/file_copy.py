from __future__ import annotations

import os
import errno
import hashlib
import shutil
import uuid
from pathlib import Path

from .errors import ValidationError
from .file_facts import cached_fact, file_digest, file_identity, remember_digest
from .models import CancellationToken
from .parallel_files import map_files


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
    known_digest = cached_fact(("md5", file_identity(source)))
    digest = None if known_digest is not None else hashlib.md5()
    try:
        with source.open("rb") as input_stream, temporary.open("xb") as output_stream:
            while chunk := input_stream.read(chunk_size):
                if token is not None:
                    token.raise_if_cancelled()
                output_stream.write(chunk)
                if digest is not None:
                    digest.update(chunk)
        shutil.copystat(source, temporary, follow_symlinks=True)
        os.replace(temporary, target)
        content_digest = known_digest if digest is None else digest.hexdigest()
        remember_digest(source, "md5", content_digest)
        remember_digest(target, "md5", content_digest)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    if is_linked_file(target):
        raise ValidationError(f"内容复制后目标仍是链接文件：{target}")


def move_file_contents(source: Path, target: Path,
                       token: CancellationToken | None = None) -> None:
    """Consume a private extraction file; cross-volume moves copy only once."""
    if token is not None:
        token.raise_if_cancelled()
    if not source.is_file() or is_linked_file(source):
        raise ValidationError(f"移动源不是独立文件：{source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.replace(source, target)
    except OSError as exc:
        if exc.errno != errno.EXDEV and getattr(exc, "winerror", None) != 17:
            raise
        copy_file_contents(source, target, token)
        source.unlink()


def sync_file_contents(source: Path, target: Path,
                       token: CancellationToken | None = None) -> bool:
    """Return whether content was copied; unchanged files keep their identity."""
    if token is not None:
        token.raise_if_cancelled()
    if is_linked_file(source) or is_linked_file(target):
        raise ValidationError(f"增量发布不接受链接文件：{source} -> {target}")
    if target.is_file() and source.stat().st_size == target.stat().st_size:
        if file_digest(source, token=token) == file_digest(target, token=token):
            return False
    copy_file_contents(source, target, token)
    return True


def sync_tree_contents(source: Path, target: Path,
                       token: CancellationToken | None = None, *, checked: bool = False) -> int:
    """Publish a completed export in place, retaining the source for retries.

    Only individual changed files need temporary space. Stale files are removed
    after all writes succeed; interruption is repaired by repeating publication.
    """
    source = source.absolute()
    target = target.absolute()
    if source == target or source in target.parents or target in source.parents:
        raise ValidationError("增量发布源和目标不能相互包含")
    if not checked:
        assert_no_linked_files(source, "增量发布源")
        assert_no_linked_files(target, "增量发布目标")
    files = sorted(path for path in source.rglob("*") if path.is_file())
    if not files:
        raise ValidationError(f"拒绝发布空目录：{source}")
    if target.is_file():
        target.unlink()
    target.mkdir(parents=True, exist_ok=True)
    expected = set()
    jobs = []
    for path in files:
        if token is not None:
            token.raise_if_cancelled()
        relative = path.relative_to(source)
        destination = target / relative
        expected.add(relative)
        for parent in reversed(destination.parents):
            if target in parent.parents and parent.is_file():
                parent.unlink()
        if destination.is_dir():
            shutil.rmtree(destination)
        jobs.append((path, destination))

    def sync_job(job):
        sync_file_contents(job[0], job[1], token)

    for _ in map_files(sync_job, jobs):
        pass
    for path in sorted(target.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if token is not None:
            token.raise_if_cancelled()
        if path.is_file() and path.relative_to(target) not in expected:
            path.unlink()
        elif path.is_dir() and not any(path.iterdir()):
            path.rmdir()
    return len(files)


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
