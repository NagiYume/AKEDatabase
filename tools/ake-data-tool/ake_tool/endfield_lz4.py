"""Bounds-checked Endfield LZ4Inv block decoding.

The block format follows moeyinlo/UnityPy's EndfieldBundle helper (MIT):
https://github.com/moeyinlo/UnityPy/blob/d30856c00e570b9fa68fd5909644c1e893f07c51/UnityPy/helpers/EndfieldBundle.py
Overlap copies repeat the preceding offset-sized sequence, avoiding a Python
loop for every output byte. This differs from the Arknights lz4inv package.
"""
from __future__ import annotations


def decompress(data: bytes, size: int) -> bytes:
    if not 0 <= size <= 512 * 1024 * 1024:
        raise ValueError('Endfield block exceeds output limit')
    position = 0
    output = bytearray()
    data_size = len(data)

    def length(value):
        nonlocal position
        if value == 15:
            while True:
                if position >= data_size:
                    raise ValueError('Truncated Endfield LZ4 length')
                n = data[position]
                position += 1
                value += n
                if n != 255:
                    break
        return value

    while position < data_size and len(output) < size:
        token = data[position]
        position += 1
        literal = length((token & 3) | ((token >> 2) & 12))
        if position + literal > data_size or len(output) + literal > size:
            raise ValueError('Invalid Endfield LZ4 literal range')
        output.extend(data[position:position + literal])
        position += literal
        if position == data_size or len(output) == size:
            break
        if position + 2 > data_size:
            raise ValueError('Truncated Endfield LZ4 offset')
        back = (data[position] << 8) | data[position + 1]
        position += 2
        match = length(((token >> 2) & 3) | ((token >> 4) & 12)) + 4
        if back == 0 or back > len(output) or len(output) + match > size:
            raise ValueError('Invalid Endfield LZ4 back reference')
        start = len(output) - back
        if match <= back:
            output.extend(output[start:start + match])
        else:
            sequence = output[start:]
            repetitions, tail = divmod(match, back)
            output.extend(sequence * repetitions)
            output.extend(sequence[:tail])
    if len(output) != size or position != data_size:
        raise ValueError('Endfield LZ4 size mismatch')
    return bytes(output)


