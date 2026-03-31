from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.db import utcnow
from app.models.job import Job


class JobService:
    @staticmethod
    def create_job(db: Session, *, user_id: str, job_type: str, payload: dict) -> Job:
        job = Job(user_id=user_id, job_type=job_type, payload_json=payload)
        db.add(job)
        db.flush()
        db.refresh(job)
        return job

    @staticmethod
    def get_job(db: Session, job_id: str, user_id: str) -> Optional[Job]:
        return db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()

    @staticmethod
    def get_pending_jobs(db: Session, *, limit: int = 10) -> list[Job]:
        return (
            db.query(Job)
            .filter(Job.status.in_(["pending", "retrying"]))
            .order_by(Job.created_at.asc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def mark_running(job: Job) -> None:
        job.status = "running"
        job.started_at = utcnow()

    @staticmethod
    def mark_completed(job: Job, result: dict) -> None:
        job.status = "completed"
        job.result_json = result
        job.completed_at = utcnow()

    @staticmethod
    def mark_failed(job: Job, error_message: str) -> None:
        job.status = "failed"
        job.error_message = error_message
        job.completed_at = utcnow()

    @staticmethod
    def retry_job(db: Session, job: Job) -> Job:
        if job.retry_count >= job.max_retries:
            raise ValueError("Maximum retries exceeded")
        job.status = "retrying"
        job.retry_count += 1
        job.error_message = None
        job.started_at = None
        job.completed_at = None
        db.add(job)
        db.flush()
        return job
