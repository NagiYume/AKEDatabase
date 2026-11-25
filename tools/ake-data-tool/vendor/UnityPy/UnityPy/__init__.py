__version__ = "1.25.4"

from .environment import Environment as Environment
from .helpers.ArchiveStorageManager import (
    set_assetbundle_decrypt_key as set_assetbundle_decrypt_key,
)

load = Environment

# backward compatibility
AssetsManager = Environment

from .endfield import EndfieldVFS as EndfieldVFS  # noqa: E402
from .endfield import load_endfield as load_endfield  # noqa: E402
