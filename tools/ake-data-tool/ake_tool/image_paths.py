from __future__ import annotations

import re
import hashlib
import json
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any, Iterable

from .errors import ValidationError


IMAGE_PROFILE_STANDARD = "standard"
IMAGE_PROFILE_FULL = "full"
IMAGE_PROFILES = (IMAGE_PROFILE_STANDARD, IMAGE_PROFILE_FULL)


# 默认图片解析正则由此清单生成；发布阶段直接使用本次解析输出。
LEGACY_IMAGE_COPY_SOURCE_PATHS = (
    "assets/beyond/dynamicassets/gameplay/ui/sprites/gachaweapon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/itemiconbig",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/skillicon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/charprofessionicon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/elementicon",
    "assets/beyond/dynamicassets/gameplay/ui/textures/spaceship/imageposter/largesize",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/monstericonbig",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/medaliconbig",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/activity",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/bufficon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/dungeon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/termicon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/contingencycontract",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/characterportrait",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/sns",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/charroundicon",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/spaceship/spaceshipskillicon",
)

ARCHIVE_IMAGE_COPY_SOURCE_PATHS = (
    "assets/beyond/dynamicassets/gameplay/ui/prefabs/nonnarrative",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/prts",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/reading",
    "assets/beyond/dynamicassets/gameplay/ui/sprites/readingpoplogo",
)

PRE_ITEMTIPS_IMAGE_COPY_SOURCE_PATHS = (
    *LEGACY_IMAGE_COPY_SOURCE_PATHS,
    *ARCHIVE_IMAGE_COPY_SOURCE_PATHS,
)

ITEMTIPS_IMAGE_COPY_SOURCE_PATHS = (
    "assets/beyond/dynamicassets/gameplay/ui/sprites/itemtips",
)

PRE_MAINHUD_IMAGE_COPY_SOURCE_PATHS = (
    *PRE_ITEMTIPS_IMAGE_COPY_SOURCE_PATHS,
    *ITEMTIPS_IMAGE_COPY_SOURCE_PATHS,
)

MAINHUD_IMAGE_COPY_SOURCE_PATHS = (
    "assets/beyond/dynamicassets/gameplay/ui/sprites/mainhud",
)

IMAGE_COPY_SOURCE_PATHS = (
    *PRE_MAINHUD_IMAGE_COPY_SOURCE_PATHS,
    *MAINHUD_IMAGE_COPY_SOURCE_PATHS,
)

FULL_IMAGE_COPY_SOURCE_PATHS = (
    "assets/beyond/dynamicassets/gameplay/ui/sprites",
    "assets/beyond/arts/ui/sprites",
    "assets/beyond/dynamicassets/gameplay/ui/textures",
    "assets/beyond/dynamicassets/gameplay/ui/prefabs/nonnarrative",
)


def minimal_image_source_paths(paths: Iterable[str]) -> tuple[str, ...]:
    normalized = sorted(
        {str(PurePosixPath(path.replace("\\", "/"))).strip("/") for path in paths},
        key=lambda path: (path.count("/"), path),
    )
    roots: list[str] = []
    for path in normalized:
        if any(path == root or path.startswith(root + "/") for root in roots):
            continue
        roots.append(path)
    return tuple(roots)


def build_image_source_filter(paths: Iterable[str]) -> str:
    roots = minimal_image_source_paths(paths)
    return r"^.*(?:" + "|".join(re.escape(path) for path in roots) + r")(?:/|$).*$"


def normalize_image_profile(value: str) -> str:
    profile = str(value).strip().lower()
    if profile not in IMAGE_PROFILES:
        raise ValidationError(f"未知图片配置档案：{value}")
    return profile


def normalize_image_path(value: str) -> str:
    path = str(value).replace("\\", "/").strip().lstrip("/")
    for prefix in ("public/images/", "images/"):
        if path.lower().startswith(prefix):
            path = path[len(prefix) :]
            break
    parts = path.split("/")
    if not path or any(part in {"", ".", ".."} for part in parts):
        raise ValidationError(f"图片路径不安全：{value}")
    return path


def normalize_filter_rules(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ValidationError("image_filter_rules 必须是数组")
    result: list[dict[str, str]] = []
    for raw in value:
        if not isinstance(raw, dict):
            raise ValidationError("图片正则规则必须是对象")
        mode = str(raw.get("mode", "")).strip().lower()
        content = str(raw.get("content", "")).strip()
        if mode not in {"include", "exclude"}:
            raise ValidationError(f"图片正则规则类型只能是 include 或 exclude：{mode or '空值'}")
        if not content:
            raise ValidationError("图片正则单项内容不能为空")
        try:
            re.compile(content, re.IGNORECASE)
        except re.error as exc:
            raise ValidationError(f"图片正则单项无效（{content}）：{exc}") from exc
        result.append({"mode": mode, "content": content})
    return result


def build_containers_filter(rules: list[dict[str, str]]) -> str:
    includes: list[str] = []
    excludes: list[str] = []
    for rule in normalize_filter_rules(rules):
        content = rule["content"]
        if rule["mode"] == "include":
            normalized = str(PurePosixPath(content.replace("\\", "/"))).strip("/")
            if normalized.startswith("assets/") and not re.search(r"[\[\]().*+?{}|^$\\]", normalized):
                includes.append(re.escape(normalized) + r"(?:/|$)")
            else:
                includes.append(content)
        else:
            excludes.append(content)
    parts = ["^"]
    if excludes:
        parts.append(f"(?!.*(?:{'|'.join(excludes)}))")
    if includes:
        parts.append(f".*(?:{'|'.join(includes)})")
    if len(parts) == 1:
        return ""
    parts.append(".*$")
    return "".join(parts)


@dataclass(frozen=True)
class ImageParsingConfig:
    image_containers_filter: str
    image_filter_rules: tuple[tuple[str, str], ...]
    updated_at: str = ""

    @classmethod
    def from_dict(cls, value: Any, *, require_rules: bool = True) -> "ImageParsingConfig":
        if not isinstance(value, dict):
            raise ValidationError("图片配置档案不是对象")
        containers_filter = str(value.get("image_containers_filter", "")).strip()
        if not containers_filter:
            raise ValidationError("image_containers_filter 不能为空")
        try:
            re.compile(containers_filter, re.IGNORECASE)
        except re.error as exc:
            raise ValidationError(f"图片 containers_filter 正则无效：{exc}") from exc
        rules = normalize_filter_rules(value.get("image_filter_rules"))
        if require_rules and not rules:
            raise ValidationError("image_filter_rules 不能为空")
        return cls(
            image_containers_filter=containers_filter,
            image_filter_rules=tuple((rule["mode"], rule["content"]) for rule in rules),
            updated_at=str(value.get("updatedAt", "")).strip(),
        )

    def to_dict(self, *, include_updated_at: bool = True) -> dict[str, Any]:
        result: dict[str, Any] = {
            "image_containers_filter": self.image_containers_filter,
            "image_filter_rules": [
                {"mode": mode, "content": content}
                for mode, content in self.image_filter_rules
            ],
        }
        if include_updated_at and self.updated_at:
            result["updatedAt"] = self.updated_at
        return result

    def digest(self) -> str:
        payload = json.dumps(
            self.to_dict(include_updated_at=False),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class ImagePathMatcher:
    def __init__(self, config: ImageParsingConfig) -> None:
        self.config = config
        try:
            self._pattern = re.compile(config.image_containers_filter, re.IGNORECASE)
        except re.error as exc:
            raise ValidationError(f"图片 containers_filter 正则无效：{exc}") from exc

    def matches(self, value: str) -> bool:
        return bool(self._pattern.search(normalize_image_path(value)))

    def project(self, paths: Iterable[str]) -> set[str]:
        return {path for path in paths if self.matches(path)}


LEGACY_IMAGE_SOURCE_ROOTS = minimal_image_source_paths(LEGACY_IMAGE_COPY_SOURCE_PATHS)
LEGACY_BOUNDED_DEFAULT_IMAGE_CONTAINERS_FILTER = build_image_source_filter(
    LEGACY_IMAGE_SOURCE_ROOTS
)
LEGACY_DEFAULT_IMAGE_CONTAINERS_FILTER = (
    r"^.*(?:" + "|".join(re.escape(path) for path in LEGACY_IMAGE_SOURCE_ROOTS) + r").*$"
)

PRE_ITEMTIPS_IMAGE_SOURCE_ROOTS = minimal_image_source_paths(
    PRE_ITEMTIPS_IMAGE_COPY_SOURCE_PATHS
)
PRE_ITEMTIPS_DEFAULT_IMAGE_CONTAINERS_FILTER = build_image_source_filter(
    PRE_ITEMTIPS_IMAGE_SOURCE_ROOTS
)

PRE_MAINHUD_IMAGE_SOURCE_ROOTS = minimal_image_source_paths(
    PRE_MAINHUD_IMAGE_COPY_SOURCE_PATHS
)
PRE_MAINHUD_DEFAULT_IMAGE_CONTAINERS_FILTER = build_image_source_filter(
    PRE_MAINHUD_IMAGE_SOURCE_ROOTS
)

IMAGE_SOURCE_ROOTS = minimal_image_source_paths(IMAGE_COPY_SOURCE_PATHS)
DEFAULT_IMAGE_CONTAINERS_FILTER = build_image_source_filter(IMAGE_SOURCE_ROOTS)
FULL_IMAGE_SOURCE_ROOTS = minimal_image_source_paths(FULL_IMAGE_COPY_SOURCE_PATHS)
FULL_IMAGE_CONTAINERS_FILTER = build_image_source_filter(FULL_IMAGE_SOURCE_ROOTS)

# beyond-sdk 的内置容器映射缺少这个索引目录。与内置目录混合筛选时，
# SDK 会静默丢弃它们，因此需要用一条不会命中内置映射的精确正则补充解析。
SDK_UNMAPPED_IMAGE_SOURCE_ROOTS = (
    "assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon",
)

# 这些目录由旧 COPY_RULES 生成；切换到原始 assets 路径时可以安全移除。
LEGACY_MANAGED_IMAGE_DIRS = (
    "achievement",
    "activity",
    "BuffIcon",
    "character",
    "contingencycontract",
    "dungeon",
    "enemy",
    "equip",
    "item",
    "TermIcon",
    "weapon",
)
