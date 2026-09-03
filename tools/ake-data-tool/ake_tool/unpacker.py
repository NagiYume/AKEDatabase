from __future__ import annotations

import queue
import locale
import shutil
import subprocess
import threading
from pathlib import Path

from .errors import AkeToolError, CancelledError
from .models import CancellationToken, ProgressCallback, ProgressEvent, null_progress


TABLE_RUNNER_SOURCE = Path(__file__).with_name("BeyondSdkTableRunner.java")


def format_command(command: list[str]) -> str:
    return subprocess.list2cmdline([str(argument) for argument in command])


def _remove_directory(path: Path, allowed_parent: Path) -> None:
    resolved = path.resolve()
    parent = allowed_parent.resolve()
    if resolved == parent or parent not in resolved.parents:
        raise AkeToolError(f"拒绝删除工作目录以外的路径：{resolved}")
    if resolved.exists():
        shutil.rmtree(resolved)


class BeyondSdkTableUnpacker:
    def __init__(
        self,
        sdk_path: Path,
        java_path: str,
    ) -> None:
        self.sdk_path = sdk_path.resolve()
        self.java_path = java_path.strip()

    def unpack(
        self,
        source_root: Path,
        output_root: Path,
        token: CancellationToken,
        progress: ProgressCallback = null_progress,
    ) -> Path:
        if not self.sdk_path.is_file():
            raise FileNotFoundError(f"beyond-sdk.jar 不存在：{self.sdk_path}")
        if not self.java_path:
            raise ValueError("Java 命令不能为空")
        if not TABLE_RUNNER_SOURCE.is_file():
            raise FileNotFoundError(f"beyond-sdk TableCfg 本地启动器不存在：{TABLE_RUNNER_SOURCE}")
        if not (source_root / "VFS").is_dir():
            raise FileNotFoundError(f"SDK 输入目录中没有 VFS：{source_root / 'VFS'}")
        for index_name in ("index_main.json", "index_initial.json"):
            if not (source_root / index_name).is_file():
                raise FileNotFoundError(f"SDK 输入目录缺少索引：{source_root / index_name}")

        output_root.parent.mkdir(parents=True, exist_ok=True)
        _remove_directory(output_root, output_root.parent)
        output_root.mkdir(parents=True)

        token.raise_if_cancelled()
        command = [
            self.java_path,
            "-Xmx32G",
            "--enable-native-access=ALL-UNNAMED",
            "--class-path",
            str(self.sdk_path),
            str(TABLE_RUNNER_SOURCE),
            str(source_root / "VFS"),
            str(output_root),
        ]
        progress(ProgressEvent("unpack", f"执行命令：{format_command(command)}"))
        progress(ProgressEvent("unpack", "启动 beyond-sdk TableCfg 本地解析"))
        self._run_process(command, token, progress)

        candidates = (
            output_root / "data" / "Data",
            output_root / "Data",
            output_root / "data",
        )
        for data_root in candidates:
            if (data_root / "TableCfg").is_dir():
                return data_root
        raise AkeToolError(f"beyond-sdk 已结束，但没有生成 TableCfg 数据目录：{output_root}")

    @staticmethod
    def _run_process(
        command: list[str],
        token: CancellationToken,
        progress: ProgressCallback,
        stage: str = "unpack",
    ) -> None:
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding=locale.getpreferredencoding(False),
            errors="replace",
            creationflags=creation_flags,
        )
        output_queue: queue.Queue[str | None] = queue.Queue()

        def read_output() -> None:
            assert process.stdout is not None
            for line in process.stdout:
                output_queue.put(line.rstrip())
            output_queue.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        output_finished = False
        try:
            while not output_finished or process.poll() is None:
                if token.is_cancelled:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                    raise CancelledError("解包任务已取消")
                try:
                    line = output_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                if line is None:
                    output_finished = True
                elif line:
                    progress(ProgressEvent(stage, line))
            return_code = process.wait()
            if return_code != 0:
                raise AkeToolError(f"beyond-sdk TableCfg 解析失败，退出码 {return_code}")
        finally:
            if process.poll() is None:
                process.kill()
