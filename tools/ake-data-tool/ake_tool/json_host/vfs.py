"""Local VFS BLC/CHK reader, matching VfsReader.kt including patch precedence."""
from dataclasses import dataclass
import hashlib
from pathlib import Path
import struct

from .binary_reader import Reader

BLOCKS = {'Table': '42A8FCA6', 'JsonData': '775A31D1',
          'ExtendData': 'D6E622F7', 'InitialExtendData': '3C9D9D2D'}


def crypt(data, nonce, key):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms
    cipher = Cipher(algorithms.ChaCha20(key, struct.pack('<I', 1) + nonce), None).decryptor()
    return cipher.update(data) + cipher.finalize()


@dataclass(frozen=True)
class Entry:
    name: str
    chunk: Path
    offset: int
    length: int
    encrypted: bool
    seed: int
    md5: bytes
    tag: int
    version: int

    def read(self, key, verify=False):
        with self.chunk.open('rb') as stream:
            stream.seek(self.offset)
            data = stream.read(self.length)
        if len(data) != self.length:
            raise ValueError(f'Truncated CHK: {self.name}')
        if self.encrypted:
            data = crypt(data, struct.pack('<IQ', self.version, self.seed), key)
        if verify and hashlib.md5(data).digest() != self.md5:
            raise ValueError(f'CHK content checksum mismatch: {self.name}')
        return data


class Vfs:
    def __init__(self, root, key):
        root = Path(root)
        self.root = root / 'VFS' if (root / 'VFS').is_dir() else root
        self.key = key
        self.cache = {}

    def block(self, kind):
        if kind in self.cache:
            return self.cache[kind]
        block_hash = BLOCKS[kind]
        path = self.root / block_hash / (block_hash + '.blc')
        raw = path.read_bytes()
        if len(raw) < 12:
            raise ValueError(f'Truncated BLC: {path}')
        r = Reader(raw[:12] + crypt(raw[12:], raw[:12], self.key))
        version = r.val('<I')
        version = version if version <= 10 else 3
        r.take(8)
        fmt = r.integer()
        if not 0 <= fmt <= 5:
            raise ValueError(f'Invalid BLC format {fmt}; check runtime/key')
        r.take(4)
        r.prefixed_text()
        if r.take(4).hex().upper() != block_hash:
            raise ValueError(f'BLC hash mismatch: {path}; check runtime/key')
        r.take(4)
        expected = r.count()
        r.take(9)
        files = []

        def tag():
            value = r.val('<Q' if fmt == 5 else '<I')
            if fmt == 5:
                if value not in (0, 0x00209C855B11B951):
                    raise ValueError(f'Unknown BLC v5 tag: {value:#x}')
                return int(value != 0)
            return int((value & 255) == 1)

        for _ in range(r.count()):
            chunk = path.parent / (r.take(16).hex().upper() + '.chk')
            r.take(25)
            tag()
            for _ in range(r.count()):
                name = r.prefixed_text().replace('\\', '/')
                r.take(24)
                md5 = r.take(16)
                offset, length = r.val('<Q'), r.val('<Q')
                r.byte()
                encrypted = bool(r.byte())
                seed = r.val('<Q') if encrypted else 0
                files.append(Entry(name, chunk, offset, length, encrypted, seed, md5, tag(), version))
        if expected != len(files):
            raise ValueError(f'BLC count mismatch: {len(files)} != {expected}')
        latest = {}
        for entry in files:
            old = latest.get(entry.name.casefold())
            if old is not None and entry.tag == old.tag and (entry.md5, entry.length) != (old.md5, old.length):
                raise ValueError(f'Conflicting VFS entries at equal priority: {entry.name}')
            if old is None or entry.tag > old.tag:
                latest[entry.name.casefold()] = entry
        self.cache[kind] = sorted(latest.values(), key=lambda entry: entry.name.casefold())
        return self.cache[kind]

    def find(self, kind, name):
        return next((e for e in self.block(kind) if e.name.casefold() == name.casefold()), None)

    def read(self, kind, name, optional=False):
        try:
            entry = self.find(kind, name)
        except FileNotFoundError:
            if not optional:
                raise
            return None
        if entry is None:
            if optional:
                return None
            raise FileNotFoundError(f'VFS file not found: {kind}: {name}')
        return entry.read(self.key)

    def stage_string_pool(self, directory):
        import re
        directory.mkdir(parents=True, exist_ok=True)
        prefix = 'Data/Json/StringPool/'
        selected = []
        indices = []
        for entry in self.block('JsonData'):
            if not entry.name.casefold().startswith(prefix.casefold()):
                continue
            name = entry.name[len(prefix):]
            match = re.fullmatch(r'StringPool([0-9]+)\.byte', name, re.I)
            if match:
                indices.append(int(match[1]))
            elif name not in ('StringPoolHashIndex.byte', 'StringPoolCounting.json'):
                continue
            selected.append((entry, name))
        if not any(name.casefold() == 'stringpoolhashindex.byte' for _, name in selected):
            raise ValueError('VFS has no StringPoolHashIndex.byte')
        if not indices or sorted(indices) != list(range(max(indices) + 1)):
            raise ValueError(f'String pool blocks are not contiguous: {indices}')
        for entry, name in selected:
            (directory / name).write_bytes(entry.read(self.key, verify=True))
        return len(selected)


def hash_sample(data):
    """First StringPathHash entry for runtime round-trip validation."""
    if data is None:
        return None
    r = Reader(data)
    string_start, capacity = r.integer(), r.integer()
    node_start = 8 + capacity * 8
    if not 8 <= node_start <= string_start <= len(data) or (string_start - node_start) % 16:
        raise ValueError('Invalid StringPathHash header')
    if node_start == string_start:
        return None
    r.seek(node_start)
    key, offset = r.val('<q'), r.integer()
    r.seek(string_start + offset)
    length = r.count()
    if length % 2:
        raise ValueError('Invalid StringPathHash UTF-16 length')
    return key, r.take(length).decode('utf-16-le')
