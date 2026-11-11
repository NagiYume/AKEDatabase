"""Bind publication state to the exact Python image parser installation."""
from __future__ import annotations

import hashlib
from importlib import metadata
from pathlib import Path
import sys

from .errors import ValidationError


def image_parser_digest() -> str:
    digest = hashlib.sha256()
    root = Path(__file__).resolve().parent
    unity_root = root.parent / 'vendor' / 'UnityPy' / 'UnityPy'
    if not (unity_root / '__init__.py').is_file():
        raise ValidationError('UnityPy 子模块未初始化，请运行 git submodule update --init --recursive')
    for path in sorted(unity_root.rglob('*.py')):
        digest.update(path.relative_to(unity_root).as_posix().encode('utf-8') + b'\0')
        digest.update(path.read_bytes())
    for name in ('image_parser_identity.py', 'python_image_runner.py', 'image_parallel.py', 'hgmmap_images.py', 'endfield_lz4.py',
                 'native_asset_map.py', 'json_host/image_key.py', 'json_host/runtime.py'):
        digest.update(name.encode('utf-8') + b'\0')
        digest.update((root / name).read_bytes())
    if str(unity_root.parent) not in sys.path:
        sys.path.insert(0, str(unity_root.parent))
    for name in ('lz4', 'msgpack', 'xxhash', 'Pillow', 'texture2ddecoder', 'pycryptodome'):
        try:
            dist = metadata.distribution(name)
        except metadata.PackageNotFoundError as exc:
            raise ValidationError(f'缺少图片解析依赖 {name}，请先运行 setup-venv.bat') from exc
        digest.update(name.encode('utf-8') + b'\0' + dist.version.encode('utf-8') + b'\0')
        files = (f for f in (dist.files or ())
                 if str(f).endswith('.pyd'))
        for item in sorted(files, key=str):
            path = Path(dist.locate_file(item))
            if path.is_file():
                digest.update(str(item).encode('utf-8') + b'\0')
                digest.update(path.read_bytes())
    return digest.hexdigest()
