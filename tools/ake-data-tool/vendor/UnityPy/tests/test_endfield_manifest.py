import hashlib
import struct
from pathlib import Path

import brotli
import pytest

import UnityPy
from UnityPy.endfield import PC_KEY, _decrypt
from UnityPy.helpers.EndfieldManifest import EndfieldManifest

SAMPLES = Path(__file__).parent / "samples"
FIXTURE = Path(__file__).parent / "fixtures" / "endfield" / "aggregate.bin"
HIGH_HASH = 0xFEDCBA9876543210


def manifest_bytes(*, missing_dependency=False, conflict=False):
    data = bytearray(4)

    def ref(raw):
        offset = len(data)
        data.extend(struct.pack("<i", len(raw)) + raw)
        return offset

    def deps(values):
        offset = len(data)
        data.extend(struct.pack("<i", len(values)) + struct.pack("<" + str(len(values)) + "i", *values))
        return offset

    rows = [
        (1, "main/root.ab", [999 if missing_dependency else 2], []),
        (2, "main/dependency.ab", [], [3]),
        (3, "initial/leaf.ab", [1], []),  # cycle, without duplicate loads
    ]
    bundles = bytearray(struct.pack("<i", len(rows)))
    for idx, name, ds, direct in rows:
        bundles.extend(
            struct.pack(
                "<6iQQii", idx, ref(name.encode("utf-16-le")), deps(ds), deps([]), deps(direct), 0, idx, idx + 10, 0, 0
            )
        )
    names = [
        ("Assets/Root.asset", HIGH_HASH, 1),
        ("assets/dependency.asset", 123, 2),
        ("assets/leaf.asset", 456, 3),
        ("Assets/Root.asset", HIGH_HASH, 1),
    ]
    if conflict:
        names.append(("assets/conflict.asset", HIGH_HASH, 2))
    assets = bytearray(struct.pack("<iii", 1, 12, len(names)))
    for name, h, idx in names:
        assets.extend(struct.pack("<Qiiii", h, ref(brotli.compress(name.encode("utf-16-le"))), idx, 100, 0))

    def text(s):
        return struct.pack("<i", len(s)) + s.encode("utf-16-le")

    raw = struct.pack("<I", 0xFF11FF11) + text("version") + struct.pack("<I", 0xF1F2F3F4) + text("hash") + text("cl")
    for section in (assets, b"", bundles):
        raw += struct.pack("<i", len(section)) + section
    return raw + bytes(4) + data


def write_group(root, group, kind, files):
    folder = root / "VFS" / group
    folder.mkdir(parents=True)
    chunk_id = hashlib.md5(group.encode()).digest()
    chunk_data = bytearray()
    records = bytearray()

    def string(s):
        raw = s.encode()
        return struct.pack("<H", len(raw)) + raw

    for i, (name, raw, patch) in enumerate(files):
        offset = len(chunk_data)
        seed = 0xF000000000000000 + i
        chunk_data.extend(_decrypt(raw, PC_KEY, struct.pack("<IQ", 3, seed)))
        records.extend(string(name) + bytes(8) + chunk_id + hashlib.md5(raw).digest())
        records.extend(struct.pack("<QQBBQQ", offset, len(raw), kind, 1, seed, 0x00209C855B11B951 if patch else 0))
    header = struct.pack("<II", 5, 0) + string("group") + bytes.fromhex(group) + bytes(4)
    header += struct.pack("<iQBi", len(files), len(chunk_data), kind, 1)
    header += chunk_id + bytes(16) + struct.pack("<QBQi", len(chunk_data), kind, 0, len(files)) + records
    nonce = struct.pack("<IQ", 3, 987)
    index = folder / (group + ".blc")
    index.write_bytes(nonce + _decrypt(header, PC_KEY, nonce))
    chunk = folder / (chunk_id.hex().upper() + ".chk")
    chunk.write_bytes(chunk_data)
    return index, chunk


@pytest.fixture
def vfs(tmp_path):
    pytest.importorskip("Crypto.Cipher.ChaCha20")
    write_group(
        tmp_path,
        "7064D8E2",
        11,
        [
            ("Data/Bundles/Windows/main/root.ab", FIXTURE.read_bytes(), False),
            ("Data/Bundles/Windows/main/dependency.ab", (SAMPLES / "banner_1").read_bytes(), False),
        ],
    )
    write_group(
        tmp_path,
        "0CE8FA57",
        2,
        [
            ("Data/Bundles/Windows/initial/leaf.ab", (SAMPLES / "atlas_test").read_bytes(), False),
        ],
    )
    write_group(
        tmp_path,
        "1CDDBF1F",
        4,
        [
            ("Data/Bundles/Windows/manifest.hgmmap", b"bad base must not be selected", False),
            ("Data/Bundles/Windows/manifest.hgmmap", brotli.compress(manifest_bytes()), True),
        ],
    )
    return UnityPy.EndfieldVFS(tmp_path)


def test_manifest_paths_hashes_and_duplicate_rows():
    m = EndfieldManifest(manifest_bytes())
    assert len(m.bundles) == 3
    assert m.asset_rows == 4
    assert len(m.assets_by_path) == 3
    a = m.find_asset(" ASSETS\\ROOT.ASSET ")
    assert a.path_hash == HIGH_HASH
    assert a.bundle_name == "main/root.ab"
    assert m.find_asset(HIGH_HASH) is a
    assert m.find_asset(HIGH_HASH - (1 << 64)) is a
    assert m.find_asset("missing") is None
    assert m.find_asset(0) is None
    assert [b.bundle_index for b in m.dependency_closure(1)] == [1, 2, 3]
    assert m.bundles[2].direct_dependencies == (3,)
    with pytest.raises(ValueError, match="64 bits"):
        m.find_asset(1 << 64)
    with pytest.raises(TypeError):
        m.find_asset(None)


def test_manifest_brotli_and_conflicts():
    assert len(EndfieldManifest(brotli.compress(manifest_bytes())).assets_by_path) == 3
    with pytest.raises(ValueError, match="Conflicting"):
        EndfieldManifest(manifest_bytes(conflict=True))
    m = EndfieldManifest(manifest_bytes(missing_dependency=True))
    with pytest.raises(ValueError, match="999"):
        m.dependency_closure(1)


@pytest.mark.parametrize("cut", [0, 3, 12, 60, -1])
def test_manifest_truncation(cut):
    with pytest.raises((ValueError, brotli.error)):
        EndfieldManifest(manifest_bytes()[:cut])


def test_lazy_catalog_and_existing_bundle_api(vfs):
    assert vfs._catalog is None
    assert len(vfs.entries) == 3
    env = vfs.load("Data/Bundles/Windows/main/root.ab")
    assert len(env.objects) == 2
    assert vfs._catalog is None
    assert vfs.find_asset("assets/root.asset").bundle_index == 1
    assert vfs.catalog is vfs.catalog
    assert len(vfs.entries) == 3  # manifest group remains private to the catalog loader


def test_asset_dependencies_visibility_cache_and_promotion(vfs, monkeypatch):
    vfs.find_asset(HIGH_HASH)
    original_read = vfs.read
    reads = []

    def read(entry):
        reads.append(entry.name)
        return original_read(entry)

    monkeypatch.setattr(vfs, "read", read)
    env = vfs.load_asset("assets/root.asset")
    assert len(reads) == 3
    assert len(env.files) == 3
    assert len(env.assets) == 1
    assert len(env.objects) == 2
    assert len(env.container) == 1
    root = env.files["Data/Bundles/Windows/main/root.ab"]
    assert not root.is_dependency
    assert env.files["Data/Bundles/Windows/main/dependency.ab"].is_dependency
    before_cabs = dict(env.cabs)
    assert vfs.load_asset(HIGH_HASH, environment=env) is env
    assert len(reads) == 3
    assert env.cabs == before_cabs
    vfs.load_asset("assets/dependency.asset", environment=env)
    assert len(reads) == 3
    assert len(env.assets) == 2
    assert len(env.objects) > 2
    assert len(env.container) > 1
    assert not env.files["Data/Bundles/Windows/main/dependency.ab"].is_dependency
    vfs.load_asset("assets/root.asset", environment=env)
    assert not env.files["Data/Bundles/Windows/main/dependency.ab"].is_dependency


def test_root_only_missing_asset_and_missing_chunk(vfs):
    env = vfs.load_asset(HIGH_HASH, with_dependencies=False)
    assert len(env.files) == 1
    assert len(env.objects) == 2
    with pytest.raises(FileNotFoundError, match="resource not found"):
        vfs.load_asset("missing")
    vfs.entries["Data/Bundles/Windows/initial/leaf.ab"].chunk.unlink()
    empty = UnityPy.Environment()
    with pytest.raises(FileNotFoundError, match="chunk is missing"):
        vfs.load_asset(HIGH_HASH, environment=empty)
    assert empty.files == {}
    assert len(vfs.load_asset(HIGH_HASH, with_dependencies=False).objects) == 2


def test_missing_manifest_only_affects_catalog(vfs):
    (vfs._vfs_root / "1CDDBF1F" / "1CDDBF1F.blc").unlink()
    assert len(vfs.load("Data/Bundles/Windows/main/root.ab").objects) == 2
    with pytest.raises(FileNotFoundError):
        vfs.find_asset(HIGH_HASH)


def test_standalone_manifest_and_partial_selection(vfs, tmp_path):
    standalone = tmp_path / "manifest.hgmmap"
    standalone.write_bytes(brotli.compress(manifest_bytes()))
    selected = UnityPy.EndfieldVFS(vfs._vfs_root / "7064D8E2", manifest_path=standalone)
    assert selected.find_asset("assets/root.asset").path_hash == HIGH_HASH
    with pytest.raises(FileNotFoundError, match="absent from this VFS selection"):
        selected.load_asset(HIGH_HASH)
    assert len(selected.load_asset(HIGH_HASH, with_dependencies=False).objects) == 2


def test_brotli_output_limit():
    from UnityPy.helpers.EndfieldManifest import _decompress

    with pytest.raises(ValueError, match="output limit"):
        _decompress(brotli.compress(b"x" * 1024), 100)


def test_replaced_file_cache_and_conflicting_snapshot(vfs):
    from dataclasses import replace

    env = vfs.load_asset(HIGH_HASH, with_dependencies=False)
    name = "Data/Bundles/Windows/main/root.ab"
    original = env.files.pop(name)
    vfs.load_asset(HIGH_HASH, with_dependencies=False, environment=env)
    assert env.files[name] is not original
    vfs.entries[name] = replace(vfs.entries[name], md5=bytes(16))
    with pytest.raises(ValueError, match="Cannot mix"):
        vfs.load_asset(HIGH_HASH, with_dependencies=False, environment=env)


@pytest.mark.parametrize(
    "target,value",
    [
        ("bundle_count", 99999),
        ("bucket_count", -1),
        ("bucket_offset", 0),
        ("asset_bundle", 999),
        ("path_offset", -1),
        ("dependency_count", -1),
    ],
)
def test_manifest_rejects_out_of_bounds_tables(target, value):
    from UnityPy.helpers.EndfieldBundle import Cursor

    raw = bytearray(manifest_bytes())
    r = Cursor(raw)
    r.take(4)
    r.take(r.number("<i") * 2)
    r.take(4)
    r.take(r.number("<i") * 2)
    r.take(r.number("<i") * 2)
    sections = []
    for _ in range(3):
        length = r.number("<i")
        sections.append(r.pos)
        r.take(length)
    r.take(4)
    base = r.pos
    assets, _, bundles = sections
    offsets = {
        "bundle_count": bundles,
        "bucket_offset": assets + 4,
        "bucket_count": assets + 8,
        "asset_bundle": assets + 12 + 12,
        "path_offset": assets + 12 + 8,
        "dependency_count": base + struct.unpack_from("<i", raw, bundles + 4 + 8)[0],
    }
    struct.pack_into("<i", raw, offsets[target], value)
    with pytest.raises(ValueError):
        EndfieldManifest(bytes(raw))
