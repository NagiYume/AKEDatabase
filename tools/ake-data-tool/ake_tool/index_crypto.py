from __future__ import annotations

import base64
import json
from typing import Any

from .errors import ValidationError


INITIAL_KEY = "Assets/Beyond/InitialAssets/"
DEFAULT_KEY = "Assets/Beyond/DynamicAssets/Gameplay/UI/Fonts/"


def decrypt_subtraction_from_base64(encoded: str, key: str) -> bytes:
    try:
        data = bytearray(base64.b64decode(encoded, validate=True))
    except (ValueError, TypeError) as exc:
        raise ValidationError(f"索引不是有效的 Base64：{exc}") from exc
    key_bytes = key.encode("utf-8")
    if not key_bytes:
        return bytes(data)
    for index in range(len(data)):
        data[index] = (data[index] - key_bytes[index % len(key_bytes)]) & 0xFF
    return bytes(data)


def decrypt_index(encoded: str, hint_key: str | None = None) -> tuple[bytes, dict[str, Any], str]:
    keys = [INITIAL_KEY, DEFAULT_KEY]
    if hint_key in keys:
        keys = [hint_key, *(key for key in keys if key != hint_key)]

    errors: list[str] = []
    for key in keys:
        try:
            decrypted = decrypt_subtraction_from_base64(encoded, key)
            data = json.loads(decrypted.decode("utf-8-sig"))
            if not isinstance(data, dict) or not isinstance(data.get("files"), list):
                raise ValidationError("索引 JSON 缺少 files 数组")
            return decrypted, data, key
        except (UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
            errors.append(f"{key}: {exc}")
    raise ValidationError("索引解密失败；" + "；".join(errors))
