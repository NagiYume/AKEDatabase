"""Read-only Endfield aggregate container, with ordinary UnityPy child files."""

from bisect import bisect_right
from io import SEEK_CUR, SEEK_END, SEEK_SET

from ..enums import FileType
from ..helpers.EndfieldBundle import UnsupportedStorageBlock, decode_storage_block, read_bundle_blocks
from ..streams import EndianBinaryReader
from .File import File


class _NodeStream:
    """Seekable view of one node. Missing block data can never be read."""

    def __init__(self, node, ends, chunks):
        self.node = node
        self.ends = ends
        self.chunks = chunks
        self.position = 0

    def tell(self):
        return self.position

    def seek(self, offset, whence=SEEK_SET):
        base = {SEEK_SET: 0, SEEK_CUR: self.position, SEEK_END: self.node.size}[whence]
        if base + offset < 0:
            raise ValueError("Negative Endfield node offset")
        self.position = base + offset
        return self.position

    def read(self, size=-1):
        remaining = max(0, self.node.size - self.position)
        length = remaining if size < 0 else min(remaining, size)
        start = self.node.offset + self.position
        stop = start + length
        parts = []
        index = bisect_right(self.ends, start)
        while start < stop:
            chunk = self.chunks[index]
            if isinstance(chunk, UnsupportedStorageBlock):
                raise UnsupportedStorageBlock(f"{self.node.path} at offset {start - self.node.offset}: {chunk}")
            end = min(self.ends[index], stop)
            block_start = self.ends[index - 1] if index else 0
            parts.append(chunk[start - block_start:end - block_start])
            start = end
            index += 1
        self.position += length
        return b"".join(parts)

    def close(self):
        self.chunks = ()


class EndfieldBundleFile(File):
    def __init__(self, reader, parent=None, name=None, is_dependency=False):
        super().__init__(parent, name, is_dependency)
        reader.Position = 0
        blocks, nodes = read_bundle_blocks(reader.read_bytes(reader.Length))
        allow_partial = getattr(self.environment, "allow_partial_endfield_bundles", False)
        if not allow_partial or not any(extension is not None for _, _, extension, _ in blocks):
            payload = b"".join(decode_storage_block(*block) for block in blocks)
            self.read_files(EndianBinaryReader(payload), nodes)
            return

        ends, chunks = [], []
        size = 0
        for block in blocks:
            size += block[0]
            ends.append(size)
            try:
                chunks.append(decode_storage_block(*block))
            except UnsupportedStorageBlock as exc:
                chunks.append(UnsupportedStorageBlock(str(exc)))
                self.has_unavailable_blocks = True
        for node in nodes:
            node_reader = EndianBinaryReader(_NodeStream(node, ends, chunks))
            # Raw resource streams have no header. Their first block may be unavailable.
            typ = FileType.ResourceFile if node.path.lower().endswith((".ress", ".resource")) else None
            self._register_node(node, node_reader, typ)

    def save(self, *args, **kwargs):
        raise NotImplementedError("Writing Endfield aggregate bundles is not supported")
