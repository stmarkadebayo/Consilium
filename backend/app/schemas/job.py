from __future__ import annotations

from datetime import datetime

from app.schemas.common import APIModel


class JobResponse(APIModel):
    id: str
    job_type: str
    status: str
    retry_count: int
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
