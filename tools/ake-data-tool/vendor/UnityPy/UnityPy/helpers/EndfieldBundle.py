"""Endfield aggregate bundle decoder (48-byte header, encFlags=8)."""

import struct
from collections import namedtuple

import lz4.block

from .EndfieldCipher import crypt, crypt_extended_block

Node = namedtuple("Node", "path offset size flags")
MAX_OUTPUT = 512 * 1024 * 1024


def rol(value, bits, width=32):
    return ((value << bits) | (value >> (width - bits))) & ((1 << width) - 1)


def is_endfield_bundle(data):
    if len(data) < 8:
        return False
    first, second = struct.unpack_from(">II", data)
    value = first ^ 0x4A92F0CD
    return second == (((4 * value) & 0xFFFF0000) ^ rol(value, 18) ^ 0xD8B1E637)


class Cursor:
    def __init__(self, data):
        self.data = data
        self.pos = 0

    def take(self, size):
        if size < 0 or self.pos + size > len(self.data):
            raise ValueError("Truncated Endfield data at offset %d" % self.pos)
        out = self.data[self.pos : self.pos + size]
        self.pos += size
        return out

    def unpack(self, fmt):
        return struct.unpack(fmt, self.take(struct.calcsize(fmt)))

    def number(self, fmt):
        return self.unpack(fmt)[0]

    def name(self):
        start = self.pos
        while self.pos - start <= 32768:
            if self.take(1) == b"\0":
                raw = self.data[start : self.pos - 1]
                return bytes(v ^ ((i ^ 0x97) & 255) for i, v in enumerate(raw)).decode("utf8")
        raise ValueError("Endfield node name too long")


def decode_size(high, low):
    return rol((((high ^ low ^ 0xA121) & 65535) << 16) | low, 14) ^ 0xF74324EE


def decode_long(high, low, rotation):
    return rol(((high ^ low ^ 0xDAD76848) << 32) | low, rotation, 64) ^ 0xA4F1A11747816520


def decode_count(reader, mask, final):
    value = reader.number(">I") ^ int.from_bytes(mask.to_bytes(4, "big"), "little")
    low, high = value & 65535, value >> 16
    count = rol(((low ^ high) << 16) | low, 14) ^ final
    if count > 1000000:
        raise ValueError("Invalid Endfield table count: %d" % count)
    return count


def decompress_lz4inv(data, size):
    if not 0 <= size <= MAX_OUTPUT:
        raise ValueError("Endfield block exceeds output limit")
    r = Cursor(data)
    out = bytearray()

    def length(value):
        if value == 15:
            while True:
                n = r.number("B")
                value += n
                if n != 255:
                    break
        return value

    while r.pos < len(data) and len(out) < size:
        token = r.number("B")
        literal = length((token & 3) | ((token >> 2) & 12))
        out.extend(r.take(literal))
        if len(out) > size:
            raise ValueError("Endfield literal exceeds output size")
        if r.pos == len(data) or len(out) == size:
            break
        back = r.number(">H")
        match = length(((token >> 2) & 3) | ((token >> 4) & 12)) + 4
        if back == 0 or back > len(out) or len(out) + match > size:
            raise ValueError("Invalid Endfield LZ4 back reference")
        for _ in range(match):
            out.append(out[-back])
    if len(out) != size or r.pos != len(data):
        raise ValueError("Endfield LZ4 size mismatch")
    return bytes(out)


class UnsupportedStorageBlock(ValueError):
    """An object requested bytes from an unsupported extended storage block."""


def read_bundle_blocks(data):
    if not is_endfield_bundle(data):
        raise ValueError("Invalid Endfield bundle signature")
    r = Cursor(data)
    r.take(8)
    cl, fm, em, sl, fe, uh, _, ul, sh, ch, _ = r.unpack(">HIIIIHIHIHB")
    csize, usize = decode_size(ch, cl), decode_size(uh, ul)
    flags, enc = fe ^ fm ^ 0xA7F49310, em ^ fm
    # The encoded declared size is unreliable in shipped bundles; use actual bounds.
    decode_long(sh, sl, 46)
    if enc != 8 or flags & 0x80:
        raise ValueError("Unsupported Endfield header: encFlags=%d flags=0x%x" % (enc, flags))
    if max(csize, usize) > MAX_OUTPUT:
        raise ValueError("Endfield metadata exceeds output limit")
    r.take(48 - r.pos)
    metadata = r.take(csize)
    mode = flags & 63
    if mode == 3:
        metadata = lz4.block.decompress(crypt(metadata), uncompressed_size=usize)
    elif mode != 0:
        raise ValueError("Unsupported Endfield metadata compression: %d" % mode)
    if len(metadata) != usize:
        raise ValueError("Endfield metadata size mismatch")
    m = Cursor(metadata)
    blocks = []
    total = 0
    for _ in range(decode_count(m, 0x8A7BF723, 0x91CE0A4F)):
        uh, ch, ul, ef, cl = m.unpack(">HHHHH")
        ef ^= 0x9CD6
        low, high = ef & 255, ef >> 8
        bf = ul ^ rol(((low ^ high) << 8) | low, 14, 16) ^ 0x523F
        extension = m.take(4) if bf & 0x80 else None
        us, cs = decode_size(uh, ul), decode_size(ch, cl)
        total += us
        if total > MAX_OUTPUT or cs > len(data):
            raise ValueError("Endfield payload exceeds bounds")
        blocks.append((us, cs, bf, extension))
    nodes = []
    materialized = 0
    for _ in range(decode_count(m, 0x5DE50A6B, 0xE4C1D9F2)):
        ef, sh, ol, oh = m.unpack(">IIII")
        name = m.name()
        sl = m.number(">I")
        ef ^= 0x8E06A9F8
        low, high = ef & 65535, ef >> 16
        nf = rol(((high ^ low) << 16) | low, 14) ^ 0xF13927C4 ^ sh
        offset, size = decode_long(oh, ol, 14), decode_long(sh, sl, 14)
        materialized += size
        if materialized > MAX_OUTPUT:
            raise ValueError("Endfield materialized nodes exceed output limit")
        if not name or offset + size > total:
            raise ValueError("Invalid Endfield node range: %r" % name)
        nodes.append(Node(name, offset, size, nf))
    if m.pos != len(metadata):
        raise ValueError("Trailing Endfield metadata")
    if flags & 0x200:
        r.take((-csize) % 16)
    r.data = memoryview(data)
    stored = [(us, bf, extension, r.take(cs)) for us, cs, bf, extension in blocks]
    if r.pos != len(data):
        raise ValueError("Trailing Endfield bundle bytes")
    return stored, nodes


def decode_storage_block(size, flags, extension, data):
    mode = flags & 63
    if extension is not None:
        compressed = None
        if flags == 0x85:
            key_id = int.from_bytes(extension, "big")
            compressed = crypt_extended_block(data, key_id)
        if compressed is None:
            raise UnsupportedStorageBlock(f"Endfield block flags={flags:#x}, extension={extension.hex()}")
        data = decompress_lz4inv(compressed, size)
    elif mode == 5:
        data = decompress_lz4inv(crypt(data), size)
    elif mode != 0:
        raise ValueError("Unsupported Endfield block compression: %d" % mode)
    if len(data) != size:
        raise ValueError("Endfield block size mismatch")
    return data


def decode_bundle(data):
    blocks, nodes = read_bundle_blocks(data)
    return b"".join(decode_storage_block(*block) for block in blocks), nodes
