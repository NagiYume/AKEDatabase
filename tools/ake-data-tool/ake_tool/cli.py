from __future__ import annotations

import argparse
import json
import sys

from .config import CONFIG_FILE, load_config
from .errors import AkeToolError, CancelledError
from .models import ProgressEvent
from .pipeline import PIPELINE_STAGES, Pipeline


def print_event(event: ProgressEvent) -> None:
    key = (event.stage, event.message)
    if getattr(print_event, "_last_key", None) == key:
        return
    print_event._last_key = key
    percent = ""
    if event.total > 0:
        percent = f" [{event.current / event.total * 100:5.1f}%]"
    print(f"[{event.stage}]{percent} {event.message}")


def command_check() -> int:
    latest = Pipeline(load_config(), progress=print_event).check_latest()
    print(
        json.dumps(
            {
                "game_version": latest.seed.game_version,
                "seed_version": latest.seed.seed_version,
                "rand_str": latest.seed.rand_str,
                "hotfix_res_version": latest.hotfix.res_version,
                "main_version": latest.hotfix.parts["main"].version,
                "initial_version": latest.hotfix.parts["initial"].version,
                "hotfix_url": latest.hotfix.request_url,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def command_run(stages: list[str] | None = None) -> int:
    pipeline = Pipeline(load_config(), progress=print_event)
    state = pipeline.run() if stages is None else pipeline.run_steps(stages)
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0


def command_gui() -> int:
    try:
        from .gui import run_gui
    except ImportError as exc:
        print(f"无法启动 PyQt6 GUI：{exc}", file=sys.stderr)
        print("请运行：python -m pip install -r requirements.txt", file=sys.stderr)
        return 2
    return run_gui()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="AKE TableCfg 下载与解包工具")
    parser.add_argument("command", choices=["check", "run", "stage", "gui", "config"], nargs="?", default="gui")
    parser.add_argument("stage_name", choices=list(PIPELINE_STAGES), nargs="?")
    parser.add_argument(
        "--steps",
        help="为 run 指定逗号分隔的步骤，例如 download,unpack,validate",
    )
    return parser


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    args = build_parser().parse_args()
    try:
        if args.command == "check":
            return command_check()
        if args.command == "run":
            stages = [value.strip() for value in args.steps.split(",") if value.strip()] if args.steps else None
            return command_run(stages)
        if args.command == "stage":
            if not args.stage_name:
                raise ValueError("stage 命令需要指定步骤名称")
            return command_run([args.stage_name])
        if args.command == "config":
            config = load_config()
            print(f"配置文件：{CONFIG_FILE}")
            print(json.dumps(config.to_dict(), ensure_ascii=False, indent=2))
            return 0
        return command_gui()
    except CancelledError:
        print("任务已取消", file=sys.stderr)
        return 130
    except (AkeToolError, FileNotFoundError, ValueError) as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
