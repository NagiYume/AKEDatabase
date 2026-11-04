"""Persistent, per-block VFS updates shared by desktop and server tools."""
from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import subprocess
import tempfile
import time
import zipfile
from pathlib import Path, PurePosixPath

import requests

from .downloader import BLOCK_IDS, safe_target
from .errors import AkeToolError, CancelledError, ValidationError
from .file_copy import assert_no_linked_files, is_linked_file
from .file_facts import file_digest, remember_digest
from .models import DownloadEntry, ProgressEvent, null_progress


def identity(latest):
    return dict(gameVersion=latest.seed.game_version, seedVersion=latest.seed.seed_version,
                hotfixVersion=latest.hotfix.res_version,
                mainVersion=latest.hotfix.parts['main'].version,
                initialVersion=latest.hotfix.parts['initial'].version)


def _atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                     delete=False) as stream:
        temporary = Path(stream.name)
        json.dump(value, stream, ensure_ascii=False, indent=2)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _relative(value):
    value = str(value).replace('\\', '/')
    parts = value.split('/')
    if not value or any(p in ('', '.', '..') or ':' in p for p in parts):
        raise ValidationError(f'不安全的补丁路径：{value}')
    return '/'.join(parts)


class VfsUpdater:
    def __init__(self, root, client, downloader, token, progress=null_progress, legacy_records=None):
        self.root = Path(root).resolve()
        self.vfs = self.root / 'VFS'
        self.state_path = self.root / 'vfs-versions.json'
        self.client, self.downloader = client, downloader
        self.token, self.progress = token, progress
        self.manifests = {}
        self.patcher = None
        self.patcher_failed = False
        self.patch_bytes = 0
        self.legacy_records = legacy_records or {}
        try:
            state = json.loads(self.state_path.read_text(encoding='utf-8'))
            self.records = state['blocks'] if state.get('schema') == 1 else {}
            if not isinstance(self.records, dict):
                self.records = {}
        except (OSError, ValueError, KeyError, AttributeError):
            self.records = {}
        self.records = {k: v for k, v in self.records.items() if k in BLOCK_IDS and isinstance(v, dict)}
        # Older desktop configurations already recorded each block's identity.
        # Import only records belonging to this exact persistent VFS, never a job snapshot.
        for block, record in self.legacy_records.items():
            if block in self.records or block not in BLOCK_IDS or not isinstance(record, dict):
                continue
            if (record.get('verified') is True and record.get('vfsRoot')
                    and Path(record['vfsRoot']).resolve() == self.vfs
                    and all(record.get(k) for k in ('gameVersion', 'seedVersion', 'hotfixVersion'))):
                self.records[block] = {**record, 'verified': False}

    def emit(self, message):
        self.progress(ProgressEvent('download', message))

    def mode(self, block, latest):
        record = self.records.get(block, {})
        # Seed revisions within 1.6 remain in the same major resource generation.
        return ('patch' if record.get('gameVersion') == latest.seed.game_version
                and record.get('seedVersion') and record.get('hotfixVersion') else 'full')

    def matches(self, path, entry, trusted=False):
        return (path.is_file() and not is_linked_file(path)
                and path.stat().st_size == entry.size
                and (trusted or file_digest(path, token=self.token) == entry.md5.lower()))

    def trusted_entry(self, block, latest, entry):
        record = self.records.get(block, {})
        return (record.get('verified') is True
                and all(record.get(k) == v for k, v in identity(latest).items())
                and isinstance(record.get('files'), dict)
                and record.get('files', {}).get(entry.name) == [entry.size, entry.md5.lower()])

    def _save(self):
        _atomic_json(self.state_path, {'schema': 1, 'blocks': self.records})

    def _manifest(self, part):
        if part.path not in self.manifests:
            try:
                response = self.client.session.get(part.path + '/patch.json', timeout=self.client.timeout)
                response.raise_for_status()
                data = response.json()
                if str(data.get('version')) != part.version:
                    raise ValidationError('补丁清单版本不匹配')
                self.manifests[part.path] = {
                    _relative(f['name']): f for f in data['files'] if isinstance(f, dict)
                }
            except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError, ValidationError) as exc:
                self.emit(f'补丁清单不可用，回退完整下载：{exc}')
                self.manifests[part.path] = {}
        return self.manifests[part.path]

    def _hpatchz(self):
        if self.patcher:
            return self.patcher
        explicit = os.environ.get('AKE_HPATCHZ_PATH') or shutil.which('hpatchz')
        if explicit:
            self.patcher = str(Path(explicit).expanduser().resolve())
            return self.patcher
        # Official v5.1.3 release archive digests; no mutable 'latest' executable.
        assets = {
            ('Windows', 'amd64'): ('windows64', '77f141386e5d8f785c1c846e10fbbc19b6c05aa00e3f59cc44670fb3f0e2ae94'),
            ('Linux', 'x86_64'): ('linux64', '628963bf2ee9108a97260fa5eef44acd9ec94369b76090a957c9182b3abbb558'),
            ('Linux', 'aarch64'): ('linux_arm64', '03e404e16d06479deaba645a09ed5c06636778b083b82bc7fc932ba34425430b'),
        }
        asset, digest = assets[(platform.system(), platform.machine().lower())]
        folder = self.root / 'patch-tools' / '5.1.3' / asset
        folder.mkdir(parents=True, exist_ok=True)
        archive = folder / 'release.zip'
        if not archive.is_file() or file_digest(archive, 'sha256', self.token) != digest:
            self.emit('下载官方 HDiffPatch 5.1.3 补丁工具')
            url = f'https://github.com/sisong/HDiffPatch/releases/download/v5.1.3/hdiffpatch_v5.1.3_bin_{asset}.zip'
            temporary = archive.with_suffix('.part')
            with self.client.session.get(url, timeout=self.client.timeout, stream=True) as response:
                response.raise_for_status()
                with temporary.open('wb') as output:
                    for chunk in response.iter_content(1024 * 1024):
                        self.token.raise_if_cancelled()
                        output.write(chunk)
            if file_digest(temporary, 'sha256', self.token) != digest:
                raise ValidationError('HDiffPatch 下载 SHA256 不匹配')
            os.replace(temporary, archive)
        executable = 'hpatchz.exe' if platform.system() == 'Windows' else 'hpatchz'
        target = folder / executable
        with zipfile.ZipFile(archive) as package:
            members = [n for n in package.namelist() if PurePosixPath(n).name == executable]
            if len(members) != 1:
                raise ValidationError('HDiffPatch 归档缺少唯一的 hpatchz')
            content = package.read(members[0])
        if not target.is_file() or target.read_bytes() != content:
            target.write_bytes(content)
        target.chmod(0o755)
        self.patcher = str(target)
        return self.patcher

    def _apply(self, base, delta, output):
        command = [self._hpatchz(), str(base), str(delta), str(output)]
        flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        with tempfile.TemporaryFile() as log:
            process = subprocess.Popen(command, stdout=log, stderr=log, creationflags=flags)
            try:
                started = time.monotonic()
                while process.poll() is None:
                    self.token.raise_if_cancelled()
                    if time.monotonic() - started > 1800:
                        raise TimeoutError('hpatchz 超时')
                    time.sleep(0.1)
                if process.returncode:
                    raise ValidationError(f'hpatchz 退出码 {process.returncode}')
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()

    def _patch(self, entry, part, staged, stage_root):
        relative = _relative(entry.name).removeprefix('VFS/')
        record = self._manifest(part).get(relative)
        if not record:
            return False
        if record.get('diffType') != 1:
            self.emit(f'未支持的补丁类型 {record.get("diffType")}：{entry.name}，使用完整文件')
            return False
        if record.get('size') != entry.size or str(record.get('md5', '')).lower() != entry.md5.lower():
            return False
        candidates = record.get('patch', [])
        if not isinstance(candidates, list):
            return False
        candidates = sorted((d for d in candidates if isinstance(d, dict)
                             and type(d.get('patch_size')) is int
                             and 0 < d['patch_size'] < entry.size), key=lambda d: d['patch_size'])
        for candidate in candidates:
            self.token.raise_if_cancelled()
            try:
                base_name = _relative(candidate['base_file'])
                if base_name.split('/')[0] != relative.split('/')[0]:
                    continue
                base = safe_target(self.vfs, base_name)
                base_entry = DownloadEntry(base_name, int(candidate['base_size']), candidate['base_md5'])
                if not self.matches(base, base_entry):
                    continue
                if self.patcher_failed:
                    return False
                try:
                    self._hpatchz()
                except CancelledError:
                    raise
                except (OSError, ValueError, KeyError, AkeToolError, requests.RequestException, zipfile.BadZipFile) as exc:
                    self.patcher_failed = True
                    self.emit(f'补丁工具不可用，回退完整下载：{exc}')
                    return False
                patch_path = _relative(candidate['patch'])
                delta_entry = DownloadEntry('deltas/' + patch_path, candidate['patch_size'], '', 'Patch/' + patch_path)
                self.downloader.download_entries(part.path, [delta_entry], stage_root, self.token,
                                                  self.progress, verify_md5=False)
                delta = safe_target(stage_root, delta_entry.name)
                staged.parent.mkdir(parents=True, exist_ok=True)
                staged.unlink(missing_ok=True)
                self._apply(base, delta, staged)
                if not self.matches(staged, entry):
                    raise ValidationError('补丁产物 MD5/大小不匹配')
                self.patch_bytes += candidate['patch_size']
                self.emit(f'补丁完成：{entry.name}（{candidate["patch_size"]} / {entry.size} 字节）')
                return True
            except CancelledError:
                raise
            except (OSError, ValueError, KeyError, TypeError, AttributeError, requests.RequestException, AkeToolError) as exc:
                staged.unlink(missing_ok=True)
                self.emit(f'补丁失败，尝试其他候选或完整文件：{entry.name}：{exc}')
        return False

    def prepare(self, latest, entries, entry_parts, blocks, game_roots=()):
        """Commit versions independently; never remove bases before staging succeeds."""
        self.root.mkdir(parents=True, exist_ok=True)
        lock_path = self.root / '.vfs-update.lock'
        with lock_path.open('a+b') as lock:
            # OS-owned lock is released on crashes, unlike an existence-only lockfile.
            if os.name == 'nt':
                import msvcrt
                lock.seek(0)
                lock.write(b'0')
                lock.flush()
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            try:
                # Reload after taking the lock; plans can outlive another update.
                fresh = VfsUpdater(self.root, self.client, self.downloader, self.token, self.progress,
                                   self.legacy_records)
                self.records = fresh.records
                return self._prepare(latest, entries, entry_parts, blocks, game_roots)
            finally:
                if os.name == 'nt':
                    lock.seek(0)
                    msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(lock, fcntl.LOCK_UN)

    def _prepare(self, latest, entries, entry_parts, blocks, game_roots):
        assert_no_linked_files(self.vfs, '工作 VFS')
        assert_no_linked_files(self.root / 'vfs-staging', 'VFS 暂存目录')
        target_identity = identity(latest)
        counts = dict(workspace=0, copied=0, patched=0, downloaded=0, full_bytes=0, patch_bytes=0)
        generation = hashlib.sha256(json.dumps(target_identity, sort_keys=True).encode()).hexdigest()[:24]
        for block in blocks:
            selected = [e for e in entries if e.name.startswith('VFS/' + BLOCK_IDS[block] + '/')]
            if not selected:
                continue
            mode = self.mode(block, latest)
            previous = self.records.get(block, {})
            manifest = {e.name: [e.size, e.md5.lower()] for e in selected}
            trusted = (previous.get('verified') is True and previous.get('files') == manifest
                       and all(previous.get(k) == v for k, v in target_identity.items()))
            self.emit(f'VFS {block}：工作目录优先，' + ('同大版本补丁更新（不读取游戏目录）' if mode == 'patch'
                                                     else '首次/跨大版本完整更新（禁用补丁）'))
            stage_root = self.root / 'vfs-staging' / generation / BLOCK_IDS[block]
            staged_files = []
            remote = {}
            for entry in selected:
                self.token.raise_if_cancelled()
                if not entry.md5 or entry.size <= 0:
                    raise ValidationError(f'缺少 VFS 校验信息：{entry.name}')
                target = safe_target(self.root, entry.name)
                if self.matches(target, entry, trusted):
                    counts['workspace'] += 1
                    continue
                staged = safe_target(stage_root, entry.name)
                staged_files.append((staged, target, entry))
                if self.matches(staged, entry):
                    continue
                staged.unlink(missing_ok=True)
                copied = False
                if mode == 'full':
                    for root in game_roots:
                        source = safe_target(root, entry.name)
                        if self.matches(source, entry):
                            staged.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copyfile(source, staged)
                            # Verify the copied snapshot, not just the mutable game source.
                            if self.matches(staged, entry):
                                counts['copied'] += 1
                                copied = True
                                break
                if copied:
                    continue
                staged.unlink(missing_ok=True)
                part = entry_parts[entry.name]
                if mode == 'patch':
                    # The main patch manifest can also contain initial VFS targets.
                    main = latest.hotfix.parts['main']
                    patch_parts = [main, part] if part.name != 'main' and main.version == part.version else [part]
                    if any(self._patch(entry, candidate_part, staged, stage_root) for candidate_part in patch_parts):
                        counts['patched'] += 1
                        continue
                remote.setdefault(part.name, []).append(entry)
            for part_name, missing in remote.items():
                self.downloader.download_entries(latest.hotfix.parts[part_name].path, missing, stage_root,
                                                  self.token, self.progress, verify_md5=False)
                for entry in missing:
                    if not self.matches(safe_target(stage_root, entry.name), entry):
                        safe_target(stage_root, entry.name).unlink(missing_ok=True)
                        raise ValidationError(f'完整下载校验失败：{entry.name}，请重试')
                counts['downloaded'] += len(missing)
                counts['full_bytes'] += sum(entry.size for entry in missing)
            # A failed/interrupted promotion never advertises a verified new version.
            self.records[block] = {**previous, 'verified': False, 'pending': target_identity}
            self._save()
            for staged, target, entry in sorted(staged_files, key=lambda item: item[2].name.endswith('.blc')):
                self.token.raise_if_cancelled()
                target.parent.mkdir(parents=True, exist_ok=True)
                os.replace(staged, target)
                remember_digest(target, 'md5', entry.md5.lower())
            expected = {safe_target(self.root, e.name) for e in selected}
            block_root = self.vfs / BLOCK_IDS[block]
            for path in block_root.iterdir():
                self.token.raise_if_cancelled()
                if path.suffix in ('.chk', '.blc') and path.resolve() not in expected and not is_linked_file(path):
                    path.unlink()
            self.records[block] = {**target_identity, 'verified': True, 'files': manifest}
            self._save()
            if stage_root.is_dir():
                shutil.rmtree(stage_root)
            self.emit(f'VFS {block} 已记录版本：{latest.seed.seed_version}/{latest.hotfix.res_version}')
        counts['patch_bytes'] = self.patch_bytes
        self.emit(f'VFS 准备完成：工作复用 {counts["workspace"]}，游戏复制 {counts["copied"]}，'
                  f'补丁 {counts["patched"]}，完整下载 {counts["downloaded"]}；'
                  f'成功补丁载荷 {counts["patch_bytes"]} 字节，完整文件载荷 {counts["full_bytes"]} 字节')
        return counts
