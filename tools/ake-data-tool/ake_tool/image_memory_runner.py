"""Reuse verified bundle bytes across isolated image export environments."""
from __future__ import annotations

from collections import OrderedDict
import runpy
import os
import sys
from pathlib import Path

_unity_root = Path(__file__).resolve().parent.parent / 'vendor' / 'UnityPy'
if not (_unity_root / 'UnityPy' / '__init__.py').is_file():
    raise RuntimeError('UnityPy 子模块未初始化，请运行 git submodule update --init --recursive')
sys.path.insert(0, str(_unity_root))
os.environ['PYTHONPATH'] = str(_unity_root) + os.pathsep + os.environ.get('PYTHONPATH', '')

from UnityPy.endfield import EndfieldVFS


# This is a cache budget, not a process memory limit.  Eviction leaves each
# UnityPy environment independent and falls back to the normal verified read.
BUNDLE_CACHE_BYTES = int(os.environ.get('AKE_IMAGE_BUNDLE_CACHE_GIB', '16')) * 1024**3


def install_cache(cache_budget):
    original_read = EndfieldVFS.read
    cache = OrderedDict()
    cache_size = 0
    hits = 0

    def cached_read(vfs, entry, *, verify=True):
        nonlocal cache_size, hits
        if isinstance(entry, str):
            entry = vfs.entries[entry]
        key = (entry, verify)
        data = cache.get(key)
        if data is not None:
            cache.move_to_end(key)
            hits += 1
            return data
        data = original_read(vfs, entry, verify=verify)
        if len(data) <= cache_budget:
            while cache and cache_size + len(data) > cache_budget:
                _, evicted = cache.popitem(last=False)
                cache_size -= len(evicted)
            cache[key] = data
            cache_size += len(data)
        return data

    EndfieldVFS.read = cached_read
    return lambda: (hits, cache_size)


def main():
    stats = install_cache(BUNDLE_CACHE_BYTES)
    print(f'[image-stage] Bundle 内存缓存上限 {BUNDLE_CACHE_BYTES / 1024**3:g} GiB', flush=True)
    try:
        runpy.run_module('ake_tool.python_image_runner', run_name='__main__')
    finally:
        hits, cache_size = stats()
        print(f'[image-stage] 主进程 Bundle 缓存命中 {hits} 次，缓存 {cache_size / 1024**2:.1f} MiB', flush=True)


if __name__ == '__main__':
    main()
