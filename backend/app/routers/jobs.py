from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.job import JobRead
from app.services.job_service import JobService
from app.services.persona_service import PersonaService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)) -> JobRead:
    job = JobService.get_job_for_user(db, job_id, current_user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return JobRead.model_validate(job)


@router.post("/{job_id}/retry", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def retry_job(
    job_id: str,
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobRead:
    job = JobService.get_job_for_user(db, job_id, current_user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    try:
        job = JobService.retry(job)
        if job.job_type == "persona_creation":
            payload = job.payload_json or {}
            draft_id = payload.get("draft_id")
            if draft_id:
                draft = PersonaService.get_draft(db, draft_id, current_user.id)
                if draft is not None:
                    draft.review_status = "generating"
                    db.add(draft)
        db.commit()
        db.refresh(job)
        request.app.state.job_runner.notify()
        return JobRead.model_validate(job)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
