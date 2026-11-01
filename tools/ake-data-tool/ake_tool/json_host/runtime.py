"""Windows x64 IL2CPP ABI, managed invocation and JsonData export primitives.

Ported from Perlica's Il2CppApi.kt. All managed work runs in GameAssembly.dll;
Python supplies native ABI bindings and the headless Unity callbacks.
"""
from contextlib import contextmanager
import ctypes as C
from dataclasses import dataclass
import json
import os
from pathlib import Path
import sys
import traceback

P = C.c_void_p
I = C.c_int32
U = C.c_uint32
Q = C.c_uint64
B = C.c_bool
S = C.c_char_p


class ManagedError(RuntimeError):
    pass


@dataclass
class ByRef:
    address: int


@dataclass
class Span:
    data: bytes


class ByteSpan(C.Structure):
    _fields_ = [('pointer', P), ('length', I), ('padding', I)]


def ptr(address):
    return P.from_address(address).value or 0


def put_ptr(address, value):
    P.from_address(address).value = value


# il2cpp runtime_invoke takes object pointers for references, storage addresses
# for scalar/value arguments and the caller's slot address for by-ref values.
def argument_storage(argument, keepalive):
    if isinstance(argument, ByRef):
        return argument.address
    if isinstance(argument, Span):
        data = C.create_string_buffer(argument.data, max(1, len(argument.data)))
        span = ByteSpan(C.addressof(data), len(argument.data), 0)
        keepalive.extend((data, span))
        return C.addressof(span)
    if isinstance(argument, C._SimpleCData) or isinstance(argument, C.Structure):
        keepalive.append(argument)
        return C.addressof(argument)
    if argument is None or isinstance(argument, int):
        return argument or 0
    raise TypeError(f'Unsupported managed argument: {argument!r}')


class Host:
    def __init__(self, root, persistent_root=None):
        if os.name != 'nt' or C.sizeof(P) != 8:
            raise OSError('GameAssembly.dll requires Windows x64 and a 64-bit Python')
        self.root = Path(root).resolve()
        self.persistent_root = Path(persistent_root) if persistent_root else self.root / 'il2cpp-host-persistent-python'
        self.keepalive = []
        self.handles = []
        self.callbacks = []
        self.callback_errors = []
        self.classes = {}
        self.methods = {}
        self.initialized = set()
        self.images = {}
        self.settings = 0
        self.formatters_ready = False
        self.generic_deserializers = {}
        self.curves = {}
        self.next_curve = 0x100000
        self.allocations = []
        self.path_strings = {}
        self.dll_path = os.add_dll_directory(str(self.root))
        self.dll = C.CDLL(str(self.root / 'GameAssembly.dll'))
        self.unity = None
        self._bind()

    def _bind(self):
        signatures = {
            'init': (P, S), 'set_config_dir': (None, S), 'set_data_dir': (None, S),
            'set_config': (None, S), 'set_commandline_arguments': (None, I, P, S),
            'runtime_unhandled_exception_policy_set': (None, I),
            'set_enable_class_memory_profiler': (None, B), 'set_persistent_path': (None, S),
            'debugger_set_agent_options': (None, S), 'add_internal_call': (None, S, P),
            'domain_get': (P,), 'thread_attach': (P, P), 'thread_detach': (None, P),
            'domain_get_assemblies': (P, P, P), 'assembly_get_image': (P, P),
            'image_get_name': (S, P), 'image_get_class_count': (C.c_size_t, P),
            'image_get_class': (P, P, C.c_size_t), 'class_from_name': (P, P, S, S),
            'class_get_name': (S, P), 'class_get_namespace': (S, P),
            'class_get_parent': (P, P), 'class_get_declaring_type': (P, P),
            'class_get_nested_types': (P, P, P), 'class_get_type': (P, P),
            'class_from_type': (P, P), 'class_get_element_class': (P, P),
            'class_is_valuetype': (B, P), 'class_value_size': (I, P, P),
            'runtime_class_init': (None, P), 'class_get_method_from_name': (P, P, S, I),
            'class_get_methods': (P, P, P), 'method_get_name': (S, P),
            'method_get_param_count': (U, P), 'method_get_param': (P, P, U),
            'method_get_object': (P, P, P), 'method_get_from_reflection': (P, P),
            'type_get_name': (P, P), 'type_get_object': (P, P), 'free': (None, P),
            'class_get_fields': (P, P, P), 'class_get_field_from_name': (P, P, S),
            'field_get_name': (S, P), 'field_get_flags': (I, P),
            'field_get_type': (P, P), 'field_get_offset': (C.c_size_t, P),
            'field_static_get_value': (None, P, P), 'field_static_set_value': (None, P, P),
            'object_new': (P, P), 'object_get_class': (P, P), 'object_unbox': (P, P),
            'array_new': (P, P, C.c_size_t), 'array_length': (C.c_size_t, P),
            'string_new': (P, S), 'string_length': (I, P), 'string_chars': (P, P),
            'gchandle_new': (U, P, B), 'gchandle_free': (None, U),
            'gc_wbarrier_set_field': (None, P, P, P),
            'runtime_invoke': (P, P, P, P, P),
            'format_exception': (None, P, P, I), 'format_stack_trace': (None, P, P, I),
        }
        for name, (result, *arguments) in signatures.items():
            try:
                function = getattr(self.dll, 'il2cpp_' + name)
            except AttributeError as error:
                raise RuntimeError(f'Missing bootstrap export: il2cpp_{name}') from error
            function.restype, function.argtypes = result, arguments
            setattr(self, name, function)

    def native_text(self, text):
        data = text.encode('utf-8')
        self.keepalive.append(data)
        return data

    def initialize(self, arguments=()):
        data = self.root / 'Endfield_Data/il2cpp_data'
        self.persistent = self.persistent_root
        self.persistent.mkdir(parents=True, exist_ok=True)
        self.paths = {'dataPath': self.root / 'Endfield_Data',
                      'streamingAssetsPath': self.root / 'Endfield_Data/StreamingAssets',
                      'persistentDataPath': self.persistent,
                      'temporaryCachePath': self.persistent / '.perlica/temporary-cache'}
        argv = [self.native_text(a) for a in (arguments or [str(self.root / 'Endfield.exe')])]
        slots = (S * len(argv))(*argv)
        self.keepalive.append(slots)
        self.runtime_unhandled_exception_policy_set(0)
        self.set_commandline_arguments(len(argv), C.cast(slots, P), None)
        self.set_enable_class_memory_profiler(False)
        self.set_persistent_path(self.native_text(str(self.persistent)))
        self.set_config_dir(self.native_text(str(data / 'etc')))
        self.set_data_dir(self.native_text(str(data)))
        self.debugger_set_agent_options(b'')
        self.domain = self.init(b'IL2CPP Root Domain')
        if not self.domain:
            raise RuntimeError('il2cpp_init returned null')
        self.set_config(b'unused_application_configuration')
        self.thread = self.thread_attach(self.domain)
        if not self.thread:
            raise RuntimeError('il2cpp_thread_attach returned null')
        from .unity import register_stubs, scan_internal_calls
        register_stubs(self)
        # Match the Kotlin host: register headless fallbacks, then real Unity icalls.
        try:
            entries = scan_internal_calls(self.root / 'UnityPlayer.dll')
        except (OSError, ValueError, IndexError) as error:
            print(f'UnityPlayer icall scan unavailable; using headless callbacks: {error}', file=sys.stderr)
        else:
            self.unity = C.CDLL(str(self.root / 'UnityPlayer.dll'))
            for name, rva in entries:
                self.add_internal_call(self.native_text(name), self.unity._handle + rva)
            print(f'Registered {len(entries)} UnityPlayer internal calls', flush=True)

    def all_images(self):
        if not self.images:
            count = C.c_size_t()
            assemblies = self.domain_get_assemblies(self.domain_get(), C.byref(count))
            for index in range(count.value):
                image = self.assembly_get_image(ptr(assemblies + index * 8))
                self.images[self.image_get_name(image).decode()] = image
        return self.images

    def klass(self, assembly, namespace, name):
        key = assembly, namespace, name
        if key in self.classes:
            return self.classes[key]
        image = self.all_images().get(assembly)
        if not image:
            raise LookupError(f'Assembly not found: {assembly}')
        type_ = self.class_from_name(image, namespace.encode(), name.encode())
        if not type_ and '/' in name:
            outer, *nested = name.split('/')
            type_ = self.klass(assembly, namespace, outer)
            for child in nested:
                type_ = next((t for t in self.iterate(self.class_get_nested_types, type_)
                              if self.class_get_name(t).decode() == child), 0)
                if not type_:
                    break
        if not type_:
            candidates = []
            for index in range(self.image_get_class_count(image)):
                candidate = self.image_get_class(image, index)
                if candidate and self.class_get_name(candidate).decode() == name:
                    candidates.append(candidate)
            matches = [c for c in candidates if self.class_get_namespace(c).decode() == namespace]
            if not matches:
                matches = [c for c in candidates if self.class_get_declaring_type(c) and
                           self.class_get_namespace(self.class_get_declaring_type(c)).decode() == namespace]
            if len(matches) == 1:
                type_ = matches[0]
            elif matches:
                raise LookupError(f'Ambiguous type: {assembly}:{namespace}.{name}')
        if not type_:
            raise LookupError(f'Type not found: {assembly}:{namespace}.{name}')
        self.classes[key] = type_
        return type_

    def find_any_class(self, namespace, name):
        preferred = ['MemoryPack.dll', 'MemoryPack.Beyond.dll', 'Common.Beyond.dll']
        for assembly in dict.fromkeys(preferred + list(self.all_images())):
            try:
                return self.klass(assembly, namespace, name)
            except LookupError:
                pass
        raise LookupError(f'Type not found in any assembly: {namespace}.{name}')

    def iterate(self, function, owner):
        iterator = P()
        while True:
            item = function(owner, C.byref(iterator))
            if not item:
                break
            yield item

    def method(self, type_, name, count, parameter_types=None, required=True):
        key = type_, name, count, tuple(parameter_types) if parameter_types is not None else None
        if key not in self.methods:
            current, result = type_, 0
            while current and not result:
                if parameter_types is None:
                    result = self.class_get_method_from_name(current, name.encode(), count)
                else:
                    for method in self.iterate(self.class_get_methods, current):
                        if self.method_get_name(method).decode() != name or self.method_get_param_count(method) != count:
                            continue
                        types = []
                        for index in range(count):
                            text = self.type_get_name(self.method_get_param(method, index))
                            try:
                                types.append(C.string_at(text).decode())
                            finally:
                                self.free(text)
                        if types == list(parameter_types):
                            result = method
                            break
                current = self.class_get_parent(current)
            self.methods[key] = result
        result = self.methods[key]
        if not result and required:
            raise LookupError(f'Method not found: {self.type_name(type_)}.{name}/{count} {parameter_types or ""}')
        return result

    def type_name(self, type_):
        return (self.class_get_namespace(type_).decode() + '.' + self.class_get_name(type_).decode()).strip('.')

    def ensure_class(self, type_):
        if type_ not in self.initialized:
            self.runtime_class_init(type_)
            self.check_callbacks()
            self.initialized.add(type_)

    def invoke(self, method, args=(), instance=0):
        if not method:
            raise ValueError('Cannot invoke a null method')
        keepalive = []
        slots = (P * len(args))(*(argument_storage(a, keepalive) for a in args)) if args else None
        exception = P()
        result = self.runtime_invoke(method, instance, slots, C.byref(exception))
        self.check_callbacks()
        if exception.value:
            messages = []
            for format_ in (self.format_exception, self.format_stack_trace):
                buffer = C.create_string_buffer(65536)
                format_(exception, buffer, len(buffer))
                messages.append(buffer.value.decode('utf-8', 'replace'))
            raise ManagedError('\n'.join(messages))
        return result or 0

    def static(self, assembly, namespace, name, method, args=(), parameter_types=None):
        type_ = self.klass(assembly, namespace, name)
        self.ensure_class(type_)
        return self.invoke(self.method(type_, method, len(args), parameter_types), args)

    def call(self, instance, method, args=(), parameter_types=None, type_=None):
        if not instance:
            raise ValueError(f'Null receiver for {method}')
        type_ = type_ or self.object_get_class(instance)
        self.ensure_class(type_)
        return self.invoke(self.method(type_, method, len(args), parameter_types), args, instance)

    @contextmanager
    def pinned(self, value):
        if not value:
            raise ValueError('Cannot pin null managed object')
        handle = self.gchandle_new(value, True)
        if not handle:
            raise RuntimeError('il2cpp_gchandle_new returned 0')
        try:
            yield value
        finally:
            self.gchandle_free(handle)

    def retain(self, value):
        if not value:
            raise ValueError('Cannot retain null object')
        handle = self.gchandle_new(value, True)
        if not handle:
            raise RuntimeError('il2cpp_gchandle_new returned 0')
        self.handles.append(handle)
        return value

    def new(self, type_, args=(), parameter_types=None):
        self.ensure_class(type_)
        value = self.object_new(type_)
        with self.pinned(value):
            self.invoke(self.method(type_, '.ctor', len(args), parameter_types), args, value)
        return value

    def text(self, value):
        if not value:
            return None
        length = self.string_length(value)
        if not 0 <= length <= 256 * 1024 * 1024:
            raise ValueError(f'Invalid managed string length: {length}')
        return C.string_at(self.string_chars(value), length * 2).decode('utf-16-le', 'surrogatepass')

    def string(self, text):
        return self.string_new(text.encode('utf-8'))

    def field(self, type_, name):
        current = type_
        while current:
            field = self.class_get_field_from_name(current, name.encode())
            if field:
                return field
            current = self.class_get_parent(current)
        raise LookupError(f'Field not found: {self.type_name(type_)}.{name}')

    def offset(self, type_, name):
        field = self.field(type_, name)
        if self.field_get_flags(field) & 0x10:
            raise ValueError(f'Expected instance field: {name}')
        return self.field_get_offset(field)

    def static_value(self, type_, name):
        self.ensure_class(type_)
        result = P()
        self.field_static_get_value(self.field(type_, name), C.byref(result))
        return result.value or 0

    def set_static(self, type_, name, value):
        self.ensure_class(type_)
        self.field_static_set_value(self.field(type_, name), value)

    def system_type(self, type_):
        return self.type_get_object(self.class_get_type(type_))

    def generic_method(self, method, declaring_type, argument_type):
        reflection = self.method_get_object(method, declaring_type)
        with self.pinned(reflection):
            array = self.array_new(self.klass('mscorlib.dll', 'System', 'Type'), 1)
            with self.pinned(array):
                self.gc_wbarrier_set_field(array, array + 32, self.system_type(argument_type))
                result = self.call(reflection, 'MakeGenericMethod', (array,), ('System.Type[]',))
                with self.pinned(result):
                    closed = self.method_get_from_reflection(result)
                    if not closed:
                        raise RuntimeError('il2cpp_method_get_from_reflection returned null')
                    return closed

    def common_key(self):
        type_ = self.klass('Common.Beyond.dll', 'Beyond.VFS', 'VirtualFileSystem')
        self.ensure_class(type_)
        method = self.method(type_, 'GetCommonChachaKeyBs', 1)
        address = ptr(method)
        if not address:
            raise RuntimeError('GetCommonChachaKeyBs has no native pointer')
        storage = (C.c_ubyte * 32)()
        span = ByteSpan(C.addressof(storage), 32, 0)
        result = ByteSpan()
        # Windows x64 hidden struct return buffer, by-address Span<byte>, MethodInfo*.
        function = C.CFUNCTYPE(P, P, P, P)(address)
        function(C.byref(result), C.byref(span), method)
        self.check_callbacks()
        if not result.pointer or result.length != 32:
            raise RuntimeError('GetCommonChachaKeyBs returned an invalid key span')
        return C.string_at(result.pointer, result.length)

    def init_formatters(self):
        if self.formatters_ready:
            return
        self.static('MemoryPack.dll', 'MemoryPack', 'MemoryPackFormatterProvider', 'RegisterWellKnownTypesFormatters')
        for name in ('MemoryPackDeSerializerRegister', 'MemoryPackSerializerRegister'):
            self.static('MemoryPack.Beyond.dll', 'Beyond.MemoryPack', name, 'Init')
        self.formatters_ready = True

    @contextmanager
    def deserialize(self, schema, data):
        target = self.klass(schema.assembly, schema.namespace, schema.name)
        if schema.encoding == 'managed':
            text = self.string(data.decode('utf-8-sig'))
            with self.pinned(text):
                value = self.static('Common.Beyond.dll', 'Beyond', 'JsonHelper', 'DeserializeObject',
                                    (text, self.system_type(target), None),
                                    ('System.String', 'System.Type', 'Newtonsoft.Json.JsonSerializerSettings'))
                with self.pinned(value):
                    yield value
            return
        self.init_formatters()
        names = []
        current, namespace = target, ''
        while current:
            names.insert(0, self.class_get_name(current).decode())
            namespace = self.class_get_namespace(current).decode() or namespace
            current = self.class_get_declaring_type(current)
        wrapper_name = namespace.replace('.', '_') + '_' + '_'.join(names) + 'ForMemoryPack'
        try:
            wrapper_type = self.klass('MemoryPack.Beyond.dll', 'Beyond.MemoryPack', wrapper_name)
        except LookupError:
            wrapper_type = self.klass('MemoryPack.Beyond.dll', '', wrapper_name)
        init = self.method(wrapper_type, 'InitInstance', 1, required=False)
        serializer = self.klass('MemoryPack.dll', 'MemoryPack', 'MemoryPackSerializer')
        options = self.static_value(self.klass('MemoryPack.dll', 'MemoryPack', 'MemoryPackSerializerOptions'), 'Default')
        if init:
            target_object = self.object_new(target)
            with self.pinned(target_object):
                wrapper = self.new(wrapper_type)
                with self.pinned(wrapper):
                    self.invoke(init, (target_object,), wrapper)
                    slot = P(wrapper)
                    method = self.method(serializer, 'Deserialize', 4,
                                         ('System.Type', 'System.ReadOnlySpan<System.Byte>', 'System.Object&',
                                          'MemoryPack.MemoryPackSerializerOptions'))
                    self.invoke(method, (self.system_type(wrapper_type), Span(data), ByRef(C.addressof(slot)), options))
                    with self.pinned(slot.value):
                        value = self.call(slot.value, 'GetValue')
                        with self.pinned(value):
                            yield value
        else:
            self.method(wrapper_type, 'CreateInstance', 0)  # Verify modern wrapper contract.
            if target not in self.generic_deserializers:
                self.invoke(self.method(wrapper_type, 'RegisterFormatter', 0))
                definition = self.method(serializer, 'Deserialize', 2,
                                         ('System.ReadOnlySpan<System.Byte>', 'MemoryPack.MemoryPackSerializerOptions'))
                self.generic_deserializers[target] = self.generic_method(definition, serializer, wrapper_type)
            wrapper = self.invoke(self.generic_deserializers[target], (Span(data), options))
            with self.pinned(wrapper):
                value = self.call(wrapper, 'GetValue')
                with self.pinned(value):
                    yield value

    def initialize_hashes(self, main, initial):
        if main is None and initial is None:
            raise ValueError('No StringPathHash sections found')
        type_ = self.klass('Common.Beyond.dll', 'Beyond.Resource', 'StringPathHashBinary')
        binary = self.retain(self.new(type_))
        for data, pointer_name, strings_name, dictionary_name in (
            (initial, 'm_ininPtr', 'm_initStrPtr', 'm_initMappingStrDictionary'),
            (main, 'm_mainPtr', 'm_mainStrPtr', 'm_mainMappingStrDictionary')):
            if data is None:
                continue
            storage = C.create_string_buffer(data)
            self.keepalive.append(storage)
            data_pointer, string_pointer = P(C.addressof(storage)), P()
            dictionary = binary + self.offset(type_, dictionary_name)
            self.call(binary, '_InitData', (ByRef(C.addressof(data_pointer)),
                      ByRef(C.addressof(string_pointer)), ByRef(dictionary)))
            put_ptr(binary + self.offset(type_, pointer_name), data_pointer.value)
            put_ptr(binary + self.offset(type_, strings_name), string_pointer.value)
        if main is not None:
            C.c_ubyte.from_address(binary + self.offset(type_, 'm_isInMainState')).value = 1
        processor = self.klass('Common.Beyond.dll', 'Beyond.Resource', 'HashStringPathProcessor')
        self.set_static(processor, 's_runtimeBinary', binary)
        if self.static_value(processor, 's_runtimeBinary') != binary:
            raise RuntimeError('StringPathHashBinary installation failed')
        from .vfs import hash_sample
        for data in (main, initial):
            sample = hash_sample(data)
            if sample:
                value = self.static('Common.Beyond.dll', 'Beyond.Resource', 'HashStringPathProcessor',
                                    'GetString', (C.c_int64(sample[0]),), ('Beyond.Resource.StringPathHash',))
                if self.text(value) != sample[1]:
                    raise RuntimeError(f'StringPathHash validation failed: {sample[0]}')

    def initialize_options(self):
        type_ = self.klass('Common.Beyond.dll', 'Beyond.Resource', 'ResourceOptions')
        parent = self.class_get_parent(type_)
        if self.static_value(parent, 's_instance'):
            return
        options = self.retain(self.new(type_))
        for field, values in (
            ('_mainFolder', ('Assets/Beyond/DynamicAssets', 'Assets/BeyondDev/DynamicAssets', 'Assets/I18nAssets/Main')),
            ('_initialFolder', ('Assets/Beyond/InitialAssets', 'Assets/BeyondDev/InitialAssets', 'Assets/I18nAssets/Initial'))):
            outer = self.field(type_, field)
            inline_type = self.class_from_type(self.field_get_type(outer))
            base = options + self.field_get_offset(outer)
            for nested, value in zip(('rootFolder', 'rootDevFolder', 'i18nResFolder'), values):
                offset = self.raw_offset(inline_type, self.field(inline_type, nested))
                self.gc_wbarrier_set_field(options, base + offset, self.string(value))
        self.set_static(parent, 's_instance', options)
        if self.static_value(parent, 's_instance') != options:
            raise RuntimeError('ResourceOptions installation failed')

    def initialize_pool(self, directory):
        self.init_formatters()
        self.initialize_options()
        self.static('Common.Beyond.dll', 'Beyond.Resource', 'ResourceManager', 'get_usingVFS')
        pool = self.static('Common.Beyond.dll', 'Beyond.UniqueStringPool', 'RuntimeUniqueStringPool', 'get_instance')
        with self.pinned(pool):
            loader = self.klass('Common.Beyond.dll', 'Beyond.VFS', 'UnityFileLoaderHelper')
            root = self.retain(self.string(directory.parent.as_posix()))
            self.set_static(loader, 's_persistentDataPath', root)
            name = self.string(directory.name + '/')
            with self.pinned(name):
                self.call(pool, 'InitPath', (name,))
            self.call(pool, 'InitMappedString', (I(0),))
            provider = self.klass('MemoryPack.dll', 'MemoryPack', 'MemoryPackFormatterProvider')
            register = self.generic_method(self.method(provider, 'ForceRegister', 1), provider,
                                           self.klass('mscorlib.dll', 'System', 'String'))
            formatter = self.new(self.find_any_class('MemoryPack', 'BeyondStringFormatter'))
            with self.pinned(formatter):
                self.invoke(register, (formatter,))
            self.set_static(self.find_any_class('MemoryPack', 'MemoryPackReaderExtensions'), 's_stringPool', pool)

    def initialize_global_const(self, data):
        self.static('Common.Beyond.dll', 'Beyond.Cfg', 'SparkTableMemory', 'Init')
        table = self.static('Common.Beyond.dll', 'Beyond.Cfg', 'Tables', 'get_globalConst')
        array = self.array_new(self.klass('mscorlib.dll', 'System', 'Byte'), len(data))
        with self.pinned(array):
            C.memmove(array + 32, data, len(data))
            self.call(table, 'Load', (array,))
        if not self.text(self.call(table, 'get_femaleCharID')):
            raise RuntimeError('GlobalConst initialization failed')

    def json_settings(self):
        if self.settings:
            return self.settings
        base = self.static('Common.Beyond.dll', 'Beyond', 'JsonHelper', 'get_defaultSerializeSettings')
        if not base:
            raise RuntimeError('JsonHelper.defaultSerializeSettings returned null')
        with self.pinned(base):
            settings = self.retain(self.new(self.klass('Newtonsoft.Json.dll', 'Newtonsoft.Json', 'JsonSerializerSettings'), (base,)))
        resolver = self.retain(self.new(self.klass('Common.Beyond.dll', 'Beyond', 'BaseFirstContractResolver')))
        self.call(resolver, 'set_IgnoreSerializableAttribute', (B(False),))
        self.call(settings, 'set_ContractResolver', (resolver,))
        converters = self.call(settings, 'get_Converters')
        for index, (assembly, namespace, name) in enumerate((
            ('Newtonsoft.Json.dll', 'Newtonsoft.Json.Converters', 'StringEnumConverter'),
            ('Common.Beyond.dll', 'Beyond', 'AnimationCurveJsonConverter'),
            ('Common.Beyond.dll', 'Beyond', 'ColorConverter'),
            ('Gameplay.Beyond.dll', 'Beyond.Gameplay', 'AnimationCurveDictConverter'))):
            try:
                converter_type = self.klass(assembly, namespace, name)
            except LookupError:
                continue  # Same optional converter behavior as Kotlin newObjectOrNull.
            converter = self.new(converter_type)
            with self.pinned(converter):
                self.call(converters, 'Insert' if index == 0 else 'Add',
                          (I(0), converter) if index == 0 else (converter,))
        self.settings = settings
        return settings

    def serialize(self, value):
        settings = self.json_settings()

        def run(root):
            result = self.static('Newtonsoft.Json.dll', 'Newtonsoft.Json', 'JsonConvert', 'SerializeObject',
                                 (root, I(1), settings),
                                 ('System.Object', 'Newtonsoft.Json.Formatting', 'Newtonsoft.Json.JsonSerializerSettings'))
            if not result:
                return 'null'
            with self.pinned(result):
                return self.text(result)
        try:
            return run(value)
        except ManagedError:
            from .curves import preprocess
            with preprocess(self, value) as converted:
                return run(converted)

    def raw_offset(self, type_, field):
        offset = self.field_get_offset(field)
        return offset - 16 if self.class_is_valuetype(type_) and offset >= 16 else offset

    def callback(self, result, arguments, function):
        def guarded(*args):
            try:
                return function(*args)
            except BaseException:
                self.callback_errors.append(traceback.format_exc())
                return 0 if result is not None else None
        callback = C.CFUNCTYPE(result, *arguments)(guarded)
        self.callbacks.append(callback)  # Native code retains callback pointers.
        return callback

    def check_callbacks(self):
        if self.callback_errors:
            errors, self.callback_errors = self.callback_errors, []
            raise RuntimeError('Unity callback failed:\n' + '\n'.join(errors))

    def close(self):
        # Keep native modules, callbacks and allocations alive until worker exit.
        # Unity IL2CPP teardown/unloading is deliberately process-scoped.
        for handle in self.handles:
            self.gchandle_free(handle)
        self.handles.clear()
