from __future__ import annotations

import logging
import threading
from typing import Optional

from app.config import Settings
from app.providers import build_provider
from app.services.conversation_service import ConversationService
from app.services.job_service import JobService
from app.services.persona_service import PersonaService
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger(__name__)


class JobRunnerService:
    SUPPORTED_JOB_TYPES = ("persona_creation", "council_query")

    def __init__(self, *, settings: Settings, session_maker, provider=None, retrieval_service=None) -> None:
        self.settings = settings
        self.session_maker = session_maker
        self.provider = provider or build_provider(settings)
        self.retrieval_service = retrieval_service or RetrievalService(settings)
        self.poll_interval_seconds = max(0.05, float(settings.job_runner_poll_interval_seconds))
        self.stale_after_seconds = max(5, int(settings.job_runner_stale_after_seconds))
        self._stop_event = threading.Event()
        self._wake_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if not self.settings.job_runner_enabled:
            return
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._wake_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="consilium-job-runner", daemon=False)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._wake_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=max(5.0, self.poll_interval_seconds * 4))

    def notify(self) -> None:
        self._wake_event.set()

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            processed = False
            try:
                processed = self.run_once()
            except Exception:
                logger.exception("Job runner loop failed")
            if processed:
                continue
            self._wake_event.wait(timeout=self.poll_interval_seconds)
            self._wake_event.clear()

    def run_once(self) -> bool:
        db = self.session_maker()
        try:
            JobService.requeue_stale_running_jobs(
                db,
                job_types=list(self.SUPPORTED_JOB_TYPES),
                stale_after_seconds=self.stale_after_seconds,
            )
            job = JobService.claim_next_pending_job(db, job_types=list(self.SUPPORTED_JOB_TYPES))
            if job is None:
                return False

            if job.job_type == "persona_creation":
                PersonaService.process_persona_creation_job(db, job)
            elif job.job_type == "council_query":
                ConversationService.process_council_query_job(
                    db,
                    job,
                    provider=self.provider,
                    retrieval_service=self.retrieval_service,
                )
            else:
                JobService.mark_failed(job, f"Unsupported job type: {job.job_type}")

            db.commit()
            return True
        except Exception:
            db.rollback()
            logger.exception("Job runner failed while processing a queued job")
            raise
        finally:
            db.close()
