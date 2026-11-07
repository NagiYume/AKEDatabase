"""Bind publication state to the exact Python image parser installation."""
from __future__ import annotations

import hashlib
from importlib import metadata
from pathlib import Path

from .errors import ValidationError


def image_parser_digest() -> str:
    digest = hashlib.sha256()
    root = Path(__file__).resolve().parent
    for name in ('image_parser_identity.py', 'python_image_runner.py', 'image_parallel.py', 'hgmmap_images.py', 'endfield_lz4.py',
                 'native_asset_map.py', 'json_host/image_key.py', 'json_host/runtime.py'):
        digest.update(name.encode('utf-8') + b'\0')
        digest.update((root / name).read_bytes())
    for name in ('UnityPy', 'lz4', 'msgpack', 'xxhash', 'Pillow', 'texture2ddecoder', 'pycryptodome'):
        try:
            dist = metadata.distribution(name)
        except metadata.PackageNotFoundError as exc:
            raise ValidationError(f'缺少图片解析依赖 {name}，请先运行 setup-venv.bat') from exc
        digest.update(name.encode('utf-8') + b'\0' + dist.version.encode('utf-8') + b'\0')
        if name == 'UnityPy':
            digest.update((dist.read_text('direct_url.json') or '').encode('utf-8'))
        files = (f for f in (dist.files or ())
                 if str(f).endswith('.pyd') or (name == 'UnityPy'
                     and str(f).startswith('UnityPy/') and str(f).endswith('.py')))
        for item in sorted(files, key=str):
            path = Path(dist.locate_file(item))
            if path.is_file():
                digest.update(str(item).encode('utf-8') + b'\0')
                digest.update(path.read_bytes())
    return digest.hexdigest()
