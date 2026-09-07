from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .image_paths import (
    DEFAULT_IMAGE_CONTAINERS_FILTER,
    FULL_IMAGE_CONTAINERS_FILTER,
    FULL_IMAGE_SOURCE_ROOTS,
    IMAGE_SOURCE_ROOTS,
    IMAGE_PROFILE_FULL,
    IMAGE_PROFILE_STANDARD,
    IMAGE_PROFILES,
    ImageParsingConfig,
    LEGACY_BOUNDED_DEFAULT_IMAGE_CONTAINERS_FILTER,
    LEGACY_DEFAULT_IMAGE_CONTAINERS_FILTER,
    LEGACY_IMAGE_SOURCE_ROOTS,
    PRE_ITEMTIPS_DEFAULT_IMAGE_CONTAINERS_FILTER,
    PRE_ITEMTIPS_IMAGE_SOURCE_ROOTS,
    PRE_MAINHUD_DEFAULT_IMAGE_CONTAINERS_FILTER,
    PRE_MAINHUD_IMAGE_SOURCE_ROOTS,
    build_containers_filter,
    normalize_image_profile,
)
from .vfs_validation_cache import normalize_validation_records


TOOL_ROOT = Path(__file__).resolve().parent.parent
TOOLS_ROOT = TOOL_ROOT.parent
CONFIG_FILE = TOOL_ROOT / "config.local.json"
EXAMPLE_CONFIG_FILE = TOOL_ROOT / "config.example.json"
LEGACY_IMAGE_CONTAINERS_FILTER = (
    r"^(deco_|shop_|bg_|Terrain_|sns_|m_|LAYER_|guide_|remotecomm_|wiki_|T_|l_|"
    r"reading_|btn_|line_|shadow_|decal_|chapter_).*"
)
DEFAULT_IMAGE_FILTER_CONTENTS = list(IMAGE_SOURCE_ROOTS)
LEGACY_DEFAULT_IMAGE_FILTER_CONTENTS = list(LEGACY_IMAGE_SOURCE_ROOTS)
PRE_ITEMTIPS_DEFAULT_IMAGE_FILTER_CONTENTS = list(PRE_ITEMTIPS_IMAGE_SOURCE_ROOTS)
PRE_MAINHUD_DEFAULT_IMAGE_FILTER_CONTENTS = list(PRE_MAINHUD_IMAGE_SOURCE_ROOTS)


def default_image_filter_rules() -> list[dict[str, str]]:
    return [{"mode": "include", "content": content} for content in DEFAULT_IMAGE_FILTER_CONTENTS]


def default_full_image_filter_rules() -> list[dict[str, str]]:
    return [{"mode": "include", "content": content} for content in FULL_IMAGE_SOURCE_ROOTS]


def default_image_parsing_configs() -> dict[str, dict[str, Any]]:
    return {
        IMAGE_PROFILE_STANDARD: {
            "image_containers_filter": DEFAULT_IMAGE_CONTAINERS_FILTER,
            "image_filter_rules": default_image_filter_rules(),
        },
        IMAGE_PROFILE_FULL: {
            "image_containers_filter": FULL_IMAGE_CONTAINERS_FILTER,
            "image_filter_rules": default_full_image_filter_rules(),
        },
    }


def normalize_containers_filter(value: str) -> str:
    normalized = value.strip()
    if normalized.startswith("--containers_filter"):
        normalized = normalized[len("--containers_filter") :].lstrip()
        if normalized.startswith("="):
            normalized = normalized[1:].lstrip()
    if len(normalized) >= 2 and normalized[0] == normalized[-1] and normalized[0] in {'"', "'"}:
        normalized = normalized[1:-1]
    return normalized


def _uses_default_image_filter_rules(raw: Any, expected: list[str]) -> bool:
    if raw is None:
        return True
    if not isinstance(raw, list) or not raw:
        return False
    contents: list[str] = []
    for rule in raw:
        if not isinstance(rule, dict):
            return False
        if str(rule.get("mode", "")).strip().lower() != "include":
            return False
        content = str(rule.get("content", "")).strip()
        if not content:
            return False
        contents.append(content)
    return sorted(set(contents)) == sorted(set(expected)) and len(contents) == len(expected)


@dataclass
class AppConfig:
    appcode: str = "6LL0KJuqHBVz33WK"
    rclone_path: str = r"D:\Program Files\rclone\rclone.exe"
    public_dir: str = str(TOOLS_ROOT.parent / "public")
    parts: list[str] = field(default_factory=lambda: ["main", "initial"])
    blocks: list[str] = field(default_factory=lambda: ["TableCfg"])
    request_timeout: int = 60
    retries: int = 3
    verify_md5: bool = True
    keep_job_files: bool = True
    watch_interval: int = 60
    watch_update_on_start: bool = True
    watch_upload_r2: bool = False
    manual_version_enabled: bool = False
    manual_seed_version: str = ""
    manual_rand_str: str = ""
    manual_publish_latest: bool = False
    r2_remote: str = "r2"
    r2_bucket: str = "akedatabase"
    image_sdk_path: str = r"D:\资料\code\终末地解包\图片素材下载\beyond-sdk.jar"
    java_path: str = "java"
    game_streaming_assets_dir: str = (
        r"E:\Program Files\Hypergryph Launcher\games\Endfield Game\Endfield_Data\StreamingAssets"
    )
    game_persistent_dir: str = (
        r"E:\Program Files\Hypergryph Launcher\games\Endfield Game\Endfield_Data\Persistent"
    )
    # VFS 始终复制为独立文件，工作目录需预留 36+ GiB 空间。
    image_work_dir: str = r"E:\AKEImageWork"
    image_verify_md5: bool = True
    image_containers_filter: str = DEFAULT_IMAGE_CONTAINERS_FILTER
    image_filter_rules: list[dict[str, str]] = field(default_factory=default_image_filter_rules)
    image_parsing_configs: dict[str, dict[str, Any]] = field(
        default_factory=default_image_parsing_configs
    )
    image_read_cloud_config: bool = True
    image_map_upload_version: str = ""
    asset_upload_from_delta_map: bool = False
    asset_manual_update: bool = False
    vfs_validation_records: dict[str, dict[str, Any]] = field(
        default_factory=normalize_validation_records
    )
    required_tables: list[str] = field(
        default_factory=lambda: ["ItemTable.json", "CharacterTable.json", "EnemyTable.json"]
    )

    @property
    def rclone(self) -> Path:
        return Path(self.rclone_path).expanduser().resolve()

    @property
    def work_root(self) -> Path:
        return self.image_work_root

    @property
    def public_root(self) -> Path:
        return Path(self.public_dir).expanduser().resolve()

    @property
    def image_sdk(self) -> Path:
        return Path(self.image_sdk_path).expanduser().resolve()

    @property
    def streaming_assets_root(self) -> Path:
        return Path(self.game_streaming_assets_dir).expanduser().resolve()

    @property
    def persistent_root(self) -> Path:
        return Path(self.game_persistent_dir).expanduser().resolve()

    @property
    def image_work_root(self) -> Path:
        return Path(self.image_work_dir).expanduser().resolve()

    def validate(self, require_tool: bool = False) -> None:
        if not self.appcode.strip() or any(character.isspace() for character in self.appcode):
            raise ValueError("appcode 不能为空或包含空白字符")
        if self.request_timeout <= 0:
            raise ValueError("request_timeout 必须大于 0")
        if self.retries < 1:
            raise ValueError("retries 必须至少为 1")
        self._validate_work_root()
        if self.watch_interval < 1:
            raise ValueError("watch_interval 不能小于 1 秒")
        if self.manual_version_enabled:
            if not re.fullmatch(r"\d+\.\d+\.\d+", self.manual_seed_version.strip()):
                raise ValueError("手动游戏版本格式无效，应类似 1.2.5")
            if not re.fullmatch(r"[A-Za-z0-9_-]+", self.manual_rand_str.strip()):
                raise ValueError("手动 rand_str 只能包含字母、数字、下划线或连字符")
        if not self.r2_remote.strip() or not self.r2_bucket.strip():
            raise ValueError("R2 Remote 和 Bucket 不能为空")
        if self.image_map_upload_version.strip() and not re.fullmatch(
            r"\d+\.\d+\.\d+@[0-9A-Za-z._-]+",
            self.image_map_upload_version.strip(),
        ):
            raise ValueError(
                "Map 上传版本格式无效，应类似 1.2.5@1242134-1"
            )
        if set(self.parts) != {"main", "initial"}:
            raise ValueError("beyond-sdk TableCfg 解析必须同时准备 main 和 initial")
        if not self.blocks:
            raise ValueError("至少需要选择一个下载区块")
        if self.blocks != ["TableCfg"]:
            raise ValueError("当前工具只允许处理 TableCfg；JsonData 请手动更新")
        if require_tool:
            if not self.java_path.strip():
                raise ValueError("Java 命令不能为空")
            if not self.image_sdk.is_file():
                raise FileNotFoundError(f"beyond-sdk.jar 不存在：{self.image_sdk}")

    def image_config(self, profile: str) -> ImageParsingConfig:
        profile = normalize_image_profile(profile)
        raw = self.image_parsing_configs.get(profile)
        if not isinstance(raw, dict):
            raw = (
                {
                    "image_containers_filter": self.image_containers_filter,
                    "image_filter_rules": self.image_filter_rules,
                }
                if profile == IMAGE_PROFILE_STANDARD
                else default_image_parsing_configs()[IMAGE_PROFILE_FULL]
            )
        return ImageParsingConfig.from_dict(raw)

    def validate_images(
        self,
        require_sources: bool = True,
        profile: str | None = None,
    ) -> None:
        if not self.java_path.strip():
            raise ValueError("Java 命令不能为空")
        if not self.image_verify_md5:
            raise ValueError("最新图片素材流程必须启用 MD5 校验")
        self._validate_work_root()
        profiles = (normalize_image_profile(profile),) if profile else IMAGE_PROFILES
        for selected in profiles:
            self.image_config(selected)
        if require_sources:
            if not self.image_sdk.is_file():
                raise FileNotFoundError(f"beyond-sdk.jar 不存在：{self.image_sdk}")

    def _validate_work_root(self) -> None:
        work_root = self.work_root
        if work_root == Path(work_root.anchor):
            raise ValueError("统一工作目录不能是磁盘根目录")
        for configured_path, source_root, label in (
            (self.game_streaming_assets_dir, self.streaming_assets_root, "StreamingAssets"),
            (self.game_persistent_dir, self.persistent_root, "Persistent"),
        ):
            if not configured_path.strip() or not source_root.is_dir():
                continue
            if work_root == source_root or source_root in work_root.parents:
                raise ValueError(f"统一工作目录不能位于 {label} 内部")

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["vfs_validation_records"] = normalize_validation_records(
            self.vfs_validation_records
        )
        standard = self.image_config(IMAGE_PROFILE_STANDARD).to_dict()
        result["image_containers_filter"] = standard["image_containers_filter"]
        result["image_filter_rules"] = standard["image_filter_rules"]
        result["image_parsing_configs"] = {
            profile: self.image_config(profile).to_dict()
            for profile in IMAGE_PROFILES
        }
        return result

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AppConfig":
        allowed = cls.__dataclass_fields__.keys()
        values = {key: value for key, value in raw.items() if key in allowed}
        values["asset_upload_from_delta_map"] = raw.get("asset_upload_from_delta_map") is True
        values["asset_manual_update"] = raw.get("asset_manual_update") is True
        values["vfs_validation_records"] = normalize_validation_records(
            raw.get("vfs_validation_records")
        )
        if "image_containers_filter" not in values:
            if any(
                _uses_default_image_filter_rules(raw.get("image_filter_rules"), expected)
                for expected in (
                    LEGACY_DEFAULT_IMAGE_FILTER_CONTENTS,
                    PRE_ITEMTIPS_DEFAULT_IMAGE_FILTER_CONTENTS,
                    PRE_MAINHUD_DEFAULT_IMAGE_FILTER_CONTENTS,
                )
            ):
                values["image_filter_rules"] = default_image_filter_rules()
                values["image_containers_filter"] = DEFAULT_IMAGE_CONTAINERS_FILTER
            elif "image_filter_rules" in values:
                values["image_containers_filter"] = build_containers_filter(
                    values["image_filter_rules"]
                )
            standard_filter = str(values.get("image_containers_filter", DEFAULT_IMAGE_CONTAINERS_FILTER))
            standard_rules = values.get("image_filter_rules", default_image_filter_rules())
            profiles = raw.get("image_parsing_configs")
            if not isinstance(profiles, dict):
                profiles = default_image_parsing_configs()
            profiles = dict(profiles)
            profiles.setdefault(
                IMAGE_PROFILE_STANDARD,
                {"image_containers_filter": standard_filter, "image_filter_rules": standard_rules},
            )
            profiles.setdefault(IMAGE_PROFILE_FULL, default_image_parsing_configs()[IMAGE_PROFILE_FULL])
            values["image_parsing_configs"] = profiles
            return cls(**values)
        containers_filter = normalize_containers_filter(
            str(values.get("image_containers_filter", ""))
        )
        old_defaults = {
            LEGACY_IMAGE_CONTAINERS_FILTER,
            r"^.*(?:assets/beyond/dynamicassets/gameplay/ui).*$",
            LEGACY_BOUNDED_DEFAULT_IMAGE_CONTAINERS_FILTER,
            LEGACY_DEFAULT_IMAGE_CONTAINERS_FILTER,
        }
        uses_legacy_default = containers_filter in old_defaults and _uses_default_image_filter_rules(
            raw.get("image_filter_rules"), LEGACY_DEFAULT_IMAGE_FILTER_CONTENTS
        )
        uses_pre_itemtips_default = (
            containers_filter == PRE_ITEMTIPS_DEFAULT_IMAGE_CONTAINERS_FILTER
            and _uses_default_image_filter_rules(
                raw.get("image_filter_rules"), PRE_ITEMTIPS_DEFAULT_IMAGE_FILTER_CONTENTS
            )
        )
        uses_pre_mainhud_default = (
            containers_filter == PRE_MAINHUD_DEFAULT_IMAGE_CONTAINERS_FILTER
            and _uses_default_image_filter_rules(
                raw.get("image_filter_rules"), PRE_MAINHUD_DEFAULT_IMAGE_FILTER_CONTENTS
            )
        )
        if uses_legacy_default or uses_pre_itemtips_default or uses_pre_mainhud_default:
            values["image_containers_filter"] = DEFAULT_IMAGE_CONTAINERS_FILTER
            values["image_filter_rules"] = default_image_filter_rules()
        else:
            values["image_containers_filter"] = containers_filter
        profiles = raw.get("image_parsing_configs")
        if not isinstance(profiles, dict):
            profiles = {}
        profiles = dict(profiles)
        profiles.setdefault(
            IMAGE_PROFILE_STANDARD,
            {
                "image_containers_filter": values["image_containers_filter"],
                "image_filter_rules": values.get("image_filter_rules", default_image_filter_rules()),
            },
        )
        profiles.setdefault(IMAGE_PROFILE_FULL, default_image_parsing_configs()[IMAGE_PROFILE_FULL])
        for profile in IMAGE_PROFILES:
            parsed = ImageParsingConfig.from_dict(profiles[profile])
            profiles[profile] = parsed.to_dict()
        values["image_parsing_configs"] = profiles
        standard = ImageParsingConfig.from_dict(profiles[IMAGE_PROFILE_STANDARD])
        values["image_containers_filter"] = standard.image_containers_filter
        values["image_filter_rules"] = standard.to_dict()["image_filter_rules"]
        values["image_read_cloud_config"] = bool(raw.get("image_read_cloud_config", True))
        return cls(**values)


def load_config(path: Path = CONFIG_FILE, create: bool = True) -> AppConfig:
    if not path.exists():
        config = AppConfig()
        if create:
            save_config(config, path)
        return config
    with path.open("r", encoding="utf-8") as stream:
        raw = json.load(stream)
    config = AppConfig.from_dict(raw)
    config.validate(require_tool=False)
    return config


def save_config(config: AppConfig, path: Path = CONFIG_FILE) -> None:
    config.validate(require_tool=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)
