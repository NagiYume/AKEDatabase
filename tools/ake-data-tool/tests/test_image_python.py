import tempfile
import unittest
from pathlib import Path

from ake_tool.endfield_lz4 import decompress
from ake_tool.native_asset_map import AssetEntry, delta_entries, read_map, write_map


def block(literal: bytes, back: int, match: int) -> bytes:
    n, m = len(literal), match - 4
    token = (n & 3) | ((n & 12) << 2) | ((m & 3) << 2) | ((m & 12) << 4)
    return bytes([token]) + literal + back.to_bytes(2, 'big')


class EndfieldCompressionTests(unittest.TestCase):
    def test_overlapping_and_nonoverlapping_backreferences(self):
        self.assertEqual(decompress(block(b'abc', 3, 8), 11), b'abcabcabcab')
        self.assertEqual(decompress(block(b'abcdefgh', 8, 4), 12), b'abcdefghabcd')

    def test_invalid_backreference_is_rejected(self):
        with self.assertRaises(ValueError):
            decompress(block(b'abc', 4, 4), 7)

    def test_extended_literal_and_match_lengths(self):
        literal = b'abcdefghijklmnopq'
        encoded = b'\xff\x02' + literal + b'\x00\x03\x03'
        self.assertEqual(decompress(encoded, 39), literal + (b'opq' * 8)[:22])


class NativeMapTests(unittest.TestCase):
    def test_roundtrip_count_and_hash_only_delta(self):
        first = AssetEntry('a', 'assets/a.png', 'block/chunk.chk', 1, 28, 'ab', 0)
        same_hash = AssetEntry('b', 'assets/b.png', 'block/chunk.chk', 2, 28, 'AB', 0)
        changed = AssetEntry('c', 'assets/c.png', 'block/chunk.chk', 3, 28, 'cd', 0)
        invalid = AssetEntry('d', 'assets/d.png', 'block/chunk.chk', 4, 28, '', 0)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'assets.map'
            write_map(path, 35, [first, same_hash, changed, invalid])
            game, entries = read_map(path, 4)
            self.assertEqual(game, 35)
            self.assertEqual(entries, [first, same_hash, changed, invalid])
            with self.assertRaises(ValueError):
                read_map(path, 5)
        delta, hashes, skipped, invalid_count = delta_entries(entries, [[first]])
        self.assertEqual(delta, [changed, invalid])
        self.assertEqual((hashes, skipped, invalid_count), (1, 2, 1))


if __name__ == '__main__':
    unittest.main()
