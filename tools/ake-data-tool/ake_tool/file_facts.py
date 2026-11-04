"""Process-local content facts for the single-user pipeline.

No persisted trust: restarting the tool starts a fresh cache. Replacements,
size changes and timestamp changes invalidate facts before they are reused.
"""
from __future__ import annotations

import hashlib
from collections import OrderedDict
from pathlib import Path
from threading import RLock

from .models import CancellationToken


_facts: OrderedDict = OrderedDict()
_lock = RLock()
_MAX_FACTS = 65536


def file_identity(path: Path) -> tuple:
    stat = path.stat()
    return (str(path.absolute()), stat.st_dev, stat.st_ino, stat.st_size,
            stat.st_mtime_ns, stat.st_ctime_ns, stat.st_mode, stat.st_nlink)


def cached_fact(key: tuple):
    with _lock:
        value = _facts.get(key)
        if value is not None:
            _facts.move_to_end(key)
        return value


def remember_fact(key: tuple, value) -> None:
    with _lock:
        _facts[key] = value
        _facts.move_to_end(key)
        while len(_facts) > _MAX_FACTS:
            _facts.popitem(last=False)


def remember_digest(path: Path, algorithm: str, value: str) -> None:
    remember_fact((algorithm, file_identity(path)), value)


def file_digest(path: Path, algorithm: str = "md5",
                token: CancellationToken | None = None, progress=None) -> str:
    if token is not None:
        token.raise_if_cancelled()
    identity = file_identity(path)
    key = (algorithm, identity)
    value = cached_fact(key)
    if value is not None:
        if progress is not None:
            progress(identity[3], identity[3])
        return value
    digest = hashlib.new(algorithm)
    completed = 0
    with path.open("rb") as stream:
        while chunk := stream.read(4 * 1024 * 1024):
            if token is not None:
                token.raise_if_cancelled()
            digest.update(chunk)
            completed += len(chunk)
            if progress is not None:
                progress(completed, identity[3])
    value = digest.hexdigest()
    remember_fact(key, value)
    return value
