"""Unity keyframe ABI and scoped curve conversion used by JSON fallback."""
from contextlib import contextmanager
import ctypes as C
import math
import struct
from .runtime import P, I, ptr


def read_keys(array):
    if not array:
        return []
    count = C.c_size_t.from_address(array + 24).value
    if count > 1_000_000:
        raise ValueError('Invalid Unity keyframe array length')
    return sorted((struct.unpack('<ffffiff', C.string_at(array + 32 + i * 28, 28))
                   for i in range(count)), key=lambda key: key[0])


def key_array(host, keys):
    array = host.array_new(host.klass('UnityEngine.CoreModule.dll', 'UnityEngine', 'Keyframe'), len(keys))
    for index, key in enumerate(keys):
        C.memmove(array + 32 + index * 28, struct.pack('<ffffiff', *key), 28)
    return array


def evaluate(curve, time):
    keys = curve['keys']
    if not keys:
        return 0.0
    first, last = keys[0][0], keys[-1][0]
    mode = curve['pre'] if time < first else curve['post']
    if time < first or time > last:
        duration = last - first
        if duration > 0 and mode in (2, 4):
            phase = (time - first) % (duration * (2 if mode == 4 else 1))
            time = first + (phase if mode == 2 or phase <= duration else 2 * duration - phase)
        else:
            return keys[0][1] if time <= first else keys[-1][1]
    for left, right in zip(keys, keys[1:]):
        if time > right[0]:
            continue
        duration = right[0] - left[0]
        if duration <= 0:
            return right[1]
        if math.isinf(left[3]) or math.isinf(right[2]):
            return left[1]
        x = (time - left[0]) / duration
        # Weighted cubic Bezier parameter inversion, then y evaluation.
        outgoing = left[6] if left[4] & 2 else 1 / 3
        incoming = right[5] if right[4] & 1 else 1 / 3
        outgoing, incoming = max(0.0, min(1.0, outgoing)), max(0.0, min(1.0, incoming))
        low, high = 0.0, 1.0
        for _ in range(36):
            u = (low + high) / 2
            bx = 3 * (1 - u)**2 * u * outgoing + 3 * (1 - u) * u**2 * (1 - incoming) + u**3
            if bx < x:
                low = u
            else:
                high = u
        u = (low + high) / 2
        y1, y2 = left[1] + left[3] * duration * outgoing, right[1] - right[2] * duration * incoming
        return (1 - u)**3 * left[1] + 3 * (1 - u)**2 * u * y1 + 3 * (1 - u) * u**2 * y2 + u**3 * right[1]
    return keys[-1][1]


@contextmanager
def preprocess(host, root):
    visited, replacements, handles = set(), [], []

    def kind(type_):
        if not type_:
            return ''
        namespace, name = host.class_get_namespace(type_).decode(), host.class_get_name(type_).decode()
        if host.class_is_valuetype(type_):
            return ''
        if namespace == 'UnityEngine' and name == 'AnimationCurve':
            return 'curve'
        if namespace == 'System.Collections.Generic' and name.startswith('List`'):
            return 'list'
        if name.endswith('[]'):
            return 'array'
        if 'Dictionary' in name:
            return 'dictionary'
        if any(word in name for word in ('Manager', 'Loader', 'Instance', 'Service', 'Provider')) or name in ('Tables', 'JsonHelper', 'GameInstance', 'BattlePreloadTable'):
            return ''
        return 'object' if not namespace or namespace.startswith('Beyond') else ''

    def convert(value):
        try:
            converted = host.static('Common.Beyond.dll', 'Beyond', 'FAnimationCurve', 'op_Implicit', (value,))
        except (LookupError, RuntimeError):
            converted = host.new(host.klass('Common.Beyond.dll', 'Beyond', 'FAnimationCurve'), (value,))
        if not converted:
            raise RuntimeError('FAnimationCurve conversion returned null')
        handle = host.gchandle_new(converted, True)
        if not handle:
            raise RuntimeError('Cannot retain FAnimationCurve')
        handles.append(handle)
        return converted

    def slot(owner, address, depth):
        value = ptr(address)
        if not value:
            return
        tag = kind(host.object_get_class(value))
        if tag == 'curve':
            if len(replacements) >= 100000:
                raise RuntimeError('Animation curve replacement limit exceeded')
            converted = convert(value)
            host.gc_wbarrier_set_field(owner, address, converted)
            replacements.append((owner, address, value))
        elif tag:
            walk(value, depth + 1)

    def array_items(array, count, depth):
        type_ = host.object_get_class(array)
        element = host.class_get_element_class(type_)
        if element and host.class_is_valuetype(element):
            return
        for index in range(min(count, host.array_length(array), 1_000_000)):
            slot(array, array + 32 + index * 8, depth)

    def walk(value, depth):
        if not value or value in visited or depth > 64:
            return
        if len(visited) >= 250000:
            raise RuntimeError('Animation curve traversal limit exceeded')
        visited.add(value)
        type_ = host.object_get_class(value)
        tag = kind(type_)
        if tag == 'list':
            array = ptr(value + host.offset(type_, '_items'))
            count = I.from_address(value + host.offset(type_, '_size')).value
            if array:
                array_items(array, max(0, count), depth)
        elif tag == 'array':
            array_items(value, host.array_length(value), depth)
        elif tag == 'dictionary':
            try:
                values = ptr(value + host.offset(type_, '_valueData'))
                if values:
                    walk(values, depth + 1)
            except LookupError:
                pass
            try:
                entries = ptr(value + host.offset(type_, '_entries'))
                count = I.from_address(value + host.offset(type_, '_count')).value
            except LookupError:
                return
            if not entries:
                return
            entry_type = host.class_get_element_class(host.object_get_class(entries))
            alignment = I()
            size = host.class_value_size(entry_type, C.byref(alignment))
            hash_field, value_field = host.field(entry_type, 'hashCode'), host.field(entry_type, 'value')
            hash_offset, value_offset = host.raw_offset(entry_type, hash_field), host.raw_offset(entry_type, value_field)
            declared = host.class_from_type(host.field_get_type(value_field))
            if host.class_is_valuetype(declared):
                return
            if not 0 < size <= 4096 or not 0 <= value_offset <= size - 8 or not 0 <= hash_offset <= size - 4:
                raise ValueError('Invalid dictionary entry layout')
            for index in range(min(max(count, 0), host.array_length(entries), 1_000_000)):
                address = entries + 32 + index * size
                if I.from_address(address + hash_offset).value >= 0:
                    slot(entries, address + value_offset, depth)
        elif tag == 'object':
            for field in host.iterate(host.class_get_fields, type_):
                if host.field_get_flags(field) & 0x10:
                    continue
                off = host.field_get_offset(field)
                if not 16 <= off <= 1024 * 1024:
                    continue
                declared = host.class_from_type(host.field_get_type(field))
                if not declared or host.class_is_valuetype(declared):
                    continue
                name = host.field_get_name(field).decode()
                if any(word in name for word in ('Manager', 'Loader', 'Instance', 'Service', 'Provider')):
                    continue
                slot(value, value + off, depth)
    try:
        if kind(host.object_get_class(root)) == 'curve':
            root = convert(root)
        else:
            walk(root, 0)
        yield root
    finally:
        for owner, address, original in reversed(replacements):
            host.gc_wbarrier_set_field(owner, address, original)
        for handle in reversed(handles):
            host.gchandle_free(handle)
