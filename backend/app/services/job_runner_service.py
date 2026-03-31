from __future__ import annotations

import logging
import threading
import time

from app.services.job_service import JobService
from app.services.persona_service import PersonaService
from app.services.conversation_service import ConversationService

logger = logging.getLogger(__name__)


class JobRunnerService:
    """Background thread that polls for pending jobs and processes them."""

    def __init__(self, *, settings, session_maker, provider) -> None:
        self.settings = settings
        self.session_maker = session_maker
        self.provider = provider
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        if not self.settings.job_runner_enabled:
            logger.info("Job runner disabled")
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("Job runner started")

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Job runner stopped")

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._poll_once()
            except Exception:
                logger.exception("Job runner poll error")
            self._stop_event.wait(self.settings.job_runner_poll_interval_seconds)

    def _poll_once(self) -> None:
        with self.session_maker() as db:
            try:
                jobs = JobService.get_pending_jobs(db, limit=5)
                for job in jobs:
                    self._process_job(db, job)
                db.commit()
            except Exception:
                db.rollback()
                raise

    def _process_job(self, db, job) -> None:
        logger.info("Processing job %s (type=%s)", job.id, job.job_type)
        JobService.mark_running(job)
        db.flush()

        try:
            if job.job_type == "persona_creation":
                PersonaService.process_persona_creation_job(
                    db, job, provider=self.provider
                )
            elif job.job_type == "council_query":
                ConversationService.process_council_query_job(
                    db, job, provider=self.provider, settings=self.settings
                )
            else:
                JobService.mark_failed(job, f"Unknown job type: {job.job_type}")
        except Exception as error:
            logger.exception("Job %s failed", job.id)
            if job.status != "failed":
                JobService.mark_failed(job, str(error))
        db.flush()
