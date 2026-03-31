from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.dependencies import DbDep, UserDep
from app.schemas import JobResponse
from app.services.job_service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, user: UserDep, db: DbDep):
    job = JobService.get_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        retry_count=job.retry_count,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.post("/{job_id}/retry", response_model=JobResponse)
def retry_job(job_id: str, user: UserDep, db: DbDep):
    job = JobService.get_job(db, job_id, user.id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed jobs can be retried")
    try:
        job = JobService.retry_job(db, job)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return JobResponse(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        retry_count=job.retry_count,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )
