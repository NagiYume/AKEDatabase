from __future__ import annotations

from dataclasses import dataclass, field
from threading import Event
from typing import Any, Callable

from .errors import CancelledError


@dataclass(frozen=True)
class SeedInfo:
    game_version: str
    seed_version: str
    rand_str: str
    package_path: str


@dataclass(frozen=True)
class ResourcePart:
    name: str
    path: str
    version: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class HotfixInfo:
    request_url: str
    res_version: str
    parts: dict[str, ResourcePart]
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class LatestInfo:
    seed: SeedInfo
    hotfix: HotfixInfo


@dataclass(frozen=True)
class DownloadEntry:
    name: str
    size: int = 0
    md5: str = ""
    url_path: str = ""


@dataclass(frozen=True)
class ProgressEvent:
    stage: str
    message: str
    current: int = 0
    total: int = 0
    level: str = "info"


ProgressCallback = Callable[[ProgressEvent], None]


class CancellationToken:
    def __init__(self) -> None:
        self._event = Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def is_cancelled(self) -> bool:
        return self._event.is_set()

    def raise_if_cancelled(self) -> None:
        if self.is_cancelled:
            raise CancelledError("任务已取消")


def null_progress(_: ProgressEvent) -> None:
    pass
