from __future__ import annotations

from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.db import utcnow
from app.models.job import Job


class JobService:
    @staticmethod
    def create_job(
        db: Session,
        *,
        user_id: str,
        job_type: str,
        payload: Optional[dict] = None,
        max_retries: int = 3,
    ) -> Job:
        job = Job(
            user_id=user_id,
            job_type=job_type,
            status="pending",
            payload_json=payload or {},
            max_retries=max_retries,
        )
        db.add(job)
        db.flush()
        return job

    @staticmethod
    def mark_running(job: Job) -> Job:
        job.status = "running"
        job.started_at = utcnow()
        job.completed_at = None
        job.error_message = None
        job.result_json = {}
        return job

    @staticmethod
    def mark_completed(job: Job, result: Optional[dict] = None) -> Job:
        job.status = "completed"
        if job.started_at is None:
            job.started_at = utcnow()
        job.completed_at = utcnow()
        job.result_json = result or {}
        job.error_message = None
        return job

    @staticmethod
    def mark_failed(job: Job, error_message: str) -> Job:
        job.status = "failed"
        if job.started_at is None:
            job.started_at = utcnow()
        job.completed_at = utcnow()
        job.error_message = error_message
        return job

    @staticmethod
    def get_job_for_user(db: Session, job_id: str, user_id: str) -> Optional[Job]:
        return db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()

    @staticmethod
    def retry(job: Job) -> Job:
        if job.status != "failed":
            raise ValueError("Only failed jobs can be retried")
        if job.retry_count >= job.max_retries:
            raise ValueError("Maximum retries reached")
        job.retry_count += 1
        job.status = "pending"
        job.started_at = None
        job.completed_at = None
        job.error_message = None
        job.result_json = {}
        return job

    @staticmethod
    def claim_next_pending_job(db: Session, *, job_types: list[str]) -> Optional[Job]:
        candidate = (
            db.query(Job)
            .filter(Job.status == "pending", Job.job_type.in_(job_types))
            .order_by(Job.created_at.asc())
            .first()
        )
        if candidate is None:
            return None

        claimed_count = (
            db.query(Job)
            .filter(Job.id == candidate.id, Job.status == "pending")
            .update(
                {
                    Job.status: "running",
                    Job.started_at: utcnow(),
                    Job.completed_at: None,
                    Job.error_message: None,
                    Job.result_json: {},
                },
                synchronize_session=False,
            )
        )
        if claimed_count != 1:
            db.rollback()
            return None

        db.commit()
        return db.query(Job).filter(Job.id == candidate.id).first()

    @staticmethod
    def requeue_stale_running_jobs(db: Session, *, job_types: list[str], stale_after_seconds: int) -> int:
        cutoff = utcnow() - timedelta(seconds=stale_after_seconds)
        jobs = (
            db.query(Job)
            .filter(
                Job.status == "running",
                Job.job_type.in_(job_types),
                Job.started_at.is_not(None),
                Job.started_at < cutoff,
            )
            .all()
        )
        for job in jobs:
            job.status = "pending"
            job.started_at = None
            job.completed_at = None
            job.error_message = None
            job.result_json = {}
            db.add(job)
        if jobs:
            db.commit()
        return len(jobs)
