"""Bounded, isolated Windows IL2CPP export without JVM or network tasks."""
from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import time
from pathlib import Path

from .errors import AkeToolError, ValidationError
from .json_host.export_json import REQUIRED_RUNTIME, RESULT_PREFIX
from .models import CancellationToken


def resolve_json_runtime(work_root: Path, game_version: str, seed_version: str) -> Path:
    root = work_root / 'il2cpp-host-runtime'
    candidates = [root / game_version / seed_version, root / seed_version]
    versions = root / game_version / 'versions'
    if versions.is_dir():
        candidates.extend(sorted(versions.glob(seed_version + '-*')))
    complete = {p.resolve() for p in candidates if all(
        (p / name).is_file() and (p / name).stat().st_size > 0 for name in REQUIRED_RUNTIME)}
    if len(complete) != 1:
        raise ValidationError(
            f'Json 需要唯一的 {seed_version} 完整本地运行时，找到 {len(complete)} 个；'
            f'请在 {versions}/{seed_version}-<标识> 保留对应版本的 DLL 和 il2cpp_data。'
            'Python 解析不自动下载或猜测运行时版本。')
    return complete.pop()


def run_json_export(source: Path, output: Path, runtime: Path, token: CancellationToken,
                    progress, *, datasets=(), limit=None, timeout=1800, idle_timeout=300) -> dict:
    if os.name != 'nt':
        raise ValidationError('Json DLL 解析需要 Windows x64 Python')
    token.raise_if_cancelled()
    if output.exists() and any(output.iterdir()):
        raise ValidationError(f'Json 解析必须使用空的独立输出目录：{output}')
    output.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, '-u', '-m', 'ake_tool.json_host.export_json',
               '-i', str(source), '-o', str(output), '--runtime-root', str(runtime),
               '--include-lip-sync', '--worker-index', '0', '--worker-count', '1']
    for dataset in datasets:
        command.extend(('--type', dataset))
    if limit is not None:
        command.extend(('--limit-per-type', str(limit)))
    # Invoke one worker directly: terminating it also ends the entire native host.
    process = subprocess.Popen(command, cwd=Path(__file__).resolve().parents[1],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8',
        errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONDONTWRITEBYTECODE': '1'})
    lines = queue.Queue()

    def read_output():
        try:
            for line in process.stdout:
                lines.put(line.rstrip())
        finally:
            lines.put(None)

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    started = last_progress = time.monotonic()
    report = None
    ended = False
    try:
        with (output / 'parser.log').open('w', encoding='utf-8') as log:
            while not ended or process.poll() is None:
                token.raise_if_cancelled()
                if time.monotonic() - started > timeout or time.monotonic() - last_progress > idle_timeout:
                    raise TimeoutError('Python Json 解析超时，请检查 parser.log')
                try:
                    line = lines.get(timeout=0.2)
                except queue.Empty:
                    continue
                if line is None:
                    ended = True
                    continue
                last_progress = time.monotonic()
                log.write(line + '\n')
                log.flush()
                if line.startswith(RESULT_PREFIX):
                    report = json.loads(line[len(RESULT_PREFIX):])
                else:
                    progress(line)
            code = process.wait()
        if code or not isinstance(report, dict) or report.get('failed') or not report.get('selected'):
            raise AkeToolError(f'Python Json 导出失败或结果不完整（退出码 {code}）；日志：{output / "parser.log"}')
        expected = sum(count['written'] for count in report['datasets'].values())
        if expected != report['selected'] or not (output / 'data/Json').is_dir():
            raise ValidationError('Python Json 文件计数与宿主报告不一致')
        return {**report, 'seconds': round(time.monotonic() - started, 2)}
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        reader.join(timeout=5)
        process.stdout.close()
