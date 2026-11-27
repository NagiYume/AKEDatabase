# Custom AES substitution and sampled stream transform used by Endfield bundles.
from functools import lru_cache

KEY = bytes.fromhex(
    """
    3A F1 8C 47 B2 09 6D EE 51 24 90 7C 18 D3 A4 62
    """
)
IV = bytes.fromhex(
    """
    C7 12 5E A9 04 DB 33 88 F2 0E 77 49 65 BA 1C 93
    """
)
S_BOX = bytes.fromhex(
    """
    E4 B9 45 07 92 82 2F 43 F5 C9 22 25 A9 4F 46 6D
    4A 71 8B 6C 8C EB B2 AC CF 0C 9E 01 38 32 D3 93
    98 63 DA 96 E5 C4 C3 6B 7F 26 72 D7 97 D5 80 BC
    5D BB 55 67 10 73 B3 8D E2 35 29 47 A8 60 3F C5
    EF 68 EC BE AB C6 B8 5C D8 15 09 54 F3 7A 40 A2
    30 0A DC 53 FA DB F1 78 DE AD F0 B5 C1 81 9F 3E
    83 90 31 F2 FB 21 28 85 06 CA CD 1E D4 3C A0 C8
    23 16 6E 89 1D E7 EE 5E 42 BD CB 13 50 A6 4E 49
    58 DF 2C 84 87 B6 91 52 DD 19 F9 2B 4D 77 BA 04
    A5 41 CE 94 3D 5F FC 9B 79 9A 7E 65 5A B1 66 34
    56 A7 1A BF EA 7D 27 0B 59 2E AE 14 33 C0 51 39
    C7 3A 2A 9D F4 7C CC D1 D6 70 37 0E 75 02 1B E3
    E9 48 0D 24 2D F7 D2 B7 AF A3 A1 64 7B ED F8 05
    95 3B 74 FD 62 D0 0F FF 4B AA 88 5B 03 B4 E8 9C
    B0 17 1C 76 57 E0 A4 44 20 D9 8E 11 86 69 36 FE
    4C 6F 61 6A 8F E1 18 8A 12 99 E6 1F 00 08 F6 C2
    """
)

# The extension selects a template and two substitution tables for the low and high counter bytes.
_STORAGE_BLOCK_KEYS = {
    0xB0C1DD0B: (
        bytes.fromhex("D1 9A 00 00 83 00 00 94 00 00 6B 7C 00 49 EE 00"),
        (0xF6, ((12, 2, 0x5E, 0x83), (9, 1, 0x2E, 0x6F), (6, 1, 0x5B, 0x46), (3, 3, 0xF9, 0x82))),
        (0xF7, ((8, 3, 0xDB, 0x20), (5, 2, 0x4B, 0x0B), (2, 1, 0xCD, 0x27), (15, 1, 0xF8, 0xC8))),
    ),
    0xB0C9DD0B: (
        bytes.fromhex("E8 4F 00 00 04 00 00 DE 00 00 03 AF 00 40 E5 00"),
        (0x03, ((12, 2, 0x5A, 0x02), (9, 1, 0xEF, 0xA0), (6, 1, 0x53, 0x74), (3, 3, 0x04, 0x71))),
        (0x39, ((8, 3, 0x85, 0xDB), (5, 2, 0x31, 0x4E), (2, 1, 0xA2, 0x53), (15, 1, 0x6C, 0x2B))),
    ),
}


def _xtime(v):
    return ((v << 1) ^ (0x1B if v & 0x80 else 0)) & 255


def crypt_extended_block(data, key_id):
    """Transform a 0x85 payload, returning None for an unknown key selector."""
    parameters = _STORAGE_BLOCK_KEYS.get(key_id)
    if parameters is None:
        return None

    template, low, high = parameters
    stream = bytearray(template)
    out = bytearray(len(data))
    for counter, start in enumerate(range(0, len(data), 16)):
        for (mask, entries), counter_byte in ((low, counter & 0xFF), (high, (counter >> 8) & 0xFF)):
            x = S_BOX[counter_byte ^ mask]
            doubled = _xtime(x)
            products = (0, x, doubled, doubled ^ x)
            for position, multiplier, index_mask, output_mask in entries:
                stream[position] = S_BOX[products[multiplier] ^ index_mask] ^ output_mask
        end = min(start + 16, len(data))
        length = end - start
        value = int.from_bytes(data[start:end], "little") ^ int.from_bytes(stream[:length], "little")
        out[start:end] = value.to_bytes(length, "little")
    return bytes(out)


@lru_cache(maxsize=1)
def _round_keys():
    words = [list(KEY[i : i + 4]) for i in range(0, 16, 4)]
    rc = 1
    while len(words) < 44:
        w = words[-1][:]
        if len(words) % 4 == 0:
            w = [S_BOX[v] for v in w[1:] + w[:1]]
            w[0] ^= rc
            rc = _xtime(rc)
        words.append([a ^ b for a, b in zip(w, words[-4])])
    return [sum(words[i : i + 4], []) for i in range(0, 44, 4)]


def _encrypt(block):
    keys = _round_keys()
    state = [v ^ k for v, k in zip(block, keys[0])]
    for rnd in range(1, 11):
        state = [S_BOX[v] for v in state]
        state = [state[((col + row) % 4) * 4 + row] for col in range(4) for row in range(4)]
        if rnd != 10:
            for c in range(0, 16, 4):
                a, b, d, e = state[c : c + 4]
                t = a ^ b ^ d ^ e
                state[c : c + 4] = [
                    a ^ t ^ _xtime(a ^ b),
                    b ^ t ^ _xtime(b ^ d),
                    d ^ t ^ _xtime(d ^ e),
                    e ^ t ^ _xtime(e ^ a),
                ]
        state = [v ^ k for v, k in zip(state, keys[rnd])]
    return state


def _continuous(data):
    out = bytearray(data)
    previous = IV
    for pos in range(0, len(out), 16):
        stream = _encrypt(previous)
        for i in range(min(16, len(out) - pos)):
            out[pos + i] ^= stream[i]
        previous = []
        for i, value in enumerate(stream):
            value ^= (31 * i) ^ ((0xF19AB7752CDD0196 >> (8 * (i % 8))) & 255)
            value &= 255
            previous.append(S_BOX[((value >> 5) | (value << 3)) & 255])
    return bytes(out)


def crypt(data):
    if len(data) <= 256:
        return _continuous(data)
    out = bytearray(data)
    blocks = len(out) // 16
    count = min(blocks, 256)
    step = 1 if blocks > 256 else max(256 // blocks, 1)
    sampled = bytearray(256)
    for i in range(count):
        sampled[i * step : (i + 1) * step] = out[i * 16 : i * 16 + step]
    decoded = _continuous(sampled)
    for i in range(count):
        out[i * 16 : i * 16 + step] = decoded[i * step : (i + 1) * step]
    return bytes(out)
