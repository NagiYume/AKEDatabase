"""Resolve manifest assets to the serialized objects used by image maps."""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from .native_asset_map import AssetEntry, object_hash


def preload_objects(environment, asset_path):
    """Resolve the root AssetBundle's preload slice for a manifest asset.

    Named missing external CABs are recorded as warnings, matching the SDK;
    malformed pointers and all other missing dependencies still fail.
    """
    wanted = asset_path.replace('\\', '/').casefold()
    index = getattr(environment, '_ake_preload_index', None)
    if index is None:
        index = defaultdict(list)
        for obj in environment.objects:
            if obj.type.name == 'AssetBundle':
                bundle = obj.parse_as_object()
                for path, info in bundle.m_Container:
                    index[path.replace('\\', '/').casefold()].append((bundle, info))
        environment._ake_preload_index = index
    found = []
    for bundle, info in index.get(wanted, ()):
        start, size = info.preloadIndex, info.preloadSize
        if start < 0 or size < 0 or start + size > len(bundle.m_PreloadTable):
            raise ValueError(f'资源预加载表范围无效：{asset_path}')
        pointers = [info.asset, *bundle.m_PreloadTable[start:start + size]]
        for pointer in pointers:
            if not pointer:
                continue
            try:
                found.append(pointer.deref())
            except (FileNotFoundError, KeyError) as exc:
                owner = getattr(pointer, 'assetsfile', None)
                externals = getattr(owner, 'externals', ())
                file_id = pointer.m_FileID
                external = externals[file_id - 1].path if 0 < file_id <= len(externals) else ''
                missing = getattr(environment, '_ake_missing_cabs', None)
                if missing is not None and isinstance(exc, FileNotFoundError) and external.lower().startswith('archive:/cab-'):
                    missing[(external.lower().rsplit('/', 1)[-1], asset_path,
                             file_id, pointer.m_PathID)] += 1
                    continue
                raise FileNotFoundError(
                    f'资源 {asset_path} 的预加载引用无法解析：'
                    f'file_id={file_id}, path_id={pointer.m_PathID}, '
                    f'owner={getattr(owner, "name", "")}, external={external}：{exc}'
                ) from exc
    if not found:
        raise ValueError(f'Bundle 中没有资源容器：{asset_path}')
    return list({(id(obj.assets_file), obj.path_id): obj for obj in found}.values())


def map_asset(environment, asset_path, vfs_root, objects=None):
    """Build native-format entries from one manifest asset's preload table."""
    root = Path(vfs_root).resolve()
    owners = {id(item[2]): item[0] for item in environment._endfield_loaded_bundles.values()}
    source_cache = getattr(environment, '_ake_source_paths', None)
    if source_cache is None:
        source_cache = environment._ake_source_paths = {}
    result = []
    for obj in objects if objects is not None else preload_objects(environment, asset_path):
        if obj.type.name not in ('Texture2D', 'MonoBehaviour', 'TextAsset'):
            continue
        parent = obj.assets_file
        if id(parent) in getattr(environment, '_ake_builtin_asset_files', ()):
            environment._ake_builtin_excluded[obj.type.name] += 1
            continue
        while parent is not None and id(parent) not in owners:
            parent = getattr(parent, 'parent', None)
        if parent is None:
            raise ValueError(f'无法确定资源对象所在 Bundle：{asset_path} / {obj.path_id}')
        entry = owners[id(parent)]
        source = source_cache.get(entry.chunk)
        if source is None:
            source = entry.chunk.resolve().relative_to(root).as_posix()
            source_cache[entry.chunk] = source
        name = obj.peek_name() or obj.type.name
        result.append(AssetEntry(name, asset_path, source, obj.path_id,
                                 obj.type.value, object_hash(obj.get_raw_data()), entry.offset))
    return result


