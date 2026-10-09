from __future__ import annotations

import copy
import re
from pathlib import Path
from urllib.parse import urlencode, urlparse

import requests

from .errors import AkeToolError, ValidationError
from .index_crypto import DEFAULT_KEY, INITIAL_KEY, decrypt_index
from .models import HotfixInfo, LatestInfo, ResourcePart, SeedInfo


SEED_URL = "https://launcher.hypergryph.com/api/proxy/batch_proxy"
HOTFIX_URL = "https://launcher.hypergryph.com/api/game/get_latest_resources"
GAME_APPCODE = "6LL0KJuqHBVz33WK"
LAUNCHER_APPCODE = "abYeZZ16BPluCFyT"

SEED_PAYLOAD = {
    "proxy_reqs": [
        {
            "get_latest_launcher_req": {
                "appcode": LAUNCHER_APPCODE,
                "channel": "1",
                "sub_channel": "1",
                "target_app": "EndField",
                "version": "1.2.1",
            },
            "kind": "get_latest_launcher",
        },
        {
            "get_latest_game_req": {
                "appcode": GAME_APPCODE,
                "channel": "1",
                "launcher_appcode": LAUNCHER_APPCODE,
                "sub_channel": "1",
                "version": "1.1.9",
            },
            "kind": "get_latest_game",
        },
    ],
    "seq": "6",
}


class HotfixClient:
    def __init__(
        self,
        timeout: int = 60,
        session: requests.Session | None = None,
        appcode: str = GAME_APPCODE,
    ) -> None:
        self.timeout = timeout
        self.appcode = appcode.strip()
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": "AKEDataTool/0.1"})

    def get_seed_info(self) -> SeedInfo:
        try:
            response = self.session.post(
                SEED_URL,
                headers={"Content-Type": "application/json"},
                json=self._seed_payload(),
                timeout=self.timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise AkeToolError(f"获取 Seed 信息失败：{exc}") from exc

        for item in payload.get("proxy_rsps", []):
            if item.get("kind") != "get_latest_game":
                continue
            game_response = item.get("get_latest_game_rsp", {})
            package_path = game_response.get("pkg", {}).get("file_path", "").strip()
            if not package_path:
                continue
            return self._parse_seed_path(package_path)
        raise ValidationError("Seed API 响应中没有 get_latest_game 的 file_path")

    @staticmethod
    def _parse_seed_path(package_path: str) -> SeedInfo:
        segments = [segment for segment in urlparse(package_path).path.rstrip("/").split("/") if segment]
        version_pattern = re.compile(r"^\d+\.\d+(?:\.\d+)?$")
        seed_pattern = re.compile(r"^(\d+\.\d+(?:\.\d+)?)_(.+)$")
        seed_index = -1
        seed_version = ""
        rand_str = ""
        for index in range(len(segments) - 1, -1, -1):
            match = seed_pattern.fullmatch(segments[index])
            if match:
                seed_index = index
                seed_version, rand_str = match.groups()
                break
        if seed_index < 0:
            raise ValidationError(f"无法解析 Seed 文件路径：{package_path}")

        game_segment = next(
            (segment for segment in reversed(segments[:seed_index]) if version_pattern.fullmatch(segment)),
            "",
        )
        if not game_segment:
            seed_match = version_pattern.fullmatch(seed_version)
            if not seed_match:
                raise ValidationError(f"无法解析游戏版本：{package_path}")
            game_segment = seed_version
        version_parts = game_segment.split(".")
        game_version = ".".join(version_parts[:2])
        return SeedInfo(game_version, seed_version, rand_str, package_path)

    def _seed_payload(self) -> dict:
        payload = copy.deepcopy(SEED_PAYLOAD)
        payload["proxy_reqs"][1]["get_latest_game_req"]["appcode"] = self.appcode
        return payload

    def construct_hotfix_url(self, seed: SeedInfo) -> str:
        query = urlencode(
            {
                "appcode": self.appcode,
                "platform": "Windows",
                "game_version": seed.game_version,
                "version": seed.seed_version,
                "rand_str": seed.rand_str,
            }
        )
        return f"{HOTFIX_URL}?{query}"

    def get_hotfix_info(self, request_url: str) -> HotfixInfo:
        try:
            response = self.session.get(request_url, timeout=self.timeout)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise AkeToolError(f"获取 Hotfix 信息失败：{exc}") from exc

        parts: dict[str, ResourcePart] = {}
        for resource in payload.get("resources", []):
            name = resource.get("name", "")
            path = resource.get("path", "")
            if name in {"main", "initial"} and path:
                parts[name] = ResourcePart(
                    name=name,
                    path=path.rstrip("/"),
                    version=str(resource.get("version", "")),
                    raw=resource,
                )
        missing = {"main", "initial"} - parts.keys()
        if missing:
            raise ValidationError(f"Hotfix 响应缺少资源部分：{', '.join(sorted(missing))}")
        return HotfixInfo(
            request_url=request_url,
            res_version=str(payload.get("res_version", "")),
            parts=parts,
            raw=payload,
        )

    def get_latest(self) -> LatestInfo:
        seed = self.get_seed_info()
        request_url = self.construct_hotfix_url(seed)
        hotfix = self.get_hotfix_info(request_url)
        return LatestInfo(seed=seed, hotfix=hotfix)

    def get_for_version(self, seed_version: str, rand_str: str) -> LatestInfo:
        normalized_version = seed_version.strip()
        normalized_rand = rand_str.strip()
        if not re.fullmatch(r"\d+\.\d+\.\d+", normalized_version):
            raise ValidationError(f"手动游戏版本格式无效：{seed_version}")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", normalized_rand):
            raise ValidationError("手动 rand_str 只能包含字母、数字、下划线或连字符")
        game_version = ".".join(normalized_version.split(".")[:2])
        seed = SeedInfo(
            game_version=game_version,
            seed_version=normalized_version,
            rand_str=normalized_rand,
            package_path=f"manual://{normalized_version}_{normalized_rand}",
        )
        request_url = self.construct_hotfix_url(seed)
        hotfix = self.get_hotfix_info(request_url)
        return LatestInfo(seed=seed, hotfix=hotfix)

    def download_index(self, part: ResourcePart, output_dir: Path) -> tuple[Path, dict]:
        index_name = f"index_{part.name}.json"
        url = f"{part.path}/{index_name}"
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
        except requests.RequestException as exc:
            raise AkeToolError(f"下载索引失败 {url}：{exc}") from exc

        key = INITIAL_KEY if part.name == "initial" else DEFAULT_KEY
        decrypted, data, _ = decrypt_index(response.text.strip(), hint_key=key)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / index_name
        temporary = output_path.with_suffix(output_path.suffix + ".tmp")
        temporary.write_bytes(decrypted)
        temporary.replace(output_path)
        return output_path, data
