"""MessagePack asset maps used by the image history service.

Wire layout is [game_type, [[name, container, source, path_id, type,
hash, offset], ...]].  Large maps may be wrapped in MessagePack-CSharp's
LZ4 block-array extension (type 98).  This module does not infer hashes.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re


@dataclass(frozen=True)
class AssetEntry:
    name: str
    container: str
    source: str
    path_id: int
    type: int
    hash: str
    offset: int


def read_map(path: Path, expected_count: int | None = None):
    import lz4.block
    import msgpack

    outer = msgpack.unpackb(path.read_bytes(), raw=False, strict_map_key=False)
    if (isinstance(outer, list) and len(outer) >= 2
            and isinstance(outer[0], msgpack.ExtType) and outer[0].code == 98):
        unpacker = msgpack.Unpacker(raw=False, max_buffer_size=0)
        unpacker.feed(outer[0].data)
        sizes = list(unpacker)
        if len(sizes) != len(outer) - 1 or any(type(n) is not int or n < 0 or n > 1024 * 1024 * 1024 for n in sizes):
            raise ValueError('Invalid asset map compressed block sizes')
        blocks = []
        for size, block in zip(sizes, outer[1:]):
            if not isinstance(block, bytes):
                raise ValueError('Invalid asset map compressed block')
            decoded = lz4.block.decompress(block, uncompressed_size=size)
            if len(decoded) != size:
                raise ValueError('Asset map block size mismatch')
            blocks.append(decoded)
        outer = msgpack.unpackb(b''.join(blocks), raw=False, strict_map_key=False)
    if not isinstance(outer, list) or len(outer) != 2 or type(outer[0]) is not int or not isinstance(outer[1], list):
        raise ValueError('Invalid asset map root')
    result = []
    for row in outer[1]:
        if (not isinstance(row, list) or len(row) != 7
                or any(not isinstance(row[i], str) for i in (0, 1, 2, 5))
                or any(type(row[i]) is not int for i in (3, 4, 6))):
            raise ValueError('Invalid asset map entry')
        result.append(AssetEntry(*row))
    if expected_count is not None and len(result) != expected_count:
        raise ValueError('Asset map entry count differs from manifest')
    return outer[0], result


def write_map(path: Path, game_type: int, entries: list[AssetEntry]):
    import lz4.block
    import msgpack

    payload = [game_type, [[e.name, e.container, e.source, e.path_id,
                            e.type, e.hash, e.offset] for e in entries]]
    raw = msgpack.packb(payload, use_bin_type=True)
    if len(raw) < 64:
        path.write_bytes(raw)
        return
    chunks = [raw[offset:offset + 32768] for offset in range(0, len(raw), 32768)]
    sizes = b''.join(msgpack.packb(len(chunk)) for chunk in chunks)
    blocks = [lz4.block.compress(chunk, store_size=False) for chunk in chunks]
    path.write_bytes(msgpack.packb([msgpack.ExtType(98, sizes), *blocks], use_bin_type=True))


def object_hash(raw: bytes) -> str:
    """SDK hashes the serialized object bytes with XXH64 and seed zero."""
    import xxhash

    return format(xxhash.xxh64_intdigest(raw, seed=0), 'x')


def delta_entries(current: list[AssetEntry], histories: list[list[AssetEntry]]):
    valid = re.compile(r'^[0-9a-f]{1,16}$')
    old_hashes = {entry.hash.strip().lower() for history in histories for entry in history
                  if valid.fullmatch(entry.hash.strip().lower())}
    delta = []
    skipped = invalid = 0
    for entry in current:
        value = entry.hash.strip().lower()
        if not valid.fullmatch(value):
            invalid += 1
            delta.append(entry)
        elif value in old_hashes:
            skipped += 1
        else:
            delta.append(entry)
    return delta, len(old_hashes), skipped, invalid
