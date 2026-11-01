"""JsonData IL2CPP worker adapted from the supplied beyond-sdk-py implementation.
Run through ake_tool.json_unpacker with explicit input, output and runtime paths.
Uses the tool cryptography dependency; no JVM, OpenSSL command or downloads.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import ctypes
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
import threading
import traceback

from .schemas import DATASETS, route
from .vfs import Vfs

RESULT_PREFIX = 'PERLICA_PYTHON_JSON_RESULT '
_HOST_LIFETIME = []
REQUIRED_RUNTIME = ('GameAssembly.dll', 'UnityPlayer.dll', 'baselib.dll', 'Endfield.exe',
                    'Endfield_Data/il2cpp_data/Metadata/global-metadata.dat',
                    'Endfield_Data/il2cpp_data/Resources/mscorlib.dll-resources.dat',
                    'Endfield_Data/il2cpp_data/Resources/System.Data.dll-resources.dat')


def nonnegative(value):
    result = int(value)
    if result < 0:
        raise argparse.ArgumentTypeError('must be non-negative')
    return result


def positive(value):
    result = nonnegative(value)
    if result == 0:
        raise argparse.ArgumentTypeError('must be positive')
    return result


def make_parser():
    project = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('-i', '--input', '--vfs-root', dest='vfs_root', type=Path, default=project / 'build/vfs')
    parser.add_argument('-o', '--output', type=Path, default=project / 'build/json-export')
    parser.add_argument('--runtime-root', type=Path, help='Complete local runtime folder; defaults to <input>/il2cpp-host-runtime')
    parser.add_argument('--type', action='append', default=[], help='Dataset name; repeatable')
    parser.add_argument('--limit-per-type', type=nonnegative)
    parser.add_argument('--parallelism', type=positive, default=1, help='Isolated Python worker processes (default: 1)')
    parser.add_argument('--include-lip-sync', action='store_true')
    parser.add_argument('--arg', action='append', default=[], help='Game argument; use --arg=--flag')
    parser.add_argument('--key-base64', help='Override VFS key; normally read directly from GameAssembly.dll')
    parser.add_argument('--list-types', action='store_true')
    parser.add_argument('--worker-index', type=nonnegative, help=argparse.SUPPRESS)
    parser.add_argument('--worker-count', type=positive, default=1, help=argparse.SUPPRESS)
    return parser


def selected_datasets(args):
    selected = set()
    for name in args.type:
        match = next((d for d in DATASETS if d.casefold() == name.casefold()), None)
        if match is None:
            raise ValueError(f'Unknown dataset: {name}; use --list-types')
        selected.add(match)
    return selected or (set(DATASETS) if args.include_lip_sync else set(DATASETS) - {'LipSync'})


def select_entries(vfs, datasets, limit):
    counts, result = {}, []
    for entry in vfs.block('JsonData'):
        schema = route(entry.name)
        if schema is None or schema.dataset not in datasets:
            continue
        if limit is not None and counts.get(schema.dataset, 0) >= limit:
            continue
        counts[schema.dataset] = counts.get(schema.dataset, 0) + 1
        result.append((entry, schema))
    return result


def output_path(root, name):
    parts = name.replace('\\', '/').split('/')
    if len(parts) < 3 or [p.casefold() for p in parts[:2]] != ['data', 'json']:
        raise ValueError(f'Not a JsonData path: {name}')
    # Reject Windows alternate streams, drive-relative paths, traversal, and
    # symlink escapes even when a test runs on macOS/Linux.
    if any(p in ('', '.', '..') or ':' in p or '\x00' in p for p in parts):
        raise ValueError(f'Unsafe JsonData path: {name}')
    root = root.resolve()
    target = root.joinpath('data', 'Json', *parts[2:]).resolve()
    if root not in target.parents:
        raise ValueError(f'Output escapes root: {name}')
    return target


def atomic_write(target, data):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.' + target.name, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def resolve_runtime(args):
    root = (args.runtime_root or args.vfs_root / 'il2cpp-host-runtime').expanduser().resolve()
    missing = [name for name in REQUIRED_RUNTIME if not (root / name).is_file() or (root / name).stat().st_size == 0]
    if missing:
        raise FileNotFoundError(f'Incomplete runtime: {root}; missing: {", ".join(missing)}. '
                                'Pass --runtime-root pointing to the complete game/runtime folder.')
    return root


def worker(args):
    from .runtime import Host
    host = Host(resolve_runtime(args), args.output.resolve() / '.runtime' / str(args.worker_index))
    _HOST_LIFETIME.append(host)  # Native callbacks must survive until os._exit.
    print('Initializing GameAssembly.dll in Python', flush=True)
    host.initialize(args.arg)
    key = base64.b64decode(args.key_base64, validate=True) if args.key_base64 else host.common_key()
    if len(key) != 32:
        raise ValueError('VFS key must contain 32 bytes')
    vfs = Vfs(args.vfs_root.expanduser().resolve(), key)
    unsupported = []
    auxiliary = []
    for entry in vfs.block('JsonData'):
        if route(entry.name) is None:
            if entry.name.casefold().startswith('data/json/stringpool/'):
                auxiliary.append(entry.name)
            else:
                unsupported.append(entry.name)
    for name in unsupported:
        print(f'UNSUPPORTED {name}', flush=True)
    all_entries = select_entries(vfs, selected_datasets(args), args.limit_per_type)
    entries = all_entries[args.worker_index::args.worker_count]
    output = args.output.expanduser().resolve()
    seen = set()
    for entry, _ in all_entries:
        target = str(output_path(output, entry.name)).casefold()
        if target in seen:
            raise ValueError(f'Output path collision: {entry.name}')
        seen.add(target)
    pending = [(entry, schema) for entry, schema in entries
               if not (schema.preserve and output_path(output, entry.name).is_file())]
    if any(schema.encoding != 'raw' for _, schema in pending):
        main = vfs.read('ExtendData', 'Data/ExtendData/Main/StringPathHash.bin', optional=True)
        initial = vfs.read('InitialExtendData', 'Data/ExtendData/Initial/InitStringPathHash.bin', optional=True)
        host.initialize_hashes(main, initial)
        if any(schema.dataset == 'LevelScriptData' for _, schema in pending):
            host.initialize_global_const(vfs.read('Table', 'Data/TableCfg/GlobalConst.bytes'))
        if any(schema.encoding == 'memorypack' for _, schema in pending):
            host.init_formatters()
        host.klass('UnityEngine.CoreModule.dll', 'UnityEngine', 'Keyframe')
        host.json_settings()
    counts = {}
    failed = []
    with tempfile.TemporaryDirectory(prefix='perlica-python-json-') as directory:
        if any(schema.encoding == 'memorypack' for _, schema in pending):
            pool = Path(directory) / 'string-pool'
            print('Staging MemoryPack string pool', flush=True)
            vfs.stage_string_pool(pool)
            host.initialize_pool(pool)
        for entry, schema in entries:
            count = counts.setdefault(schema.dataset, {'written': 0, 'preserved': 0, 'failure': 0})
            target = output_path(output, entry.name)
            error_file = output / '.perlica/endfield-json-errors' / target.relative_to(output)
            error_file = error_file.with_name(error_file.name + '.error.txt')
            if schema.preserve and target.is_file():
                count['preserved'] += 1
                error_file.unlink(missing_ok=True)
                continue
            # Existing host retries managed failures once before recording them.
            for attempt in range(2):
                try:
                    data = (vfs.read('JsonData', schema.source) if schema.source else entry.read(key))
                    if schema.encoding == 'raw':
                        json.loads(data.decode('utf-8-sig'))
                        result = data
                    else:
                        with host.deserialize(schema, data) as value:
                            if schema.post:
                                host.call(value, schema.post)
                            result = host.serialize(value).encode('utf-8')
                        json.loads(result.decode('utf-8'))
                    atomic_write(target, result)
                    error_file.unlink(missing_ok=True)
                    count['written'] += 1
                    print(f'OK {entry.name}', flush=True)
                    break
                except Exception:
                    if attempt == 0:
                        continue
                    count['failure'] += 1
                    failed.append(entry.name)
                    atomic_write(error_file, traceback.format_exc().encode('utf-8'))
                    print(f'FAILED {entry.name}: see {error_file}', file=sys.stderr, flush=True)
    report = {'datasets': counts, 'failed': failed, 'selected': len(entries),
              'unsupported': unsupported, 'auxiliary': auxiliary,
              'gameAssembly': str(host.root / 'GameAssembly.dll')}
    atomic_write(output / f'export-report-{args.worker_index}.json',
                 json.dumps(report, ensure_ascii=False, indent=2).encode('utf-8'))
    # Do not unload Unity or run Python/native finalizers against a live IL2CPP
    # runtime. The parent owns this process and verifies its result marker.
    print(RESULT_PREFIX + json.dumps(report, ensure_ascii=True), flush=True)
    return 1 if failed else 0


def run_worker_with_stack(args):
    # Match the Kotlin host's 16 MiB native stack. The Windows Python main
    # thread has a smaller executable-defined stack and cannot be resized.
    result, errors = [], []
    def run():
        try:
            result.append(worker(args))
        except BaseException as error:
            errors.append(error)
    previous = threading.stack_size(16 * 1024 * 1024)
    try:
        thread = threading.Thread(target=run, name='il2cpp-host')
        thread.start()
    finally:
        threading.stack_size(previous)
    thread.join()
    if errors:
        raise errors[0]
    return result[0]


def run_workers(args, argv):
    def run(index):
        command = [sys.executable, '-u', '-m', 'ake_tool.json_host.export_json', *argv,
                   '--worker-index', str(index), '--worker-count', str(args.parallelism)]
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   text=True, encoding='utf-8', errors='replace',
                                   env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
        report = None
        try:
            for line in process.stdout:
                print(f'[{index + 1}/{args.parallelism}] {line}', end='', flush=True)
                if line.startswith(RESULT_PREFIX):
                    report = json.loads(line[len(RESULT_PREFIX):])
            code = process.wait()
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            process.stdout.close()
        if code not in (0, 1) or report is None:
            raise RuntimeError(f'Python IL2CPP worker {index + 1} exited with {code}; no complete export report')
        if bool(code) != bool(report['failed']):
            raise RuntimeError(f'Worker {index + 1} exit/report mismatch')
        return report

    with ThreadPoolExecutor(max_workers=args.parallelism) as executor:
        reports = list(executor.map(run, range(args.parallelism)))
    totals = {'written': 0, 'preserved': 0, 'failure': 0}
    for report in reports:
        for counts in report['datasets'].values():
            for name in totals:
                totals[name] += counts[name]
    print(f'JsonData: written={totals["written"]} preserved={totals["preserved"]} failure={totals["failure"]}')
    if not sum(report['selected'] for report in reports):
        print('No matching JsonData files', file=sys.stderr)
        return 1
    return 1 if totals['failure'] else 0


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    parser = make_parser()
    args = parser.parse_args(argv)
    if args.list_types:
        print('\n'.join(DATASETS))
        return 0
    selected_datasets(args)
    if platform.system() != 'Windows' or ctypes.sizeof(ctypes.c_void_p) != 8:
        parser.error('DLL export requires Windows x64 with 64-bit Python; --list-types/--help work on other platforms')
    if not args.vfs_root.expanduser().is_dir():
        parser.error('VFS input directory does not exist')
    resolve_runtime(args)
    if args.worker_index is not None:
        if args.worker_index >= args.worker_count:
            parser.error('Invalid worker shard')
        return run_worker_with_stack(args)
    return run_workers(args, argv)


if __name__ == '__main__':
    code = 1
    try:
        code = main()
    except KeyboardInterrupt:
        code = 130
    except Exception:
        traceback.print_exc()
    if '--worker-index' in sys.argv:
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(code)
    sys.exit(code)
