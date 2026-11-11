"""Export GlobalBuffConfig assets using the matching game's JSON serializer."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import threading
import traceback

from .json_host.export_json import atomic_write
from .json_host.runtime import Host
from .json_host.schemas import Schema

PREFIX = 'assets/beyond/dynamicassets/gameplay/globalbuff/'
SCHEMA = Schema('GlobalBuffData', 'Beyond.Gameplay.Core', 'GlobalBuffData', 'managed')
RESULT_PREFIX = 'AKE_GLOBALBUFF_RESULT '
_HOST_LIFETIME = []


def resolve_references(data, references):
    if not isinstance(references, dict) or not isinstance(references.get('RefIds'), list):
        raise ValueError('Missing managed references registry')
    registry = {}
    for item in references['RefIds']:
        rid = item['rid']
        if rid in registry:
            raise ValueError(f'Duplicate managed reference: {rid}')
        registry[rid] = item
    used = set()

    def visit(value, active):
        if isinstance(value, list):
            return [visit(item, active) for item in value]
        if not isinstance(value, dict):
            return value
        if set(value) == {'rid'}:
            rid = value['rid']
            if rid in (-1, -2, 0):
                return None
            if rid not in registry or rid in active:
                raise ValueError(f'Missing or cyclic managed reference: {rid}')
            ref = registry[rid]
            typ = ref['type']
            if not all(isinstance(typ.get(k), str) for k in ('class', 'ns', 'asm')) or not typ['class'] or not typ['asm']:
                raise ValueError(f'Invalid managed reference type: {rid}')
            used.add(rid)
            body = visit(ref['data'], active | {rid})
            if not isinstance(body, dict):
                raise ValueError(f'Invalid managed reference data: {rid}')
            name = (typ['ns'] + '.' if typ['ns'] else '') + typ['class'].replace('/', '+')
            return {'$type': name + ', ' + typ['asm'], **body}
        return {key: visit(item, active) for key, item in value.items()}

    result = visit(data, set())
    # The registry may also contain references owned by the ScriptableObject
    # wrapper. Preserve the requested object's full reachable graph only.
    return result


def export(vfs_root, output, runtime, limit=0, names=()):
    from UnityPy.endfield import EndfieldVFS
    import UnityPy.helpers.EndfieldBundle as endfield_bundle
    from .endfield_lz4 import decompress

    endfield_bundle.decompress_lz4inv = decompress
    host = Host(runtime, output / '.runtime')
    # IL2CPP retains native callback pointers. Keep the host, callbacks and
    # loaded modules alive until the worker terminates with os._exit().
    _HOST_LIFETIME.append(host)
    host.initialize([])
    key = base64.b64decode(os.environ.pop('AKE_GLOBALBUFF_VFS_KEY'), validate=True)
    vfs = EndfieldVFS(vfs_root, key=key)
    manifest_index = vfs._vfs_root / '1CDDBF1F' / '1CDDBF1F.blc'
    from UnityPy.endfield import _read_index
    manifest_entries = [e for e in _read_index(manifest_index, vfs.key, {'1CDDBF1F': 4})
                        if e.name.replace('\\', '/').casefold() == 'data/bundles/windows/manifest.hgmmap']
    if not manifest_entries:
        raise ValueError('Missing manifest.hgmmap entry')
    manifest_entry = next((e for e in manifest_entries if e.patch), manifest_entries[0])
    manifest_sha256 = hashlib.sha256(vfs.read(manifest_entry)).hexdigest()
    selected = sorted((a for a in vfs.catalog.assets_by_path.values()
                       if a.path.casefold().startswith(PREFIX) and a.path.casefold().endswith('.asset')),
                      key=lambda a: a.path.casefold())
    if names:
        wanted = {name.casefold() for name in names}
        selected = [a for a in selected if Path(a.path).stem.casefold() in wanted]
        if {Path(a.path).stem.casefold() for a in selected} != wanted:
            raise ValueError('Requested GlobalBuff asset is absent from manifest')
    if limit:
        selected = selected[:limit]
    if not selected:
        raise ValueError('No GlobalBuff assets in selected manifest')
    target = output / 'GlobalBuffData'
    target.mkdir(parents=True, exist_ok=True)
    seen_names = set()
    id_assets = {}
    for index, asset in enumerate(selected, 1):
        env = vfs.load_asset(asset.path, with_dependencies=True)
        matches = [p for p, _ in env.container.items() if p.casefold() == asset.path.casefold()]
        if len(matches) != 1:
            raise ValueError(f'Cannot resolve asset container: {asset.path}')
        pointer = env.container[matches[0]]
        obj = pointer.deref()
        if obj.type.name != 'MonoBehaviour':
            raise ValueError(f'Unexpected asset type: {asset.path} / {obj.type.name}')
        tree = obj.parse_as_dict()
        raw = tree.get('globalBuffData')
        if not isinstance(raw, dict):
            raise ValueError(f'Missing globalBuffData: {asset.path}')
        data = resolve_references(raw, tree.get('references'))
        name = data.get('id')
        asset_name = Path(asset.path).stem
        if (not isinstance(name, str) or not name.strip()
                or not re.fullmatch(r'[A-Za-z0-9_\-]+', asset_name)):
            raise ValueError(f'Invalid GlobalBuff id or asset filename: {asset.path} / {name!r}')
        if asset_name.casefold() in seen_names:
            raise ValueError(f'Duplicate GlobalBuff asset filename: {asset.path}')
        seen_names.add(asset_name.casefold())
        id_assets.setdefault(name, []).append(asset.path)
        raw_json = json.dumps(data, ensure_ascii=False, allow_nan=False).encode('utf-8')
        with host.deserialize(SCHEMA, raw_json) as value:
            result = json.loads(host.serialize(value))
        if not isinstance(result, dict) or result.get('id') != name:
            raise ValueError(f'Game serializer returned invalid id: {name}')
        atomic_write(target / (asset_name + '.json'), (json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8'))
        suffix = f' (内部 ID: {name})' if asset_name != name else ''
        print(f'[{index}/{len(selected)}] {asset_name}{suffix}', flush=True)
    print('GlobalBuff 资产解析结束，正在校验文件并生成报告', flush=True)
    metadata = runtime / 'Endfield_Data/il2cpp_data/Metadata/global-metadata.dat'
    def sha256(path):
        digest = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        return digest.hexdigest()
    files = {}
    for file in sorted(target.glob('*.json')):
        files[file.name] = {'size': file.stat().st_size, 'sha256': sha256(file)}
    duplicates = {key: paths for key, paths in id_assets.items() if len(paths) > 1}
    print('GlobalBuff 文件校验完成，正在计算运行时指纹', flush=True)
    return {'selected': len(selected), 'partial': bool(limit or names), 'files': files,
            'duplicateIds': duplicates,
            'vfsRoot': str(Path(vfs_root).resolve()),
            'manifestHash': vfs.catalog.manifest_hash, 'manifestVersion': vfs.catalog.hash_version,
            'manifestSha256': manifest_sha256,
            'gameAssemblySha256': sha256(runtime / 'GameAssembly.dll'),
            'metadataSha256': sha256(metadata)}


def run_worker(args):
    """Finish and exit inside the IL2CPP thread; do not run thread teardown."""
    try:
        report = export(args.vfs, args.output, args.runtime, args.limit, args.name)
        print(RESULT_PREFIX + json.dumps(report, ensure_ascii=True), flush=True)
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(0)
    except BaseException:
        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vfs', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--name', action='append', default=[])
    args = parser.parse_args()
    if args.limit < 0 or (args.output.exists() and any(args.output.iterdir())):
        raise ValueError('Output must be empty and limit must be nonnegative')
    args.output.mkdir(parents=True, exist_ok=True)
    previous = threading.stack_size(16 * 1024 * 1024)
    try:
        thread = threading.Thread(target=run_worker, args=(args,), name='globalbuff-il2cpp')
        thread.start()
    finally:
        threading.stack_size(previous)
    thread.join()
    raise RuntimeError('GlobalBuff worker exited without terminating its process')


if __name__ == '__main__':
    main()
