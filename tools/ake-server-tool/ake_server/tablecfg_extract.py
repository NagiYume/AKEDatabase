"""Isolated Python extraction process; stdout carries structured progress."""
from __future__ import annotations

import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from .vendor.models import CancellationToken
from .vendor.tablecfg_parser import require_crypto
from .vendor.unpacker import PythonTableUnpacker


def parser_digest():
    require_crypto()
    root = Path(__file__).parent
    digest = hashlib.sha256()
    for name in ("tablecfg_extract.py", "vendor/tablecfg_parser.py", "vendor/unpacker.py",
                 "vendor/file_copy.py", "vendor/models.py", "vendor/errors.py"):
        digest.update(name.encode())
        digest.update((root / name).read_bytes())
    digest.update(version("cryptography").encode())
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    def progress(event):
        print(json.dumps({"message": event.message, "current": event.current,
                          "total": event.total,
                          "file_name": event.details.get("file_name")}, ensure_ascii=False), flush=True)

    PythonTableUnpacker().unpack(args.source, args.output, CancellationToken(), progress)


if __name__ == "__main__":
    main()
