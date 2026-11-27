"""Read Endfield Bundle/InitBundle indexes without loading the entire VFS.

Only bundle groups are accepted; tables, Lua, and other game data are excluded.
"""

import base64
import hashlib
import struct
from dataclasses import dataclass
from pathlib import Path

from .helpers.EndfieldBundle import Cursor
from .helpers.EndfieldManifest import EndfieldAssetInfo as EndfieldAssetInfo
from .helpers.EndfieldManifest import EndfieldBundleInfo as EndfieldBundleInfo
from .helpers.EndfieldManifest import EndfieldManifest, normalize_path

PC_KEY = base64.b64decode("6VsxesT4KFadI6hr8nHctT6Eb6dckk1nHbqOOPTKUuE=")
ANDROID_KEY = base64.b64decode("eU1cu+MYQiaYdVherRzV86pv/N/lIU/9gIk+5n5Vj4Y=")
BUNDLE_GROUPS = ("0CE8FA57", "7064D8E2")
PATCH_TAG = 0x00209C855B11B951


def _decrypt(data, key, nonce):
    if len(key) != 32:
        raise ValueError("Endfield ChaCha20 key must have 32 bytes")
    try:
        from Crypto.Cipher import ChaCha20
    except ImportError as exc:
        raise ImportError("Install UnityPy[endfield] to read Endfield VFS indexes") from exc
    cipher = ChaCha20.new(key=key, nonce=nonce)
    cipher.seek(64)  # IETF ChaCha20 starts at counter 1, not PyCryptodome's 0.
    return cipher.decrypt(data)


@dataclass(frozen=True)
class EndfieldEntry:
    name: str
    chunk: Path
    offset: int
    size: int
    encrypted: bool
    iv_seed: int
    version: int
    md5: bytes
    patch: bool
    group: str


def _read_index(path, key, groups):
    raw = path.read_bytes()
    if len(raw) < 12:
        raise ValueError("Truncated Endfield BLC")
    r = Cursor(raw[:12] + _decrypt(raw[12:], key, raw[:12]))
    version = r.number("<I")
    if version > 10:
        version = 3
    r.take(8)
    fmt, _ = r.unpack("<II")
    if fmt not in range(6):
        raise ValueError("Unsupported Endfield BLC version %d (incorrect key?)" % fmt)

    def string():
        return r.take(r.number("<H")).decode("utf8")

    def tag():
        value = r.number("<Q" if fmt == 5 else "<I")
        if fmt == 5 and value not in (0, PATCH_TAG):
            raise ValueError("Unsupported Endfield v5 file tag")
        return value == PATCH_TAG if fmt == 5 else (value & 255) == 1

    self_group_name = string()
    group = r.take(4).hex().upper()
    if group != path.stem.upper():
        raise ValueError("Endfield BLC group hash mismatch (incorrect key?)")
    if group not in groups:
        raise ValueError("Unsupported Endfield VFS group")
    r.take(4)
    _, _, block_type, chunks = r.unpack("<iQBi")
    if block_type not in groups.values() or not 0 <= chunks <= len(raw) // 45:
        raise ValueError("Invalid Endfield bundle group %r" % self_group_name)
    for _ in range(chunks):
        chunk_name = r.take(16).hex().upper() + ".chk"
        r.take(16)
        chunk_size, _ = r.unpack("<QB")
        tag()
        count = r.number("<i")
        if not 0 <= count <= len(raw) // 60:
            raise ValueError("Invalid Endfield file count")
        chunk = path.parent / chunk_name
        for _ in range(count):
            name = string()
            r.take(8)
            file_chunk = r.take(16)
            md5 = r.take(16)
            offset, size, kind, encrypted = r.unpack("<QQBB")
            seed = r.number("<Q") if encrypted else 0
            patch = tag()
            if kind not in groups.values() or file_chunk.hex().upper() + ".chk" != chunk_name:
                raise ValueError("Invalid Endfield bundle location")
            if offset + size > chunk_size:
                raise ValueError("Endfield entry exceeds chunk bounds")
            yield EndfieldEntry(name, chunk, offset, size, bool(encrypted), seed, version, md5, patch, group)


class EndfieldVFS:
    """Index a VFS root, bundle group, .blc, or .chk; read bundles on demand.

    A .chk requires its sibling group .blc. ``entries`` is keyed by bundle name;
    patch entries override base entries, then Bundle overrides InitBundle.
    """

    def __init__(self, path, *, key=PC_KEY, manifest_path=None):
        self.path = Path(path).expanduser().resolve()
        self.key = bytes(key)
        if len(self.key) != 32:
            raise ValueError("Endfield ChaCha20 key must have 32 bytes")
        self.entries = {}
        self._catalog = None
        self._manifest_path = Path(manifest_path).expanduser().resolve() if manifest_path is not None else None
        self._bundle_names = None
        path = self.path
        selected_chunk = None
        if path.is_file():
            if path.suffix.lower() == ".chk":
                selected_chunk = path
                indexes = [path.parent / (path.parent.name + ".blc")]
            elif path.suffix.lower() == ".blc":
                indexes = [path]
            else:
                raise ValueError("Expected Endfield .blc or .chk")
        else:
            if (path / "VFS").is_dir():
                path /= "VFS"
            if path.name.upper() in BUNDLE_GROUPS:
                indexes = [path / (path.name + ".blc")]
            else:
                indexes = [path / group / (group + ".blc") for group in BUNDLE_GROUPS]
                indexes = [p for p in indexes if p.is_file()]
        if not indexes:
            raise FileNotFoundError("No Endfield bundle indexes found in %s" % self.path)
        self._vfs_root = indexes[0].parent.parent
        for index in indexes:
            self._index(index, selected_chunk)

    @staticmethod
    def recognizes(path):
        path = Path(path)
        if path.is_file():
            return path.suffix.lower() in (".blc", ".chk") and path.parent.name.upper() in BUNDLE_GROUPS
        root = path / "VFS" if (path / "VFS").is_dir() else path
        return (root.name.upper() in BUNDLE_GROUPS and (root / (root.name + ".blc")).is_file()) or any(
            (root / group / (group + ".blc")).is_file() for group in BUNDLE_GROUPS
        )

    def _index(self, path, selected_chunk):
        for entry in _read_index(path, self.key, {"0CE8FA57": 2, "7064D8E2": 11}):
            if selected_chunk is not None and entry.chunk != selected_chunk:
                continue
            old = self.entries.get(entry.name)
            if old is None or (entry.patch, entry.group == "7064D8E2") > (old.patch, old.group == "7064D8E2"):
                self.entries[entry.name] = entry

    @property
    def catalog(self):
        """Lazily load hgmmap once for this VFS snapshot; ordinary AB loads do not read it.

        Create a new EndfieldVFS after updating the game's VFS files. An explicit
        manifest_path may point to a standalone compressed or decoded hgmmap.
        """
        if self._catalog is None:
            if self._manifest_path is not None:
                data = self._manifest_path.read_bytes()
            else:
                index = self._vfs_root / "1CDDBF1F" / "1CDDBF1F.blc"
                candidates = [
                    entry
                    for entry in _read_index(index, self.key, {"1CDDBF1F": 4})
                    if normalize_path(entry.name) == "data/bundles/windows/manifest.hgmmap"
                ]
                if not candidates:
                    raise FileNotFoundError("Endfield manifest.hgmmap is absent from %s" % index)
                entry = next((entry for entry in candidates if entry.patch), candidates[0])
                data = self.read(entry)
            catalog = EndfieldManifest(data)
            self._catalog = catalog
        return self._catalog

    def find_asset(self, path_or_hash):
        """Return EndfieldAssetInfo, or None; accept a normalized path or 64-bit int hash."""
        return self.catalog.find_asset(path_or_hash)

    def _bundle_entry(self, name):
        if self._bundle_names is None:
            aliases = {}
            prefix = "data/bundles/windows/"
            for logical_name in self.entries:
                normalized = normalize_path(logical_name)
                for alias in {normalized, normalized[len(prefix) :] if normalized.startswith(prefix) else normalized}:
                    old = aliases.setdefault(alias, logical_name)
                    if old != logical_name:
                        raise ValueError("Conflicting Endfield bundle alias: %s" % alias)
            self._bundle_names = aliases
        logical_name = self._bundle_names.get(normalize_path(name))
        if logical_name is None:
            raise FileNotFoundError("Endfield bundle is absent from this VFS selection: %s" % name)
        entry = self.entries[logical_name]
        if not entry.chunk.is_file():
            raise FileNotFoundError("Endfield chunk is missing for %s: %s" % (name, entry.chunk))
        return entry

    @staticmethod
    def _promote(file):
        # A dependency later explicitly requested as a root must become visible.
        from .files import File, SerializedFile

        if not isinstance(file, File):
            return
        file.is_dependency = False
        if isinstance(file, SerializedFile):
            return
        for child in file.files.values():
            EndfieldVFS._promote(child)

    def load_asset(self, path_or_hash, *, with_dependencies=True, environment=None):
        """Load the asset's AB and optional transitive dependencies into an Environment.

        Dependencies are available to PPtr/resource resolution but excluded from
        env.objects/assets/container. Returns the ordinary Environment, whose
        container still represents loaded root bundles, not the manifest catalog.
        Repeated loads into the same environment reuse parsed bundles and edits.
        """
        from .environment import Environment

        asset = self.find_asset(path_or_hash)
        if asset is None:
            raise FileNotFoundError("Endfield resource not found: %s" % path_or_hash)
        bundles = (
            self.catalog.dependency_closure(asset.bundle_index)
            if with_dependencies
            else (self.catalog.bundles[asset.bundle_index],)
        )
        # Resolve all locations first, so missing dependency CHKs do not partly load the environment.
        entries = [(bundle, self._bundle_entry(bundle.name)) for bundle in bundles]
        env = environment if environment is not None else Environment()
        cache = getattr(env, "_endfield_loaded_bundles", None)
        if cache is None:
            cache = env._endfield_loaded_bundles = {}
        for bundle, entry in entries:
            dependency = bundle.bundle_index != asset.bundle_index
            cached = cache.get(entry.name)
            if cached is not None:
                old_entry, old_key, file = cached
                if old_entry != entry or old_key != self.key:
                    raise ValueError("Cannot mix Endfield VFS versions or keys in one environment")
                if env.files.get(entry.name) is not file:
                    cached = None
            if cached is None:
                file = env.load_file(self.read(entry), name=entry.name, is_dependency=dependency)
                cache[entry.name] = (entry, self.key, file)
            elif not dependency and getattr(file, "is_dependency", False):
                self._promote(file)
                env._container_index_built = False
        if len(env.files) == 1:
            env.file = next(iter(env.files.values()))
        return env

    def read(self, entry, *, verify=True):
        """Return decrypted logical bundle bytes; verify their stored MD5 by default."""
        if isinstance(entry, str):
            entry = self.entries[entry]
        if entry.size > 512 * 1024 * 1024:
            raise ValueError("Endfield logical bundle exceeds 512 MiB")
        with entry.chunk.open("rb") as stream:
            stream.seek(entry.offset)
            data = stream.read(entry.size)
        if len(data) != entry.size:
            raise ValueError("Truncated Endfield chunk: %s" % entry.chunk)
        if entry.encrypted:
            data = _decrypt(data, self.key, struct.pack("<IQ", entry.version, entry.iv_seed))
        if verify and hashlib.md5(data).digest() != entry.md5:
            raise ValueError("Endfield bundle MD5 mismatch: %s" % entry.name)
        return data

    def load(self, names=None, *, environment=None):
        """Load selected bundle names into an ordinary UnityPy Environment."""
        from .environment import Environment

        env = environment if environment is not None else Environment()
        if isinstance(names, str):
            names = [names]
        for name in self.entries if names is None else names:
            env.load_file(self.read(name), name=name)
        if len(env.files) == 1:
            env.file = next(iter(env.files.values()))
        return env


def load_endfield(path, bundle_names=None, *, key=PC_KEY):
    return EndfieldVFS(path, key=key).load(bundle_names)
