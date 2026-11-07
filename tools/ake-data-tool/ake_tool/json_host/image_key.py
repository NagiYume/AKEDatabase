"""Isolated IL2CPP key resolver for the image pipeline.

The native runtime is deliberately confined to this process.  The caller must
validate the selected runtime against the game version before starting it.
"""
import base64
import os
from pathlib import Path
import sys
import traceback

from .runtime import Host


def main():
    if len(sys.argv) != 3:
        raise ValueError('Expected runtime and isolated persistent directories')
    host = Host(Path(sys.argv[1]), Path(sys.argv[2]))
    host.initialize()
    key = host.common_key()
    if len(key) != 32:
        raise ValueError('VFS key must contain 32 bytes')
    print('VFS_KEY_BASE64=' + base64.b64encode(key).decode('ascii'), flush=True)
    # IL2CPP owns native callbacks and threads; do not tear it down in Python.
    os._exit(0)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc()
        os._exit(1)
