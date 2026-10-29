from __future__ import annotations

import json
import shutil
import struct
import subprocess
from pathlib import Path, PureWindowsPath

from .errors import AkeToolError, CancelledError, ValidationError
from .file_copy import assert_no_linked_files
from .models import CancellationToken, ProgressCallback, ProgressEvent, null_progress
from .tablecfg_parser import TABLE_BLOCK, SparkDecoder, decrypt, read_table_index, require_crypto


def format_command(command: list[str]) -> str:
    # Shared by the image/Json SDK launchers.
    return subprocess.list2cmdline([str(argument) for argument in command])


def _remove_directory(path: Path, allowed_parent: Path) -> None:
    resolved = path.resolve()
    parent = allowed_parent.resolve()
    if resolved == parent or parent not in resolved.parents:
        raise AkeToolError(f"拒绝删除工作目录以外的路径：{resolved}")
    if resolved.exists():
        shutil.rmtree(resolved)


class PythonTableUnpacker:
    def unpack(
        self,
        source_root: Path,
        output_root: Path,
        token: CancellationToken,
        progress: ProgressCallback = null_progress,
    ) -> Path:
        token.raise_if_cancelled()
        require_crypto()
        source_root = source_root.resolve()
        output_root = output_root.resolve()
        if source_root == output_root or source_root in output_root.parents or output_root in source_root.parents:
            raise ValidationError("TableCfg 输入与输出目录不能相互包含")
        assert_no_linked_files(source_root, "TableCfg Python 输入目录")
        block = source_root / "VFS" / TABLE_BLOCK / f"{TABLE_BLOCK}.blc"
        if not block.is_file():
            raise FileNotFoundError(f"TableCfg BLC 不存在：{block}")
        progress(ProgressEvent("unpack", "读取 TableCfg BLC 索引（Python）"))
        version, entries = read_table_index(block, token)
        pending = output_root / ".tablecfg-pending"
        selected = []
        targets = set()
        for entry in entries:
            token.raise_if_cancelled()
            parts = entry.name.replace("\\", "/").split("/")
            if "TableCfg" not in parts:
                progress(ProgressEvent("unpack", f"非 TableCfg 条目，未导出：{entry.name}", level="warning"))
                continue
            relative_parts = parts[parts.index("TableCfg") + 1:]
            if not relative_parts or any(
                part in ("", ".", "..") or ":" in part or PureWindowsPath(part).is_reserved()
                or part.endswith((" ", ".")) or any(c in part for c in '<>"|?*')
                for part in relative_parts
            ):
                raise ValidationError(f"不安全的 TableCfg 路径：{entry.name}")
            relative = Path(*relative_parts).with_suffix(".json")
            target = (pending / relative).resolve()
            if pending not in target.parents:
                raise ValidationError(f"TableCfg 输出路径越界：{entry.name}")
            key = relative.as_posix().casefold()
            if key in targets:
                raise ValidationError(f"重复 TableCfg 输出路径：{entry.name}")
            targets.add(key)
            if not entry.chunk.is_file() or entry.offset + entry.length > entry.chunk.stat().st_size:
                raise ValidationError(f"TableCfg chunk 缺失或截断：{entry.chunk} ({entry.name})")
            selected.append((entry, relative))
        if not selected:
            raise ValidationError("BLC 中没有 TableCfg 文件")

        token.raise_if_cancelled()
        output_root.parent.mkdir(parents=True, exist_ok=True)
        _remove_directory(output_root, output_root.parent)
        pending.mkdir(parents=True)
        progress(ProgressEvent("unpack", f"启动 Python TableCfg 解析，共 {len(selected)} 个文件"))
        # Promote only a complete export, never partially parsed tables.
        try:
            for index, (entry, relative) in enumerate(selected, 1):
                token.raise_if_cancelled()
                try:
                    with entry.chunk.open("rb") as stream:
                        stream.seek(entry.offset)
                        payload = stream.read(entry.length)
                    if len(payload) != entry.length:
                        raise ValidationError("TableCfg chunk 读取截断")
                    if entry.encrypted:
                        payload = decrypt(payload, struct.pack("<IQ", version, entry.seed), token)
                    if payload.lstrip().startswith((b"{", b"[")) or payload.startswith(b"\xef\xbb\xbf"):
                        value = json.loads(payload.decode("utf-8-sig"))
                    else:
                        value = SparkDecoder(payload, token).decode()
                    target = pending / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with target.open("w", encoding="utf-8", newline="\n") as stream:
                        encoder = json.JSONEncoder(ensure_ascii=False, indent=2, allow_nan=False)
                        for fragment in encoder.iterencode(value):
                            token.raise_if_cancelled()
                            stream.write(fragment)
                        stream.write("\n")
                except CancelledError:
                    raise
                except Exception as exc:
                    raise ValidationError(f"Python TableCfg 解析失败：{entry.name}：{exc}") from exc
                progress(ProgressEvent("unpack", f"已解析 {relative.as_posix()}", index, len(selected),
                                       details={"file_name": relative.as_posix()}))
            token.raise_if_cancelled()
            data_root = output_root / "data"
            data_root.mkdir()
            pending.rename(data_root / "TableCfg")
            return data_root
        finally:
            if pending.exists():
                _remove_directory(pending, output_root)
