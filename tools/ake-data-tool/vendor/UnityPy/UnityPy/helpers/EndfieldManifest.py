"""Endfield hgmmap resource paths, bundle identities, and dependency graph."""

from __future__ import annotations

import struct
from collections import deque
from dataclasses import dataclass
from typing import Dict, Optional, Tuple, Union

import brotli

from .EndfieldBundle import Cursor

MAX_MANIFEST_BYTES = 512 * 1024 * 1024
MAX_ROWS = 2_000_000


def normalize_path(path: str) -> str:
    return path.replace("\\", "/").strip().lower()


def _decompress(data: bytes, limit: int) -> bytes:
    decoder = brotli.Decompressor()
    parts = []
    size = 0
    for start in range(0, len(data), 65536):
        try:
            part = decoder.process(data[start : start + 65536])
        except brotli.error as exc:
            raise ValueError("Invalid Endfield Brotli data") from exc
        size += len(part)
        if size > limit:
            raise ValueError("Endfield manifest decompression exceeds output limit")
        parts.append(part)
    if not decoder.is_finished():
        raise ValueError("Truncated Endfield Brotli data")
    return b"".join(parts)


@dataclass(frozen=True)
class EndfieldBundleInfo:
    bundle_index: int
    name: str
    dependencies: Tuple[int, ...]
    direct_dependencies: Tuple[int, ...]
    reverse_dependencies: Tuple[int, ...]
    flags: int
    hash_name: int
    hash_version: int
    category: int


@dataclass(frozen=True)
class EndfieldAssetInfo:
    path: str
    path_hash: int
    bundle_index: int
    asset_size: int
    bundle_name: str


class EndfieldManifest:
    """An immutable snapshot indexed by normalized path and unsigned 64-bit hash.

    Reference offsets are relative to the data section. Asset names are separate
    Brotli-compressed UTF-16 strings; bundle names are plain UTF-16 strings.
    """

    def __init__(self, data: bytes):
        if len(data) > MAX_MANIFEST_BYTES:
            raise ValueError("Endfield manifest exceeds size limit")
        if data[:4] != b"\x11\xff\x11\xff":
            data = _decompress(data, MAX_MANIFEST_BYTES)
        r = Cursor(data)
        if r.number("<I") != 0xFF11FF11:
            raise ValueError("Invalid Endfield manifest magic")

        def string():
            count = r.number("<i")
            if count < 0:
                raise ValueError("Negative Endfield manifest string length")
            return r.take(count * 2).decode("utf-16-le")

        self.hash_version = string()
        if r.number("<I") != 0xF1F2F3F4:
            raise ValueError("Invalid Endfield manifest secondary magic")
        self.manifest_hash = string()
        self.perforce_cl = string()
        sections = []
        for _ in range(3):
            length = r.number("<i")
            if length < 0 or length > len(data) - r.pos:
                raise ValueError("Invalid Endfield manifest section size")
            sections.append(memoryview(data)[r.pos : r.pos + length])
            r.pos += length
        r.take(4)
        base = r.pos
        assets, _, bundles = sections

        def at(section, offset, fmt):
            if offset < 0 or offset + struct.calcsize(fmt) > len(section):
                raise ValueError("Endfield manifest reference exceeds section bounds")
            return struct.unpack_from(fmt, section, offset)

        def ref(offset):
            if offset == 0:
                return b""
            if offset < 0 or offset > len(data) - base - 4:
                raise ValueError("Invalid Endfield manifest data reference")
            size = at(data, base + offset, "<i")[0]
            if size < 0 or size > len(data) - base - offset - 4:
                raise ValueError("Invalid Endfield manifest reference size")
            return data[base + offset + 4 : base + offset + 4 + size]

        # Dependency references store an element count rather than a byte count.
        def dependencies(offset):
            if offset == 0:
                return ()
            if offset < 0 or offset > len(data) - base - 4:
                raise ValueError("Invalid Endfield dependency reference")
            count = at(data, base + offset, "<i")[0]
            if count < 0 or count > MAX_ROWS or 4 + count * 4 > len(data) - base - offset:
                raise ValueError("Invalid Endfield dependency count")
            return at(data, base + offset + 4, "<" + str(count) + "i")

        self.bundles: Dict[int, EndfieldBundleInfo] = {}
        count = at(bundles, 0, "<i")[0]
        if count < 0 or count > MAX_ROWS or 4 + count * 48 > len(bundles):
            raise ValueError("Invalid Endfield bundle table size")
        for i in range(count):
            idx, name, deps, reverse, direct, flags, hname, hver, category = at(bundles, 4 + i * 48, "<6iQQi")
            bundle = EndfieldBundleInfo(
                idx,
                ref(name).decode("utf-16-le"),
                dependencies(deps),
                dependencies(direct),
                dependencies(reverse),
                flags,
                hname,
                hver,
                category,
            )
            if not bundle.name:
                raise ValueError("Blank Endfield bundle name")
            old = self.bundles.setdefault(idx, bundle)
            if old != bundle:
                raise ValueError("Conflicting Endfield bundle index %d" % idx)

        self.assets_by_path: Dict[str, EndfieldAssetInfo] = {}
        self.assets_by_hash: Dict[int, EndfieldAssetInfo] = {}
        self.asset_rows = 0
        if not assets:
            return
        slots = at(assets, 0, "<i")[0]
        if slots < 0 or slots > MAX_ROWS or 4 + slots * 8 > len(assets):
            raise ValueError("Invalid Endfield asset bucket table")
        for slot in range(slots):
            offset, count = at(assets, 4 + slot * 8, "<ii")
            if count < 0 or self.asset_rows + count > MAX_ROWS:
                raise ValueError("Invalid Endfield asset bucket count")
            if count == 0:
                continue
            if offset < 4 + slots * 8 or offset + count * 24 > len(assets):
                raise ValueError("Invalid Endfield asset bucket range")
            self.asset_rows += count
            for i in range(count):
                path_hash, path_offset, idx, size = at(assets, offset + i * 24, "<Qiii")
                if idx not in self.bundles or size < 0:
                    raise ValueError("Invalid Endfield asset bundle or size")
                path = _decompress(ref(path_offset), 1024 * 1024).decode("utf-16-le")
                if not path:
                    raise ValueError("Blank Endfield asset path")
                asset = EndfieldAssetInfo(path, path_hash, idx, size, self.bundles[idx].name)
                for index, key in [(self.assets_by_path, normalize_path(path)), (self.assets_by_hash, path_hash)]:
                    old = index.setdefault(key, asset)
                    if old != asset:
                        raise ValueError("Conflicting Endfield resource path or hash: %s" % path)

    def find_asset(self, path_or_hash: Union[str, int]) -> Optional[EndfieldAssetInfo]:
        if isinstance(path_or_hash, str):
            return self.assets_by_path.get(normalize_path(path_or_hash))
        if isinstance(path_or_hash, int) and not isinstance(path_or_hash, bool):
            if not -(1 << 63) <= path_or_hash < (1 << 64):
                raise ValueError("Endfield resource hash exceeds 64 bits")
            return self.assets_by_hash.get(path_or_hash & ((1 << 64) - 1))
        raise TypeError("Expected an asset path or 64-bit integer hash")

    def dependency_closure(self, bundle_index: int) -> Tuple[EndfieldBundleInfo, ...]:
        queue = deque([bundle_index])
        seen = set()
        result = []
        while queue:
            idx = queue.popleft()
            if idx in seen:
                continue
            seen.add(idx)
            if idx not in self.bundles:
                raise ValueError("Missing Endfield dependency bundle index %d" % idx)
            bundle = self.bundles[idx]
            result.append(bundle)
            queue.extend(bundle.dependencies)
            queue.extend(bundle.direct_dependencies)
        return tuple(result)
