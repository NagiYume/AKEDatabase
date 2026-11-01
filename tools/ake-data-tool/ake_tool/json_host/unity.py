"""Headless Unity icalls and PE64 internal-call table discovery."""
import binascii
import ctypes as C
import json
import math
from pathlib import Path
import re
import struct
import sys

from .runtime import P, I, B, ptr, put_ptr


class PE:
    def __init__(self, data):
        self.data = data
        if data[:2] != b'MZ':
            raise ValueError('Not a PE file')
        pe = self.u32(0x3c)
        if data[pe:pe + 4] != b'PE\0\0' or self.u16(pe + 24) != 0x20b:
            raise ValueError('Expected PE32+ image')
        self.base = self.u64(pe + 48)
        self.sections = []
        start = pe + 24 + self.u16(pe + 20)
        for index in range(self.u16(pe + 6)):
            off = start + index * 40
            name = data[off:off + 8].rstrip(b'\0').decode('ascii')
            vs, va, size, raw = struct.unpack_from('<IIII', data, off + 8)
            self.sections.append((name, va, vs, raw, size))

    def u16(self, off):
        return struct.unpack_from('<H', self.data, off)[0]

    def u32(self, off):
        return struct.unpack_from('<I', self.data, off)[0]

    def i32(self, off):
        return struct.unpack_from('<i', self.data, off)[0]

    def u64(self, off):
        return struct.unpack_from('<Q', self.data, off)[0]

    def va(self, off):
        for _, va, _, raw, size in self.sections:
            if raw <= off < raw + size:
                return self.base + va + off - raw
        raise ValueError('File offset outside sections')

    def offset(self, address):
        rva = address - self.base
        for _, va, vs, raw, size in self.sections:
            if va <= rva < va + max(vs, size):
                off = raw + rva - va
                if 0 <= off < len(self.data):
                    return off
        return None

    def text_address(self, address):
        return any(name == '.text' and va <= address - self.base < va + vs
                   for name, va, vs, _, _ in self.sections)

    def text(self, address):
        off = self.offset(address)
        if off is None:
            return ''
        raw = self.data[off:off + 240].split(b'\0', 1)[0]
        if not raw or any(c < 32 or c > 126 for c in raw):
            return ''
        return raw.decode('ascii')

    def name(self, address):
        text = self.text(address)
        return text if '::' in text and text.startswith(('UnityEngine', 'UnityEngineInternal')) else ''

    def entries(self, names, functions, count):
        if min(names, functions) < 0 or max(names, functions) + count * 8 > len(self.data):
            return []
        result = []
        for index in range(count):
            name, address = self.name(self.u64(names + index * 8)), self.u64(functions + index * 8)
            if name and self.text_address(address):
                result.append((name, address - self.base))
        return result


def scan_internal_calls(path):
    pe = PE(Path(path).read_bytes())
    data = pe.data
    required = ('UnityEngine.AnimationCurve::Internal_Create', 'UnityEngine.AnimationCurve::Evaluate',
                'UnityEngine.AnimationCurve::GetKeys')
    result = {}
    # Prefer explicit parallel-table addresses from generated registration loops.
    # This preserves association when non-UnityEngine names interrupt a table.
    for name, _, _, raw, size in pe.sections:
        if name != '.text':
            continue
        for match in re.finditer(b'\x48\x8d\x35', data[raw:raw + size]):
            lea = raw + match.start()
            end = min(raw + size, lea + 0x90)
            functions = data.find(b'\x48\x8b\x94\x33', lea + 7, end)
            names = data.find(b'\x48\x8b\x8c\x33', lea + 7, end)
            if functions < 0 or names < functions or names - functions > 32:
                continue
            call = data.find(b'\xe8', names + 8, min(end, names + 32))
            limit = data.find(b'\x81\xff', call + 5, end) if call >= 0 else -1
            if limit < 0:
                continue
            base = pe.va(lea) + 7 + pe.i32(lea + 3)
            n, f, count = pe.offset(base + pe.i32(names + 4)), pe.offset(base + pe.i32(functions + 4)), pe.u32(limit + 2)
            if n is None or f is None or not 20 <= count <= 10000:
                continue
            if max(n, f) + count * 8 > len(data):
                continue
            score = sum(bool(pe.name(pe.u64(n + i * 8))) + pe.text_address(pe.u64(f + i * 8))
                        for i in range(min(count, 64)))
            entries = pe.entries(n, f, count)
            if score > 80 or len(entries) >= count * 0.8:
                for entry_name, rva in entries:
                    if entry_name in result and result[entry_name] != rva:
                        raise ValueError(f'Conflicting Unity icall addresses: {entry_name}')
                    result[entry_name] = rva
    if all(name in result for name in required):
        return sorted(result.items())
    # Older builds also expose a single contiguous name-pointer table. Accept
    # only a complete parallel function run, with unambiguous bounds, on either
    # side of it. Sparse pointer scoring can otherwise select a shifted table.
    anchor = data.find(required[0].encode() + b'\0')
    if anchor < 0:
        raise ValueError('Unity AnimationCurve icall anchor not found')
    needle = struct.pack('<Q', pe.va(anchor))
    off = -1
    for name, _, _, raw, size in pe.sections:
        if name in ('.rdata', '.data'):
            off = data.find(needle, raw, raw + size)
            if off >= 0:
                break
    if off < 0:
        raise ValueError('Unity icall anchor pointer not found')
    start, end = off, off
    while start >= 8 and pe.name(pe.u64(start - 8)):
        start -= 8
    while end + 8 <= len(data) and pe.name(pe.u64(end)):
        end += 8
    count = (end - start) // 8
    begin = max(0, start - 0x40000) & ~7
    stop = min(len(data) - count * 8, start + 0x40000)
    candidates = []
    for candidate in range(begin, stop + 1, 8):
        if not pe.text_address(pe.u64(candidate)):
            continue
        if candidate >= 8 and pe.text_address(pe.u64(candidate - 8)):
            continue
        if candidate + count * 8 + 8 <= len(data) and pe.text_address(pe.u64(candidate + count * 8)):
            continue
        entries = pe.entries(start, candidate, count)
        if len(entries) == count:
            candidates.append(dict(entries))
    if len(candidates) != 1 or not all(name in candidates[0] for name in required):
        raise ValueError('Unity icall table association could not be validated')
    candidates[0].update(result)
    return sorted(candidates[0].items())


def register_stubs(host):
    from .curves import read_keys, key_array, evaluate
    F, L = C.c_float, C.c_int64
    noop = lambda *args: None

    def malloc(size, alignment, *unused):
        if size <= 0:
            return 0
        alignment = max(1, alignment)
        if alignment & (alignment - 1):
            raise ValueError('Unity allocation alignment is not a power of two')
        buffer = C.create_string_buffer(size + alignment - 1)
        host.allocations.append(buffer)
        return (C.addressof(buffer) + alignment - 1) & -alignment

    def pin(target, slot, offset):
        handle = host.gchandle_new(target, True) if target else 0
        C.c_uint64.from_address(slot).value = handle
        return target + offset if target else 0

    def create(keys):
        handle = host.next_curve
        host.next_curve += 1
        host.curves[handle] = {'keys': read_keys(keys), 'pre': 8, 'post': 8}
        return handle

    def curve(self):
        return host.curves.setdefault(ptr(self + 16) if self else 0, {'keys': [], 'pre': 8, 'post': 8})

    def add_key(self, address):
        key = struct.unpack('<ffffiff', C.string_at(address, 28))
        keys = curve(self)['keys']
        if any(item[0] == key[0] for item in keys):
            return -1
        keys.append(key)
        keys.sort(key=lambda item: item[0])
        return keys.index(key)

    def path_string(name):
        if name not in host.path_strings:
            host.path_strings[name] = host.retain(host.string(str(host.paths[name])))
        return host.path_strings[name]

    def create_scriptable(value):
        if value:
            type_ = host.klass('UnityEngine.CoreModule.dll', 'UnityEngine', 'Object')
            put_ptr(value + host.offset(type_, 'm_CachedPtr'), value)

    def hash_string(value):
        # Unity hashes each UTF-16 code unit encoded separately, including surrogates.
        text = (host.text(value) or '').encode('utf-16-le', 'surrogatepass')
        encoded = b''.join(chr(struct.unpack_from('<H', text, i)[0]).encode('utf-8', 'surrogatepass')
                           for i in range(0, len(text), 2))
        return I(binascii.crc32(encoded)).value

    callbacks = {
        'physicalMemoryMbStub': (I, (), lambda: 16384),
        'animationCurveCreateStub': (P, (P,), create),
        'animationCurveDestroyStub': (None, (P,), lambda handle: host.curves.pop(handle, None) and None),
        'animationCurveSetPreWrapModeStub': (None, (P, I), lambda self, mode: curve(self).__setitem__('pre', mode)),
        'animationCurveSetPostWrapModeStub': (None, (P, I), lambda self, mode: curve(self).__setitem__('post', mode)),
        'animationCurveGetPreWrapModeStub': (I, (P,), lambda self: curve(self)['pre']),
        'animationCurveGetPostWrapModeStub': (I, (P,), lambda self: curve(self)['post']),
        'animationCurveLengthStub': (I, (P,), lambda self: len(curve(self)['keys'])),
        'animationCurveEvaluateStub': (F, (P, F), lambda self, time: evaluate(curve(self), time)),
        'animationCurveSetKeysStub': (None, (P, P), lambda self, keys: curve(self).__setitem__('keys', read_keys(keys))),
        'animationCurveGetKeysStub': (P, (P,), lambda self: key_array(host, curve(self)['keys'])),
        'animationCurveAddKeyStub': (I, (P, P), add_key),
        'quaternionToEulerStub': (None, (P, P), lambda self, out: C.memset(out, 0, 12) and None),
        'animatorStringToHashStub': (I, (P,), hash_string),
        'randomRangeFloatStub': (F, (F, F), lambda low, high: low),
        'debugLogExceptionStub': (None, (P, P), noop),
        'debugLogStub': (None, (I, I, P, P), lambda level, options, text, context:
                         print(f'[Unity {level}] {host.text(text)}', file=sys.stderr)),
        'unsafeMallocStub': (P, (L, I, I), malloc),
        'unsafeMallocTrackedStub': (P, (L, I, I, I), malloc),
        'unsafeFreeStub': (None, (P, I), noop),
        'unsafeMemCpyStub': (None, (P, P, L), lambda dst, src, size: C.memmove(dst, src, size) and None if size > 0 else None),
        'unsafeMemSetStub': (None, (P, C.c_byte, L), lambda dst, value, size: C.memset(dst, value, size) and None if size > 0 else None),
        'unsafePinSystemObjectStub': (P, (P, P), lambda target, slot: pin(target, slot, 0)),
        'unsafePinSystemArrayStub': (P, (P, P), lambda target, slot: pin(target, slot, 32)),
        'unsafeReleaseGcObjectStub': (None, (L,), lambda handle: host.gchandle_free(handle) if handle else None),
        'profilerCreateMarkerStub': (P, (P, C.c_uint16, I, I), lambda *args: 0),
        'profilerSampleStub': (None, (P,), noop),
        'unityFrameCountStub': (I, (), lambda: 0),
        'applicationDataPathStub': (P, (), lambda: path_string('dataPath')),
        'applicationStreamingAssetsPathStub': (P, (), lambda: path_string('streamingAssetsPath')),
        'applicationPersistentDataPathStub': (P, (), lambda: path_string('persistentDataPath')),
        'applicationTemporaryCachePathStub': (P, (), lambda: path_string('temporaryCachePath')),
        'scriptableObjectCreateStub': (None, (P,), create_scriptable),
        'playerPrefsHasKeyStub': (B, (P,), lambda key: False),
        'jobCompilerEnabledStub': (None, (B,), noop),
        'burstCompileAsyncStub': (I, (P, P), lambda *args: 0),
        'burstGetCompiledStub': (P, (I,), lambda *args: 0),
    }
    registry = json.loads(Path(__file__).with_name('icalls.json').read_text())
    for key, names in registry.items():
        result, arguments, implementation = callbacks[key]
        callback = host.callback(result, arguments, implementation)
        for name in names:
            host.add_internal_call(host.native_text(name), C.cast(callback, P))
