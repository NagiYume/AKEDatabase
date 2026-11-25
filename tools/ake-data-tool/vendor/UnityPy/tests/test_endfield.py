import hashlib
import io
import struct
from pathlib import Path

import pytest

import UnityPy
from UnityPy.endfield import PC_KEY, EndfieldVFS, _decrypt
from UnityPy.helpers.EndfieldBundle import (
    UnsupportedStorageBlock,
    decode_bundle,
    decode_storage_block,
    decompress_lz4inv,
)
from UnityPy.helpers.ImportHelper import check_file_type

FIXTURES = Path(__file__).parent / "fixtures" / "endfield"


def test_production_aggregate():
    raw = (FIXTURES / "aggregate.bin").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == "65a88346480bf8f3ce93e7c9e33f7e186539d8611b5cc4ae744de510a320ede9"
    payload, nodes = decode_bundle(raw)
    assert [(n.path, n.size) for n in nodes] == [
        ("CAB-dda756238d04de89c59d562835d15c3a", 6076),
        ("CAB-dda756238d04de89c59d562835d15c3a.resS", 1024),
    ]
    assert len(payload) == 7100
    for source in (raw, io.BytesIO(raw), str(FIXTURES / "aggregate.bin")):
        env = UnityPy.load(source)
        assert len(env.assets) == 1
        assert {o.type.name for o in env.objects} == {"Texture2D", "AssetBundle"}
        for o in env.objects:
            assert isinstance(o.parse_as_dict(), dict)
            if o.type.name == "Texture2D":
                assert o.parse_as_object().image.size == (256, 1)
        assert len(env.container) == 1
        with pytest.raises(NotImplementedError):
            env.file.save()


@pytest.mark.parametrize("data", [b"", b"abc", b"UnityFS\0", b"\0" * 128])
def test_other_files_are_not_endfield(data):
    typ, _ = check_file_type(data)
    assert typ != UnityPy.enums.FileType.EndfieldBundleFile


@pytest.mark.parametrize("cut", [8, 20, 47, 48, 100, -1])
def test_truncated_bundle(cut):
    raw = (FIXTURES / "aggregate.bin").read_bytes()
    with pytest.raises((ValueError, RuntimeError)):
        decode_bundle(raw[:cut])


def test_trailing_bytes_and_lz4_bounds():
    with pytest.raises(ValueError):
        decode_bundle((FIXTURES / "aggregate.bin").read_bytes() + b"\xff")
    compressed = (FIXTURES / "lz4inv.bin").read_bytes()
    assert decompress_lz4inv(compressed, 9) == b"abcabcabc"
    for data, size in [(compressed[:-1], 9), (compressed + b"x", 9), (compressed, 8), (b"\x00\x00\x00", 4)]:
        with pytest.raises(ValueError):
            decompress_lz4inv(data, size)


@pytest.mark.parametrize(
    "extension, keystream",
    [
        (
            "b0c1dd0b",
            "D19A7BB983A0F894BFDC6B7C2349EEA6"
            "D19A7BD283A07D94BF856B7C8949EEA6"
            "D19A7B0B83A02494BFC86B7C3649EEA6",
        ),
        (
            "b0c9dd0b",
            "E84FC83E04FB8EDE538003AFF840E586"
            "E84FC81504FBC6DE530E03AF9740E586"
            "E84FC81304FBFADE535103AF6540E586",
        ),
    ],
)
def test_extended_storage_block(extension, keystream):
    payload = bytes(range(45))
    # A single 45-byte LZ4Inv literal ends partway through the third cipher segment.
    compressed = b"\x33\x1e" + payload
    encrypted = bytes(byte ^ mask for byte, mask in zip(compressed, bytes.fromhex(keystream)))
    assert decode_storage_block(len(payload), 0x85, bytes.fromhex(extension), memoryview(encrypted)) == payload


def test_unknown_extended_storage_block():
    with pytest.raises(UnsupportedStorageBlock, match=r"flags=0x85, extension=b0c2dd0b"):
        decode_storage_block(9, 0x85, bytes.fromhex("b0c2dd0b"), b"")


def make_vfs(tmp_path, version, encrypted):
    pytest.importorskip("Crypto.Cipher.ChaCha20")
    root = tmp_path / "VFS" / "7064D8E2"
    root.mkdir(parents=True)
    raw = (FIXTURES / "aggregate.bin").read_bytes()
    chunk_id = bytes(range(16))
    seed, nonce_version = 0xFEDCBA9876543210, 3
    name = b"Data/Bundles/Windows/main/example.ab"

    def packed_string(s):
        return struct.pack("<H", len(s)) + s

    tag = struct.pack("<Q", 0x00209C855B11B951) if version == 5 else struct.pack("<I", 1)
    chunk = root / (chunk_id.hex().upper() + ".chk")
    data = _decrypt(raw, PC_KEY, struct.pack("<IQ", nonce_version, seed)) if encrypted else raw
    chunk.write_bytes(b"prefix" + data)
    entry = packed_string(name) + struct.pack("<Q", 0) + chunk_id + hashlib.md5(raw).digest()
    entry += struct.pack("<QQBB", 6, len(raw), 11, encrypted)
    if encrypted:
        entry += struct.pack("<Q", seed)
    entry += tag
    header = struct.pack("<II", version, 0) + packed_string(b"Bundle") + bytes.fromhex("7064D8E2")
    header += struct.pack("<IiQBi", 0, 1, 6 + len(raw), 11, 1)
    header += chunk_id + bytes(16) + struct.pack("<QB", 6 + len(raw), 11) + tag + struct.pack("<i", 1) + entry
    nonce = struct.pack("<IQ", nonce_version, 123)
    index = root / "7064D8E2.blc"
    index.write_bytes(nonce + _decrypt(header, PC_KEY, nonce))
    return index, chunk, name.decode(), raw


@pytest.mark.parametrize("version", [0, 4, 5])
@pytest.mark.parametrize("encrypted", [False, True])
def test_vfs_paths_encryption_and_unity_load(tmp_path, version, encrypted):
    index, chunk, name, raw = make_vfs(tmp_path, version, encrypted)
    for path in [tmp_path, tmp_path / "VFS", index.parent, index, chunk]:
        vfs = EndfieldVFS(path)
        assert list(vfs.entries) == [name]
        assert vfs.read(name) == raw
        assert len(vfs.load(name).objects) == 2
        assert len(UnityPy.load(str(path)).objects) == 2
    chunk.write_bytes(b"prefix" + bytes(len(raw)))
    with pytest.raises(ValueError, match="MD5"):
        EndfieldVFS(index).read(name)
    chunk.write_bytes(b"prefix")
    with pytest.raises(ValueError, match="Truncated"):
        EndfieldVFS(index).read(name)


def test_bad_vfs_key_and_non_bundle(tmp_path):
    index, _, _, _ = make_vfs(tmp_path, 5, True)
    with pytest.raises(ValueError):
        EndfieldVFS(index, key=bytes(32))
    with pytest.raises(ValueError, match="32 bytes"):
        EndfieldVFS(index, key=b"x")
