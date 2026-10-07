from __future__ import annotations

import argparse
import fcntl
import json
import signal
from pathlib import Path

from .common import load_config
from .status import start_status
from .worker import Worker


def main():
    parser = argparse.ArgumentParser(description="Standalone TableCfg server")
    parser.add_argument("command", choices=["serve", "validate", "once", "probe-r2"])
    parser.add_argument("--config", required=True)
    args = parser.parse_args()
    config = load_config(args.config)
    root = Path(config["work_dir"])
    root.mkdir(parents=True, exist_ok=True)
    with (root / "worker.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        worker = Worker(config)
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: worker.cancel())
        if args.command == "probe-r2":
            from .probe import probe
            print(json.dumps(probe(worker), indent=2))
        elif args.command == "serve":
            server = start_status(worker)
            try:
                worker.run()
            finally:
                server.shutdown()
                server.server_close()
        else:
            worker.cycle(force=True, publish=args.command == "once" and config["upload_enabled"])
            print(json.dumps(worker.snapshot(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
