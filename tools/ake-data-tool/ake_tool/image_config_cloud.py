from __future__ import annotations

import json
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .asset_index import validate_asset_index
from .image_paths import IMAGE_PROFILES, ImageParsingConfig
from .public_http import public_download_headers


PUBLIC_ASSET_INDEX_URL = "https://data.akedata.wiki/asset-sync-index.json"


@dataclass(frozen=True)
class ImageConfigResolution:
    config: ImageParsingConfig
    source: str
    detail: str


class CloudImageConfigLoader:
    def __init__(
        self,
        timeout: int = 60,
        opener: Callable[..., object] = urlopen,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.timeout = timeout
        self.opener = opener
        self.clock = clock

    def load(
        self,
        local_configs: dict[str, ImageParsingConfig],
    ) -> dict[str, ImageConfigResolution]:
        url = f"{PUBLIC_ASSET_INDEX_URL}?t={int(self.clock() * 1000)}"
        request = Request(
            url,
            headers=public_download_headers("application/json"),
        )
        try:
            with self.opener(request, timeout=self.timeout) as response:
                status = int(getattr(response, "status", 200))
                if status < 200 or status >= 300:
                    raise HTTPError(url, status, "HTTP 状态失败", None, None)
                payload = json.loads(response.read().decode("utf-8"))
            configs = payload.get("imageParsingConfigs") if isinstance(payload, dict) else None
            structural = deepcopy(payload)
            if isinstance(structural, dict):
                structural.pop("imageParsingConfigs", None)
            validate_asset_index(structural, allow_v1=False)
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            return self._fallback_all(local_configs, "local_network_failure", f"网络错误：{exc}")
        except json.JSONDecodeError as exc:
            return self._fallback_all(local_configs, "local_index_invalid", f"远端 JSON 无法解析：{exc}")
        except Exception as exc:
            return self._fallback_all(local_configs, "local_index_invalid", f"远端索引结构错误：{exc}")

        result: dict[str, ImageConfigResolution] = {}
        for profile in IMAGE_PROFILES:
            local = local_configs[profile]
            if not isinstance(configs, dict) or profile not in configs:
                result[profile] = ImageConfigResolution(
                    local, "local_profile_missing", "云端档案缺失，已使用本地配置"
                )
                continue
            try:
                cloud = ImageParsingConfig.from_dict(configs[profile])
            except Exception as exc:
                result[profile] = ImageConfigResolution(
                    local, "local_profile_invalid", f"云端当前 profile 配置错误：{exc}"
                )
            else:
                result[profile] = ImageConfigResolution(cloud, "cloud", "云端配置读取成功")
        return result

    @staticmethod
    def _fallback_all(
        local_configs: dict[str, ImageParsingConfig],
        source: str,
        detail: str,
    ) -> dict[str, ImageConfigResolution]:
        return {
            profile: ImageConfigResolution(local_configs[profile], source, detail)
            for profile in IMAGE_PROFILES
        }
