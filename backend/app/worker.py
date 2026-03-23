from __future__ import annotations

import argparse
import logging
import signal
import sys
import time

from app.config import get_settings
from app.db import Base, build_engine, build_session_maker, ensure_postgres_extensions
from app.services.job_runner_service import JobRunnerService


def main() -> int:
    parser = argparse.ArgumentParser(description="Consilium background worker")
    parser.add_argument("--once", action="store_true", help="Process at most one queued job and exit")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    settings = get_settings()
    engine = build_engine(settings.database_url)
    session_maker = build_session_maker(engine)
    runner = JobRunnerService(settings=settings, session_maker=session_maker)

    if settings.auto_create_tables:
        ensure_postgres_extensions(engine)
        Base.metadata.create_all(bind=engine)

    if args.once:
        try:
            runner.run_once()
            return 0
        finally:
            engine.dispose()

    should_stop = False

    def handle_signal(signum, _frame) -> None:
        nonlocal should_stop
        logging.getLogger(__name__).info("Received signal %s, shutting down worker", signum)
        should_stop = True
        runner.stop()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    runner.start()
    try:
        while not should_stop:
            time.sleep(0.5)
    finally:
        runner.stop()
        engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(main())
