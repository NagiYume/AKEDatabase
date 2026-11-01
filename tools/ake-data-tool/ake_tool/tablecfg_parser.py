"""Local TableCfg transport and Spark decoding, independent of beyond-sdk.

Protocol reference: export_tablecfg.py supplied for read-only inspection.
Spark carries its own field definitions; no game-table allowlist is used.
"""
from __future__ import annotations

import base64
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import ValidationError
from .models import CancellationToken


TABLE_BLOCK = "42A8FCA6"
PC_KEY = base64.b64decode("6VsxesT4KFadI6hr8nHctT6Eb6dckk1nHbqOOPTKUuE=")


def require_crypto() -> None:
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms
    except ImportError as exc:
        raise ValidationError("TableCfg Python 解析需要 cryptography，请安装工具 requirements.txt") from exc


def decrypt(payload: bytes, nonce: bytes, token: CancellationToken) -> bytes:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms

    if len(nonce) != 12:
        raise ValidationError("TableCfg ChaCha20 nonce 长度错误")
    # Same 16-byte state as openssl enc -chacha20: counter=1 + VFS nonce.
    cipher = Cipher(algorithms.ChaCha20(PC_KEY, struct.pack("<I", 1) + nonce), None)
    context = cipher.decryptor()
    result = bytearray()
    for start in range(0, len(payload), 1024 * 1024):
        token.raise_if_cancelled()
        result.extend(context.update(payload[start:start + 1024 * 1024]))
    result.extend(context.finalize())
    return bytes(result)


class BinaryCursor:
    def __init__(self, payload: bytes, token: CancellationToken) -> None:
        self.payload = payload
        self.position = 0
        self.token = token

    def move(self, position: int) -> None:
        if not 0 <= position <= len(self.payload):
            raise ValidationError(f"二进制偏移越界：{position}/{len(self.payload)}")
        self.position = position

    def read(self, length: int) -> bytes:
        self.token.raise_if_cancelled()
        end = self.position + length
        if length < 0 or end > len(self.payload):
            raise ValidationError(f"二进制数据截断：{self.position} + {length}")
        result = self.payload[self.position:end]
        self.position = end
        return result

    def number(self, code: str) -> Any:
        return struct.unpack("<" + code, self.read(struct.calcsize("<" + code)))[0]

    def count(self) -> int:
        value = self.number("i")
        if not 0 <= value <= len(self.payload):
            raise ValidationError(f"非法集合长度：{value}")
        return value

    def align(self, boundary: int = 4) -> None:
        # A final packed bool can have virtual padding outside the buffer.
        self.position = (self.position + boundary - 1) // boundary * boundary

    def text(self, prefixed: bool = False) -> str:
        if prefixed:
            return self.read(self.number("H")).decode("utf-8")
        end = self.payload.find(b"\0", self.position)
        if end < 0:
            raise ValidationError(f"字符串缺少终止符：{self.position}")
        return self.read(end - self.position + 1)[:-1].decode("utf-8")


@dataclass(frozen=True)
class SparkField:
    name: str
    kind: int
    type_hash: int | None = None
    item: SparkField | None = None
    key: SparkField | None = None
    value: SparkField | None = None


class SparkDecoder(BinaryCursor):
    def __init__(self, payload: bytes, token: CancellationToken) -> None:
        super().__init__(payload, token)
        self.beans: dict[int, list[SparkField]] = {}
        self.enums: dict[int, dict[int, str]] = {}
        self.active_beans: set[tuple[int, int]] = set()

    def scalar_definition(self, name: str, kind: int) -> SparkField:
        if not 0 <= kind <= 8:
            raise ValidationError(f"不支持的 Spark 元素类型：{kind} ({name})")
        type_hash = None
        if kind in (6, 8):
            self.align()
            type_hash = self.number("i")
        return SparkField(name, kind, type_hash)

    def definition(self, name: str, kind: int) -> SparkField:
        if kind == 9:
            return SparkField(name, kind, item=self.scalar_definition(name, self.number("B")))
        if kind == 10:
            key_kind, value_kind = self.number("B"), self.number("B")
            key = self.scalar_definition(name, key_kind)
            value = self.scalar_definition(name, value_kind)
            return SparkField(name, kind, key=key, value=value)
        return self.scalar_definition(name, kind)

    def indirect(self, callback: Any, empty: Any = None) -> Any:
        offset = self.number("i")
        if offset == -1:
            return empty
        saved = self.position
        self.move(offset)
        try:
            return callback()
        finally:
            self.move(saved)

    def scalar(self, field: SparkField) -> Any:
        kind = field.kind
        if kind == 0:
            return bool(self.number("B"))
        if kind in (1, 2, 4, 6):
            return self.number({1: "B", 2: "i", 4: "f", 6: "i"}[kind])
        if kind in (3, 5):
            self.align(8)
            return self.number("q" if kind == 3 else "d")
        if kind == 7:
            return self.indirect(self.text, "")
        if kind == 8:
            return self.indirect(lambda: self.bean(field.type_hash))
        raise ValidationError(f"不支持的 Spark 标量：{kind} ({field.name})")

    def array(self, field: SparkField) -> list[Any]:
        assert field.item is not None
        return [self.scalar(field.item) for _ in range(self.count())]

    def mapping(self, field: SparkField) -> dict[str, Any]:
        assert field.key is not None and field.value is not None
        if field.key.kind not in (2, 3, 7):
            raise ValidationError(f"不支持的 Spark Map 键类型：{field.key.kind}")
        size = self.count()
        self.read(size * 8)  # Lookup index, followed by ordered key/value pairs.
        result = {}
        for _ in range(size):
            key = str(self.scalar(field.key))
            value = self.scalar(field.value)
            if field.value.kind == 0:
                self.align()
            elif field.value.kind == 6:
                if field.value.type_hash not in self.enums:
                    raise ValidationError(f"缺少 Spark 枚举定义：{field.value.type_hash}")
                value = self.enums[field.value.type_hash].get(value, str(value))
            if key in result:
                raise ValidationError(f"重复 Spark Map 键：{key}")
            result[key] = value
        return result

    def bean(self, type_hash: int | None) -> dict[str, Any]:
        if type_hash not in self.beans:
            raise ValidationError(f"缺少 Spark Bean 定义：{type_hash}")
        marker = (type_hash, self.position)
        if marker in self.active_beans:
            raise ValidationError(f"Spark Bean 指针循环：{marker}")
        self.active_beans.add(marker)
        try:
            fields = self.beans[type_hash]
            result = {}
            for index, field in enumerate(fields):
                if field.kind == 9:
                    value = self.indirect(lambda: self.array(field))
                elif field.kind == 10:
                    value = self.indirect(lambda: self.mapping(field))
                else:
                    value = self.scalar(field)
                    if field.kind == 0 and (index == len(fields) - 1 or fields[index + 1].kind != 0):
                        self.align()
                if field.name in result:
                    raise ValidationError(f"重复 Spark 字段：{field.name}")
                result[field.name] = value
            return result
        finally:
            self.active_beans.remove(marker)

    def decode(self) -> Any:
        definitions, root, data = (self.number("i") for _ in range(3))
        self.move(definitions)
        for _ in range(self.count()):
            kind = self.number("B")
            self.align()
            type_hash = self.number("i")
            self.text()
            self.align()
            size = self.count()
            if kind == 8:
                fields = []
                for _ in range(size):
                    name = self.text()
                    fields.append(self.definition(name, self.number("B")))
                registry, definition = self.beans, fields
            elif kind == 6:
                values = {}
                for _ in range(size):
                    name = self.text()
                    self.align()
                    values[self.number("i")] = name
                registry, definition = self.enums, values
            else:
                raise ValidationError(f"不支持的 Spark 定义类型：{kind}")
            if type_hash in registry and registry[type_hash] != definition:
                raise ValidationError(f"冲突的 Spark 类型定义：{type_hash}")
            registry[type_hash] = definition
        self.move(root)
        kind, name = self.number("B"), self.text()
        field = self.definition(name, kind)
        self.move(data)
        if kind == 8:
            return self.bean(field.type_hash)
        if kind == 10:
            return self.mapping(field)
        raise ValidationError(f"不支持的 Spark 根类型：{kind} ({name})")


@dataclass(frozen=True)
class TableEntry:
    name: str
    chunk: Path
    offset: int
    length: int
    encrypted: bool
    seed: int


def read_table_index(block: Path, token: CancellationToken) -> tuple[int, list[TableEntry]]:
    raw = block.read_bytes()
    if len(raw) < 16:
        raise ValidationError("TableCfg BLC 文件头截断")
    decoded = raw[:12] + decrypt(raw[12:], raw[:12], token)
    cursor = BinaryCursor(decoded, token)
    version = cursor.number("I")
    if version > 10:
        version = 3
    cursor.read(8)
    layout = cursor.number("i")
    if layout not in range(6):
        raise ValidationError(f"不支持的 BLC 格式：{layout}，或解密密钥不匹配")
    if layout == 5:
        checksum = struct.unpack("<I", decoded[-4:])[0]
        if zlib.crc32(decoded[12:-4]) != checksum:
            raise ValidationError("TableCfg BLC v5 CRC 不匹配")
        cursor.payload = decoded[:-4]
    cursor.read(4)
    cursor.text(prefixed=True)
    if cursor.read(4).hex().upper() != TABLE_BLOCK:
        raise ValidationError("BLC 不是 TableCfg 区块，或解密密钥不匹配")
    cursor.read(4)
    expected_files = cursor.count()
    expected_bytes = cursor.number("Q")
    block_type = cursor.number("B")
    entries = []
    total_bytes = 0

    def tag() -> None:
        value = cursor.number("Q" if layout == 5 else "I")
        known = value in (0, 0x00209C855B11B951) if layout == 5 else (value & 255) in (0, 1)
        if not known:
            raise ValidationError(f"未知 BLC 文件标记：{value}，格式 {layout}")

    for _ in range(cursor.count()):
        chunk_hash = cursor.read(16)
        chunk = block.parent / (chunk_hash.hex().upper() + ".chk")
        cursor.read(16)
        chunk_size = cursor.number("Q")
        total_bytes += chunk_size
        if cursor.number("B") != block_type:
            raise ValidationError(f"BLC chunk 区块类型不一致：{chunk.name}")
        tag()
        for _ in range(cursor.count()):
            name = cursor.text(prefixed=True)
            cursor.read(8)
            if cursor.read(16) != chunk_hash:
                raise ValidationError(f"BLC chunk 引用不匹配：{name}")
            cursor.read(16)
            offset, length = cursor.number("Q"), cursor.number("Q")
            if offset > chunk_size or length > chunk_size - offset:
                raise ValidationError(f"BLC 文件范围越界：{name}")
            if cursor.number("B") != block_type:
                raise ValidationError(f"BLC 文件区块类型不一致：{name}")
            encrypted = cursor.number("B")
            if encrypted not in (0, 1):
                raise ValidationError(f"BLC 非法加密标志：{name}")
            seed = cursor.number("Q") if encrypted else 0
            tag()
            entries.append(TableEntry(name, chunk, offset, length, bool(encrypted), seed))
    if len(entries) != expected_files or total_bytes != expected_bytes:
        raise ValidationError("BLC 文件数或 chunk 总长度不匹配")
    return version, entries
