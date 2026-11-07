"""Build and export an SDK-compatible image map from Endfield VFS."""
from __future__ import annotations

import argparse
import base64
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
import gc
import multiprocessing
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys

from .image_parallel import initialize, parse_bundle
from .native_asset_map import read_map, write_map


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('vfs', type=Path)
    parser.add_argument('run', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('filter')
    parser.add_argument('history')
    parser.add_argument('remote', type=Path)
    parser.add_argument('history_count', type=int)
    parser.add_argument('history2', nargs='?', default='-')
    parser.add_argument('history2_count', nargs='?', type=int, default=0)
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--unity-resources', type=Path)
    args = parser.parse_args()
    import UnityPy.helpers.EndfieldBundle as endfield_bundle
    from UnityPy.endfield import EndfieldVFS
    from .endfield_lz4 import decompress
    endfield_bundle.decompress_lz4inv = decompress
    key = base64.b64decode(os.environ.pop('PERLICA_VFS_KEY_BASE64'), validate=True)
    if len(key) != 32:
        raise ValueError('VFS key must contain 32 bytes')
    histories = []
    for path, count in ((args.history, args.history_count), (args.history2, args.history2_count)):
        if path == '-':
            if count != 0:
                raise ValueError('Missing history map has nonzero count')
            continue
        game, entries = read_map(Path(path), count)
        if game != 35:
            raise ValueError('History map game type does not match Endfield')
        histories.append(entries)
    valid = re.compile(r'^[0-9a-f]{1,16}$')
    old_count = sum(map(len, histories))
    old = {entry.hash.strip().lower() for history in histories for entry in history
           if valid.fullmatch(entry.hash.strip().lower())}
    histories.clear()
    entries = None
    pattern = re.compile(args.filter, re.IGNORECASE)
    vfs = EndfieldVFS(args.vfs, key=key)
    selected = sorted((a for a in vfs.catalog.assets_by_path.values()
                       if pattern.search(a.path.replace('\\', '/'))), key=lambda a: a.path.casefold())
    if args.limit:
        selected = selected[:args.limit]
    if not selected:
        raise ValueError('No manifest assets match image filter')
    groups = defaultdict(list)
    for asset in selected:
        groups[asset.bundle_index].append(asset)
    # Histories and the catalog are long-lived. Exclude them from cyclic GC so
    # releasing each short-lived UnityPy environment does not repeatedly scan
    # hundreds of thousands of immutable map records.
    gc.collect()
    gc.freeze()
    print(f'[image-stage] 清单匹配 {len(selected)} 项，涉及 {len(groups)} 个 Bundle', flush=True)
    all_entries, delta = [], []
    seen, outputs = {}, {}
    observed_types = Counter()
    worker_cache_stats = {}
    builtin_excluded = Counter()
    skipped = 0
    workers = int(os.environ.get('AKE_IMAGE_PARSE_WORKERS', '4'))
    if not 1 <= workers <= 32:
        raise ValueError('图片解析进程数必须为 1–32')
    workers = min(workers, len(groups))
    cache_bytes = int(os.environ.get('AKE_IMAGE_BUNDLE_CACHE_GIB', '16')) * 1024**3
    scratch = args.run / 'parallel-png'
    scratch.mkdir(parents=True, exist_ok=True)
    jobs = iter((number, [asset.path for asset in assets])
                for number, assets in enumerate(groups.values(), 1))
    print(f'[image-stage] 并行解析进程 {workers}，Bundle 缓存总预算 {cache_bytes / 1024**3:g} GiB', flush=True)
    with ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context('spawn'),
                             initializer=initialize,
                             initargs=(str(args.vfs), key, old, str(scratch), cache_bytes // workers,
                                       str(args.unity_resources) if args.unity_resources else None)) as pool:
        pending = []
        for _ in range(workers * 2):
            job = next(jobs, None)
            if job is None:
                break
            pending.append((job[0], pool.submit(parse_bundle, job)))
        while pending:
            number, future = pending.pop(0)
            records, observed, worker_id, cache_stats, builtin_counts = future.result()
            worker_cache_stats[worker_id] = cache_stats
            observed_types.update(observed)
            builtin_excluded.update(builtin_counts)
            job = next(jobs, None)
            if job is not None:
                pending.append((job[0], pool.submit(parse_bundle, job)))
            for entry, temporary in records:
                identity = (entry.container.casefold(), entry.source.casefold(), entry.offset, entry.path_id, entry.type)
                prior = seen.get(identity)
                if prior is not None:
                    if prior != entry.hash:
                        raise ValueError(f'Conflicting map entries: {entry.container} / {entry.path_id}')
                    if temporary:
                        Path(temporary).unlink(missing_ok=True)
                    continue
                seen[identity] = entry.hash
                all_entries.append(entry)
                if entry.hash in old:
                    skipped += 1
                    continue
                delta.append(entry)
                if entry.type != 28:
                    continue
                if not temporary:
                    raise ValueError(f'图片对象未找到：{entry.container} / {entry.path_id}')
                name = entry.name
                if not name or name in ('.', '..') or any(c in name for c in '/\\:*?"<>|'):
                    raise ValueError(f'不安全的图片名称：{name}')
                container = PurePosixPath(entry.container.replace('\\', '/'))
                if container.is_absolute() or not container.parts or container.parts[0].casefold() != 'assets' or any(p in ('', '.', '..') for p in container.parts):
                    raise ValueError(f'不安全的容器路径：{entry.container}')
                relative = container.parent / (name + '.png')
                target = (args.output / Path(*relative.parts)).resolve()
                if args.output.resolve() not in target.parents:
                    raise ValueError(f'输出路径越界：{relative}')
                previous = outputs.get(relative.as_posix().casefold())
                if previous is not None:
                    if previous != entry.hash:
                        raise ValueError(f'不同图片指向同一输出路径：{relative}')
                    Path(temporary).unlink(missing_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(temporary, target)
                outputs[relative.as_posix().casefold()] = entry.hash
            if number % 25 == 0 or number == len(groups):
                print(f'[image-stage] Bundle {number}/{len(groups)}，map {len(all_entries)}，导出 {len(outputs)}', flush=True)
    shutil.rmtree(scratch)
    print(f'[image-stage] 工作进程 Bundle 缓存命中 {sum(v[0] for v in worker_cache_stats.values())} 次，'
          f'当前缓存 {sum(v[1] for v in worker_cache_stats.values()) / 1024**2:.1f} MiB', flush=True)
    args.run.mkdir(parents=True, exist_ok=True)
    write_map(args.run / 'assets.full.map', 35, all_entries)
    write_map(args.run / 'assets.delta.map', 35, delta)
    write_map(args.remote, 35, all_entries)
    print('[image-stage] 预加载对象类型统计：' + ', '.join(
        f'{name}={count}' for name, count in sorted(observed_types.items())), flush=True)
    if builtin_excluded:
        print('[image-stage] Unity 内置资源不属于 VFS map：' + ', '.join(
            f'{name}={count}' for name, count in sorted(builtin_excluded.items())), flush=True)
    print(f'AKE_MAP_RESULT|full={len(all_entries)}|old={old_count}'
          f'|oldHashes={len(old)}|delta={len(delta)}|skipped={skipped}'
          f'|invalidCurrent=0|normalizedSources=0|warnings=0|failures=0', flush=True)


if __name__ == '__main__':
    main()
