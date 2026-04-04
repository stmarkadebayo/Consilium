from __future__ import annotations

from datetime import datetime

from app.schemas.common import APIModel


class UserResponse(APIModel):
    id: str
    email: str
    display_name: str | None
    onboarding_done: bool
    created_at: datetime
