from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any


class StateStore:
    def __init__(self, work_root: Path) -> None:
        self.path = work_root / "state.json"

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def save_success(self, state: dict[str, Any]) -> None:
        payload = {**state, "completed_at": datetime.now().astimezone().isoformat(timespec="seconds")}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.path)

    def save_stage(self, version: str, stage: str, values: dict[str, Any]) -> dict[str, Any]:
        state = self.load()
        if state.get("hotfix_res_version") != version:
            state = {"hotfix_res_version": version, "completed_stages": {}}
        stages = state.setdefault("completed_stages", {})
        timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
        stages[stage] = timestamp
        state.update(values)
        state["completed_at"] = timestamp
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(self.path)
        return state
