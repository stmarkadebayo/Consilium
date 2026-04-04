from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class CouncilMemberResponse(APIModel):
    id: str
    persona_id: str
    display_name: str
    persona_type: str
    position: int
    is_active: bool
    identity_summary: str | None = None
    status: str


class CouncilResponse(APIModel):
    id: str
    name: str
    min_personas: int
    max_personas: int
    created_at: datetime
    updated_at: datetime
    members: list[CouncilMemberResponse]


class UpdateCouncilRequest(APIModel):
    name: str = Field(..., min_length=1, max_length=255)


class UpdateCouncilMemberRequest(APIModel):
    is_active: bool | None = None
    position: int | None = Field(default=None, ge=0)
