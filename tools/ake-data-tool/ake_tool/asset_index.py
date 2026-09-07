from __future__ import annotations

import hashlib
import json
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .errors import ValidationError
from .file_copy import is_linked_file
from .image_paths import ImageParsingConfig, ImagePathMatcher, IMAGE_PROFILES


INDEX_SCHEMA_VERSION = 2
JSON_MANIFEST_NAME = "manifest.json"
MD5_PATTERN = re.compile(r"^[0-9a-f]{32}$")
ASSET_VERSION_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+$")


def validate_relative_path(value: Any, label: str = "路径") -> str:
    path = str(value).replace("\\", "/")
    parts = path.split("/")
    if (
        not path
        or path.startswith("/")
        or "\n" in path
        or "\r" in path
        or any(part in {"", ".", ".."} for part in parts)
        or Path(path).is_absolute()
        or re.match(r"^[A-Za-z]:", path)
    ):
        raise ValidationError(f"{label}不安全：{value}")
    return path


def _file_record(path: Path, root: Path, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    digest = hashlib.md5()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    record: dict[str, Any] = {"size": path.stat().st_size, "md5": digest.hexdigest()}
    if meta:
        record["meta"] = meta
    return record


def _mission_meta(path: Path) -> dict[str, Any] | None:
    if path.stem.endswith("_meta"):
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"无法读取任务 Json：{path}：{exc}") from exc
    if not isinstance(payload, dict):
        raise ValidationError(f"任务 Json 根节点不是对象：{path}")
    importance = payload.get("baseMissionImportance")
    meta_path = path.with_name(f"{path.stem}_meta.json")
    if meta_path.is_file():
        try:
            sidecar = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValidationError(f"无法读取任务 Meta Json：{meta_path}：{exc}") from exc
        if isinstance(sidecar, dict):
            importance = sidecar.get("missionImportance", importance)
    if isinstance(importance, int) and 0 <= importance <= 2:
        importance += 1
    name = payload.get("missionName")
    quests = payload.get("questDic")
    quests = quests if isinstance(quests, dict) else {}
    return {
        "missionName": {"key": name.get("key")} if isinstance(name, dict) and name.get("key") else {},
        "missionType": payload.get("missionType"),
        "missionChapterBitmask": payload.get("missionChapterBitmask", 0),
        "missionImportance": importance,
        "questCount": len(quests),
        "objectiveCount": sum(
            len(item.get("objectiveList", []))
            for item in quests.values()
            if isinstance(item, dict) and isinstance(item.get("objectiveList", []), list)
        ),
    }


def _level_data_meta(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"无法读取 LevelData Json：{path}：{exc}") from exc
    if not isinstance(payload, dict):
        raise ValidationError(f"LevelData Json 根节点不是对象：{path}")

    dialog_ids: list[str] = []
    seen: set[str] = set()
    interactives = payload.get("interactives")
    if not isinstance(interactives, list):
        interactives = []
    for interactive in interactives:
        if not isinstance(interactive, dict) or interactive.get("entityType") != "Interactive":
            continue
        component_properties = interactive.get("componentProperties")
        if not isinstance(component_properties, dict):
            continue
        narrative_components = component_properties.get("NarrativeComponent")
        if not isinstance(narrative_components, list):
            continue
        for component in narrative_components:
            if not isinstance(component, dict) or component.get("key") != "type_id":
                continue
            value = component.get("value")
            value_array = value.get("valueArray") if isinstance(value, dict) else None
            if not isinstance(value_array, list):
                continue
            for entry in value_array:
                dialog_id = entry.get("valueString") if isinstance(entry, dict) else None
                if isinstance(dialog_id, str) and dialog_id.startswith("dlg_") and dialog_id not in seen:
                    seen.add(dialog_id)
                    dialog_ids.append(dialog_id)
    factory_mines: list[dict[str, Any]] = []
    raw_mines = payload.get("factoryMines")
    if not isinstance(raw_mines, list) or not raw_mines:
        return {"narrativeDialogIds": dialog_ids}
    for mine in raw_mines:
        if not isinstance(mine, dict):
            continue
        mine_id = mine.get("logicMineDataId")
        item_id = mine.get("itemId")
        density = mine.get("densityLevel")
        if not isinstance(mine_id, int) or isinstance(mine_id, bool):
            continue
        if not isinstance(item_id, str) or not item_id:
            continue
        if not isinstance(density, list) or len(density) % 2:
            continue
        if any(not isinstance(value, (int, float)) or isinstance(value, bool) for value in density):
            continue
        entry: dict[str, Any] = {
            "logicMineDataId": mine_id,
            "protoId": str(mine.get("protoId", "")),
            "itemId": item_id,
            "densityLevel": density,
        }
        position = mine.get("trans", {}).get("voxelPosition") if isinstance(mine.get("trans"), dict) else None
        if isinstance(position, dict) and all(isinstance(position.get(axis), (int, float)) for axis in ("x", "y", "z")):
            entry["voxelPosition"] = [position["x"], position["y"], position["z"]]
        factory_mines.append(entry)
    modified_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    return {"narrativeDialogIds": dialog_ids, "factoryMines": factory_mines, "mapModifiedAt": modified_at, "metadataSchemaVersion": 2}


def _level_script_meta(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"无法读取 LevelScriptData Json：{path}：{exc}") from exc
    if not isinstance(payload, dict):
        raise ValidationError(f"LevelScriptData Json 根节点不是对象：{path}")

    content_ids: list[str] = []
    uniq_ids: list[str] = []
    seen_content: set[str] = set()
    seen_uniq: set[str] = set()

    def add_content(value: Any) -> None:
        if (
            isinstance(value, str)
            and re.match(r"^(?:text|radio)_", value)
            and value not in seen_content
        ):
            seen_content.add(value)
            content_ids.append(value)

    def add_uniq(value: Any) -> None:
        if isinstance(value, str) and value and value not in seen_uniq:
            seen_uniq.add(value)
            uniq_ids.append(value)

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            if value.get("key") == "type_id":
                component_value = value.get("value")
                value_array = component_value.get("valueArray") if isinstance(component_value, dict) else None
                if isinstance(value_array, list):
                    for entry in value_array:
                        if isinstance(entry, dict):
                            add_content(entry.get("valueString"))
            terminal_id = value.get("_terminalUniqId")
            if isinstance(terminal_id, dict):
                add_uniq(terminal_id.get("constValue"))
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(payload)
    if not content_ids and not uniq_ids:
        return {}
    return {
        "narrativeReadingContentIds": content_ids,
        "narrativeReadingUniqIds": uniq_ids,
    }


def _json_meta(path: Path, relative: str) -> dict[str, Any] | None:
    if relative.startswith("MissionRuntimeAsset/"):
        return _mission_meta(path)
    if relative.startswith("LevelScriptData/") and relative.lower().endswith(".json"):
        return _level_script_meta(path)
    if relative.startswith("LevelData/") and relative.lower().endswith(".json"):
        return _level_data_meta(path)
    return None


def scan_dataset(root: Path, kind: str, skip_json_manifests: bool = False) -> dict[str, Any]:
    root = root.resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"数据目录不存在：{root}")
    files: dict[str, dict[str, Any]] = {}
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = validate_relative_path(path.relative_to(root).as_posix())
        if skip_json_manifests and path.name == JSON_MANIFEST_NAME:
            continue
        meta = _json_meta(path, relative) if kind == "json" else None
        files[relative] = _file_record(path, root, meta)
    if not files:
        raise ValidationError(f"数据目录为空：{root}")
    return {"root": f"public/{'Json' if kind == 'json' else 'images'}", "files": files}


def scan_selected_dataset(
    root: Path,
    kind: str,
    paths: list[str],
    skip_json_manifests: bool = False,
) -> dict[str, Any]:
    """Scan only an already-authorized, normalized set of relative paths."""
    root = root.resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"数据目录不存在：{root}")
    files: dict[str, dict[str, Any]] = {}
    invalid: list[str] = []
    for raw_path in sorted(set(paths)):
        relative = validate_relative_path(raw_path, "差分图片路径")
        candidate = (root / relative).resolve()
        if root not in candidate.parents or not candidate.is_file() or is_linked_file(candidate):
            invalid.append(relative)
            continue
        if skip_json_manifests and candidate.name == JSON_MANIFEST_NAME:
            continue
        meta = _json_meta(candidate, relative) if kind == "json" else None
        files[relative] = _file_record(candidate, root, meta)
    if invalid:
        sample = "、".join(invalid[:5])
        suffix = "" if len(invalid) <= 5 else f" 等 {len(invalid)} 项"
        raise ValidationError(
            f"差分图片范围中有 {len(invalid)} 个本地文件缺失、非普通文件或路径无效：{sample}{suffix}；"
            "请重新执行图片解析和图片发布"
        )
    return {"root": f"public/{'Json' if kind == 'json' else 'images'}", "files": files}


def build_asset_index(
    public_root: Path,
    include_json: bool = True,
    include_images: bool = True,
    asset_version: str = "",
) -> dict[str, Any]:
    if not ASSET_VERSION_PATTERN.fullmatch(asset_version):
        raise ValidationError("构建资产索引必须提供 游戏版本@热更新版本")
    datasets: dict[str, Any] = {}
    if include_images:
        datasets["images"] = scan_dataset(public_root / "images", "images")
    if include_json:
        datasets["json"] = scan_dataset(public_root / "Json", "json", skip_json_manifests=True)
    if not datasets:
        raise ValidationError("至少需要选择图片或 Json 数据")
    for dataset in datasets.values():
        for record in dataset["files"].values():
            record["version"] = asset_version
    revision = datetime.now(timezone.utc).isoformat()
    return {"schemaVersion": INDEX_SCHEMA_VERSION, "revision": revision, "updatedAt": revision, "datasets": datasets}


def validate_asset_index(value: Any, allow_v1: bool = True) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValidationError("资产索引根节点不是对象")
    value = deepcopy(value)
    schema = int(value.get("schemaVersion", 0) or 0)
    converted_v1 = schema == 1 and allow_v1
    if schema == 1 and allow_v1:
        converted: dict[str, Any] = {
            "schemaVersion": INDEX_SCHEMA_VERSION,
            "revision": str(value.get("updatedAt", "legacy-v1")),
            "updatedAt": str(value.get("updatedAt", "")),
            "datasets": {},
        }
        for kind, dataset in (value.get("datasets") or {}).items():
            if not isinstance(dataset, dict):
                raise ValidationError(f"旧资产索引数据集无效：{kind}")
            converted["datasets"][kind] = {"root": f"public/{'Json' if kind == 'json' else 'images'}", "files": dataset.get("files", {})}
        value = converted
    elif schema != INDEX_SCHEMA_VERSION:
        raise ValidationError("资产索引 schemaVersion 无效")
    datasets = value.get("datasets")
    if not isinstance(datasets, dict) or not datasets:
        raise ValidationError("资产索引缺少 datasets")
    result = deepcopy(value)
    result["schemaVersion"] = INDEX_SCHEMA_VERSION
    result["revision"] = str(value.get("revision", ""))
    result["updatedAt"] = str(value.get("updatedAt", ""))
    result["datasets"] = {}
    if not result["revision"]:
        raise ValidationError("资产索引缺少 revision")
    for kind, dataset in datasets.items():
        if kind not in {"images", "json"} or not isinstance(dataset, dict):
            raise ValidationError(f"资产索引数据集无效：{kind}")
        files = dataset.get("files")
        if not isinstance(files, dict):
            raise ValidationError(f"资产索引文件列表无效：{kind}")
        clean: dict[str, Any] = {}
        for raw_path, raw_info in files.items():
            path = validate_relative_path(raw_path, "资产索引路径")
            if kind == "json" and Path(path).name == JSON_MANIFEST_NAME:
                continue
            if not isinstance(raw_info, dict):
                raise ValidationError(f"资产索引记录无效：{path}")
            size = int(raw_info.get("size", -1))
            md5 = str(raw_info.get("md5", "")).lower()
            if size < 0 or not MD5_PATTERN.fullmatch(md5):
                raise ValidationError(f"资产索引记录不完整：{path}")
            version = str(raw_info.get("version", "legacy@legacy" if converted_v1 else "")).strip()
            if not ASSET_VERSION_PATTERN.fullmatch(version):
                raise ValidationError(f"资产索引记录 version 无效：{path}")
            record = deepcopy(raw_info)
            record["size"] = size
            record["md5"] = md5
            record["version"] = version
            if "meta" in record and not isinstance(record.get("meta"), dict):
                raise ValidationError(f"资产索引记录 meta 无效：{path}")
            clean[path] = record
        clean_dataset = deepcopy(dataset)
        clean_dataset["root"] = str(dataset.get("root", ""))
        clean_dataset["files"] = clean
        result["datasets"][kind] = clean_dataset
    parsing_configs = result.get("imageParsingConfigs")
    if parsing_configs is not None:
        if not isinstance(parsing_configs, dict) or int(parsing_configs.get("schemaVersion", 0) or 0) != 1:
            raise ValidationError("资产索引 imageParsingConfigs 结构无效")
        clean_configs = deepcopy(parsing_configs)
        clean_configs["schemaVersion"] = 1
        for profile in IMAGE_PROFILES:
            if profile not in parsing_configs:
                continue
            parsed = ImageParsingConfig.from_dict(parsing_configs[profile])
            profile_value = deepcopy(parsing_configs[profile])
            profile_value.update(parsed.to_dict())
            clean_configs[profile] = profile_value
        result["imageParsingConfigs"] = clean_configs
    return result


def index_digest(value: dict[str, Any]) -> str:
    payload = json.dumps(validate_asset_index(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def content_signature(record: dict[str, Any]) -> tuple[int, str]:
    return int(record.get("size", -1)), str(record.get("md5", "")).lower()


def validate_level_data_dialog_metadata(value: dict[str, Any]) -> dict[str, Any]:
    index = validate_asset_index(value, allow_v1=False)
    files = index.get("datasets", {}).get("json", {}).get("files", {})
    missing: list[str] = []
    invalid: list[str] = []
    mine_missing: list[str] = []
    mine_invalid: list[str] = []
    script_invalid: list[str] = []
    for path, record in files.items():
        if path.startswith("LevelScriptData/") and path.lower().endswith(".json"):
            meta = record.get("meta")
            if isinstance(meta, dict):
                for field in ("narrativeReadingContentIds", "narrativeReadingUniqIds"):
                    values = meta.get(field)
                    if values is not None and (
                        not isinstance(values, list)
                        or any(not isinstance(value, str) or not value for value in values)
                        or len(values) != len(set(values))
                    ):
                        script_invalid.append(f"{path}:{field}")
            continue
        if not path.startswith("LevelData/") or not path.lower().endswith(".json"):
            continue
        meta = record.get("meta")
        dialog_ids = meta.get("narrativeDialogIds") if isinstance(meta, dict) else None
        if not isinstance(dialog_ids, list):
            missing.append(path)
            continue
        if (
            any(not isinstance(dialog_id, str) or not dialog_id.startswith("dlg_") for dialog_id in dialog_ids)
            or len(dialog_ids) != len(set(dialog_ids))
        ):
            invalid.append(path)
        factory_mines = meta.get("factoryMines") if isinstance(meta, dict) else None
        if not isinstance(factory_mines, list) and isinstance(meta, dict) and meta.get("metadataSchemaVersion"):
            mine_missing.append(path)
            continue
        if not isinstance(factory_mines, list):
            continue
        for mine in factory_mines:
            if not isinstance(mine, dict):
                mine_invalid.append(path)
                break
            mine_id = mine.get("logicMineDataId")
            density = mine.get("densityLevel")
            if (
                not isinstance(mine_id, int)
                or isinstance(mine_id, bool)
                or not isinstance(mine.get("itemId"), str)
                or not mine.get("itemId")
                or not isinstance(density, list)
                or len(density) % 2
                or any(not isinstance(item, (int, float)) or isinstance(item, bool) for item in density)
            ):
                mine_invalid.append(path)
                break
    if missing:
        sample = "、".join(missing[:5])
        suffix = "" if len(missing) <= 5 else f" 等 {len(missing)} 项"
        raise ValidationError(
            f"资产索引中有 {len(missing)} 个 LevelData 缺少 narrativeDialogIds：{sample}{suffix}"
        )
    if invalid:
        sample = "、".join(invalid[:5])
        suffix = "" if len(invalid) <= 5 else f" 等 {len(invalid)} 项"
        raise ValidationError(
            f"资产索引中有 {len(invalid)} 个 LevelData 的 narrativeDialogIds 无效：{sample}{suffix}"
        )
    if script_invalid:
        sample = "、".join(script_invalid[:5])
        suffix = "" if len(script_invalid) <= 5 else f" 等 {len(script_invalid)} 项"
        raise ValidationError(
            f"资产索引中有 {len(script_invalid)} 个 LevelScriptData 的阅读引用元数据无效：{sample}{suffix}"
        )
    if mine_missing:
        sample = "、".join(mine_missing[:5])
        suffix = "" if len(mine_missing) <= 5 else f" 等 {len(mine_missing)} 项"
        raise ValidationError(f"资产索引中有 {len(mine_missing)} 个 LevelData 缺少 factoryMines：{sample}{suffix}")
    if mine_invalid:
        sample = "、".join(mine_invalid[:5])
        suffix = "" if len(mine_invalid) <= 5 else f" 等 {len(mine_invalid)} 项"
        raise ValidationError(f"资产索引中有 {len(mine_invalid)} 个 LevelData 的 factoryMines 无效：{sample}{suffix}")
    return index


def plan_dataset_changes(
    current: dict[str, dict[str, Any]],
    previous: dict[str, dict[str, Any]],
    matcher: ImagePathMatcher | None = None,
    compare_metadata: bool = False,
) -> dict[str, Any]:
    def metadata_signature(value: Any) -> Any:
        if not isinstance(value, dict):
            return value
        normalized = deepcopy(value)
        mines = normalized.get("factoryMines")
        if isinstance(mines, list):
            normalized["factoryMines"] = [
                {key: item for key, item in mine.items() if key != "addedVersion"}
                if isinstance(mine, dict)
                else mine
                for mine in mines
            ]
        return normalized

    current_paths = set(current)
    previous_paths = set(previous)
    if matcher is not None:
        current_paths = matcher.project(current_paths)
        previous_paths = matcher.project(previous_paths)
    upload_paths = sorted(current_paths - previous_paths)
    delete_paths = sorted(previous_paths - current_paths)
    overwrite_paths = sorted(
        path
        for path in current_paths & previous_paths
        if content_signature(current[path]) != content_signature(previous[path])
    )
    overwrite_path_set = set(overwrite_paths)
    index_update_paths = sorted(
        path
        for path in current_paths & previous_paths
        if path not in overwrite_path_set
        and compare_metadata
        and "meta" in current[path]
        and metadata_signature(current[path].get("meta"))
        != metadata_signature(previous[path].get("meta"))
    )
    index_update_path_set = set(index_update_paths)
    unchanged_paths = sorted(
        path
        for path in current_paths & previous_paths
        if path not in overwrite_path_set and path not in index_update_path_set
    )
    return {
        "upload_paths": upload_paths,
        "overwrite_paths": overwrite_paths,
        "delete_paths": delete_paths,
        "index_update_paths": index_update_paths,
        "unchanged_paths": unchanged_paths,
        "scope_paths": sorted(current_paths | previous_paths),
        "current_scope_files": {path: current[path] for path in sorted(current_paths)},
    }


def merge_dataset_records(
    previous: dict[str, dict[str, Any]],
    current: dict[str, dict[str, Any]],
    plan: dict[str, Any],
    asset_version: str,
) -> dict[str, dict[str, Any]]:
    if not ASSET_VERSION_PATTERN.fullmatch(asset_version):
        raise ValidationError(f"正式资产版本号无效：{asset_version}")
    result = deepcopy(previous)
    for path in plan.get("delete_paths", []):
        result.pop(path, None)
    for path in [*plan.get("upload_paths", []), *plan.get("overwrite_paths", [])]:
        record = deepcopy(current[path])
        record["version"] = asset_version
        if isinstance(record.get("meta"), dict) and isinstance(record["meta"].get("factoryMines"), list):
            for mine in record["meta"]["factoryMines"]:
                if isinstance(mine, dict):
                    mine["addedVersion"] = asset_version
        result[path] = record
    for path in plan.get("index_update_paths", []):
        record = deepcopy(result[path])
        metadata = deepcopy(current[path]["meta"])
        previous_mines = {
            str(mine.get("logicMineDataId")): mine
            for mine in (record.get("meta", {}).get("factoryMines", []) if isinstance(record.get("meta"), dict) else [])
            if isinstance(mine, dict) and mine.get("logicMineDataId") is not None
        }
        for mine in metadata.get("factoryMines", []) if isinstance(metadata.get("factoryMines"), list) else []:
            if not isinstance(mine, dict):
                continue
            previous = previous_mines.get(str(mine.get("logicMineDataId")))
            mine["addedVersion"] = str(previous.get("addedVersion")) if previous and previous.get("addedVersion") else asset_version
        record["meta"] = metadata
        result[path] = record
    return result


def merge_asset_index(
    remote_index: dict[str, Any],
    dataset_plans: list[dict[str, Any]],
    asset_version: str,
    revision: str,
) -> dict[str, Any]:
    result = validate_asset_index(remote_index, allow_v1=False)
    result = deepcopy(result)
    result["revision"] = revision
    result["updatedAt"] = revision
    for plan in dataset_plans:
        kind = str(plan["kind"])
        dataset = deepcopy(result["datasets"][kind])
        dataset["files"] = merge_dataset_records(
            dataset["files"], plan["current_files"], plan, asset_version
        )
        result["datasets"][kind] = dataset
    return validate_asset_index(result, allow_v1=False)
