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
from .json_host.export_json import RESULT_PREFIX, output_path
from .models import CancellationToken


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
        if code not in (0, 1) or not isinstance(report, dict):
            raise AkeToolError(f'Python Json 导出失败或结果不完整（退出码 {code}）；日志：{output / "parser.log"}')
        failed = report.get('failed')
        datasets = report.get('datasets')
        selected = report.get('selected')
        if (not isinstance(failed, list) or any(not isinstance(name, str) for name in failed)
                or not isinstance(datasets, dict) or type(selected) is not int
                or code != int(bool(failed))):
            raise ValidationError('Python Json 宿主报告与退出状态不一致')
        counts = ('written', 'preserved', 'failure')
        if any(not isinstance(dataset, dict) or any(type(dataset.get(name)) is not int or dataset[name] < 0
                                                   for name in counts) for dataset in datasets.values()):
            raise ValidationError('Python Json 宿主报告包含无效的文件计数')
        written = sum(dataset['written'] for dataset in datasets.values())
        root = output.resolve() / 'data/Json'
        if not written:
            raise ValidationError(f'Python Json 未导出可发布文件；日志：{output / "parser.log"}')
        if (sum(dataset['preserved'] for dataset in datasets.values())
                or sum(dataset['failure'] for dataset in datasets.values()) != len(failed)
                or written + len(failed) != selected or not root.is_dir()):
            raise ValidationError('Python Json 文件计数与宿主报告不一致')
        failed_targets = [output_path(output, name) for name in failed]
        if len(set(failed_targets)) != len(failed) or any(path.exists() for path in failed_targets):
            raise ValidationError('Python Json 失败条目与输出文件冲突')
        return {**report, 'written': written,
                'skipped_paths': sorted(path.relative_to(root).as_posix() for path in failed_targets),
                'seconds': round(time.monotonic() - started, 2)}
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


def run_globalbuff_export(source: Path, output: Path, runtime: Path, token: CancellationToken,
                          progress, *, key, limit=0, names=(), timeout=1800, idle_timeout=300) -> dict:
    if os.name != 'nt':
        raise ValidationError('GlobalBuff 解析需要 Windows x64 Python')
    if output.exists() and any(output.iterdir()):
        raise ValidationError(f'GlobalBuff 解析必须使用空的独立输出目录：{output}')
    command = [sys.executable, '-u', '-m', 'ake_tool.globalbuff_export',
               '--vfs', str(source), '--output', str(output), '--runtime', str(runtime)]
    if limit:
        command.extend(('--limit', str(limit)))
    for name in names:
        command.extend(('--name', name))
    process = subprocess.Popen(command, cwd=Path(__file__).resolve().parents[1],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8',
        errors='replace', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONDONTWRITEBYTECODE': '1',
             'AKE_GLOBALBUFF_VFS_KEY': key})
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
        while not ended or process.poll() is None:
            token.raise_if_cancelled()
            if time.monotonic() - started > timeout or time.monotonic() - last_progress > idle_timeout:
                raise TimeoutError('GlobalBuff 解析超时')
            try:
                line = lines.get(timeout=0.2)
            except queue.Empty:
                continue
            if line is None:
                ended = True
                continue
            last_progress = time.monotonic()
            if line.startswith('AKE_GLOBALBUFF_RESULT '):
                report = json.loads(line.removeprefix('AKE_GLOBALBUFF_RESULT '))
            else:
                progress(line)
        code = process.wait()
        files = list((output / 'GlobalBuffData').glob('*.json'))
        if code or not isinstance(report, dict) or not report.get('selected') or len(files) != report['selected']:
            raise AkeToolError(f'GlobalBuff 解析失败或结果不完整（退出码 {code}）')
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
