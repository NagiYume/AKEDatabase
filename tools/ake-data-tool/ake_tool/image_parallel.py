"""Independent bundle parsing workers for the image export process."""
from __future__ import annotations

from collections import Counter, defaultdict
import gc
import os
from pathlib import Path

from .hgmmap_images import map_asset, preload_objects
from .native_asset_map import object_hash

_vfs = None
_root = None
_scratch = None
_old = None
_processed = 0
_cache_stats = None
_builtin_root = None
_builtin_data = {}


def initialize(vfs_root, key, old_hashes, scratch, cache_budget, builtin_root):
    global _vfs, _root, _scratch, _old, _cache_stats, _builtin_root
    from UnityPy.endfield import EndfieldVFS
    import UnityPy.helpers.EndfieldBundle as endfield_bundle
    from .endfield_lz4 import decompress
    from .image_memory_runner import install_cache
    endfield_bundle.decompress_lz4inv = decompress
    _cache_stats = install_cache(cache_budget)
    _root = Path(vfs_root)
    _scratch = Path(scratch)
    _old = old_hashes
    _builtin_root = Path(builtin_root) if builtin_root else None
    _vfs = EndfieldVFS(_root, key=key)
    # Load the catalog once in each worker, then keep it outside cyclic GC.
    _vfs.catalog
    gc.collect()
    gc.freeze()


def parse_bundle(job):
    global _processed
    from UnityPy.environment import Environment
    from UnityPy.helpers.EndfieldBundle import UnsupportedStorageBlock

    number, _, paths = job
    env = Environment()
    env.allow_partial_endfield_bundles = True
    try:
        _vfs.load_asset(paths[0], with_dependencies=True, environment=env)
    except UnsupportedStorageBlock as exc:
        return [], {}, os.getpid(), _cache_stats(), {}, {}, dict.fromkeys(paths, str(exc))
    partial = any(getattr(file, 'has_unavailable_blocks', False) for file in env.files.values())
    original_find_file = env.find_file
    env._ake_builtin_asset_files = set()
    env._ake_builtin_excluded = Counter()
    env._ake_missing_cabs = Counter()

    def find_file(name, is_dependency=True):
        if name.lower() not in ('unity default resources', 'unity_builtin_extra'):
            return original_find_file(name, is_dependency=is_dependency)
        cached = env.get_cab(name)
        if cached is not None:
            return cached
        path = _builtin_root / name if _builtin_root is not None else None
        if path is None or not path.is_file():
            raise FileNotFoundError(
                f'缺少与当前游戏版本匹配的 Unity 内置资源 {name}；'
                '请在对应版本的 Endfield_Data/Resources 中提供该文件')
        data = _builtin_data.get(name)
        if data is None:
            data = path.read_bytes()
            _builtin_data[name] = data
        from UnityPy.files import SerializedFile
        result = env.load_file(data, name=name, is_dependency=True)
        if not isinstance(result, SerializedFile):
            raise ValueError(f'Unity 内置资源不是有效的 SerializedFile：{path}')
        env._ake_builtin_asset_files.add(id(result))
        return result

    env.find_file = find_file
    records = []
    observed = Counter()
    failures = {}
    for asset_path in paths:
        asset_records = []
        try:
            _parse_asset(env, asset_path, partial, number, len(records), asset_records, observed)
        except UnsupportedStorageBlock as exc:
            for _, temporary in asset_records:
                if temporary:
                    Path(temporary).unlink(missing_ok=True)
            failures[asset_path] = str(exc)
            continue
        records.extend(asset_records)
    builtin_counts = env._ake_builtin_excluded
    missing_cabs = env._ake_missing_cabs
    env = None
    _processed += 1
    if _processed % 25 == 0:
        gc.collect()
    return records, observed, os.getpid(), _cache_stats(), builtin_counts, missing_cabs, failures


def _parse_asset(env, asset_path, partial, number, record_offset, asset_records, observed):
    local_seen = {}
    preloaded = preload_objects(env, asset_path)
    entries = map_asset(env, asset_path, _root, preloaded)
    objects = defaultdict(list)
    for obj in preloaded:
        observed[obj.type.name] += 1
        if obj.type.name == 'Texture2D':
            objects[(obj.path_id, obj.type.value)].append(obj)
    for entry in entries:
        identity = (entry.container.casefold(), entry.source.casefold(), entry.offset, entry.path_id, entry.type)
        prior = local_seen.get(identity)
        if prior is not None:
            if prior != entry.hash:
                raise ValueError(f'Conflicting map entries: {entry.container} / {entry.path_id}')
            asset_records.append((entry, None))
            continue
        local_seen[identity] = entry.hash
        temporary = None
        if entry.type == 28 and (partial or entry.hash not in _old):
            candidates = [obj for obj in objects.get((entry.path_id, entry.type), ())
                          if object_hash(obj.get_raw_data()) == entry.hash]
            if not candidates:
                raise ValueError(f'图片对象未找到：{entry.container} / {entry.path_id}')
            texture = candidates[0].parse_as_object()
            if entry.hash in _old:
                texture.get_image_data()
            else:
                image = texture.image
                temporary = _scratch / f'{number}-{record_offset + len(asset_records)}.png'
                image.save(temporary, format='PNG', optimize=True)
        asset_records.append((entry, str(temporary) if temporary is not None else None))
