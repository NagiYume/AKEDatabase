from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path


def now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")


def atomic_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def read_json(path: Path, default=None):
    if not path.exists():
        return default
    # Corrupt state is an error, never an empty successful baseline.
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path, algorithm="sha256"):
    value = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def identity(latest):
    values = [latest.seed.seed_version, latest.seed.rand_str,
              latest.hotfix.res_version, latest.hotfix.parts["main"].version,
              latest.hotfix.parts["initial"].version]
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


def version(latest):
    game, hotfix = latest.seed.seed_version, latest.hotfix.parts["main"].version
    if not re.fullmatch(r"\d+\.\d+\.\d+", game):
        raise ValueError("Invalid game version")
    if not re.fullmatch(r"[0-9A-Za-z._-]+", hotfix) or hotfix in {".", ".."}:
        raise ValueError("Invalid hotfix version")
    return f"{game}@{hotfix}", f"public/{game}/{hotfix}/TableCfg/"


def load_config(path):
    value = read_json(Path(path))
    if not isinstance(value, dict):
        raise ValueError("Missing configuration")
    for name in ("work_dir", "sdk", "java", "credentials_file", "status_token_file"):
        if not Path(value[name]).is_absolute():
            raise ValueError(f"{name} must be absolute")
    if Path(value["work_dir"]).resolve() == Path("/"):
        raise ValueError("Invalid work directory")
    if value["interval"] < 1 or value["request_timeout"] < 1:
        raise ValueError("Invalid interval or timeout")
    idle_timeout = value.get("extraction_idle_timeout", 180)
    if type(idle_timeout) is not int or not 30 <= idle_timeout <= 1800:
        raise ValueError("extraction_idle_timeout must be an integer from 30 to 1800")
    if value["bucket"] != "akedatabase":
        raise ValueError("This deployment is scoped to akedatabase")
    if value.get("status_host") not in {"127.0.0.1", "::1"}:
        if not value.get("tls_cert") or not value.get("tls_key"):
            raise ValueError("Public status listener requires TLS")
    return value
