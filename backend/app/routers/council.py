from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import DbDep, UserDep
from app.schemas import CouncilMemberResponse, CouncilResponse, UpdateCouncilRequest
from app.services.council_service import CouncilService

router = APIRouter(prefix="/council", tags=["council"])


@router.get("", response_model=CouncilResponse)
def get_council(user: UserDep, db: DbDep):
    council = CouncilService.get_or_create_for_user(db, user)
    return _serialize_council(council)


@router.patch("", response_model=CouncilResponse)
def update_council(body: UpdateCouncilRequest, user: UserDep, db: DbDep):
    council = CouncilService.get_or_create_for_user(db, user)
    council.name = body.name
    db.add(council)
    db.flush()
    db.refresh(council)
    return _serialize_council(council)


def _serialize_council(council) -> CouncilResponse:
    return CouncilResponse(
        id=council.id,
        name=council.name,
        min_personas=council.min_personas,
        max_personas=council.max_personas,
        created_at=council.created_at,
        updated_at=council.updated_at,
        members=[
            CouncilMemberResponse(
                id=m.id,
                persona_id=m.persona_id,
                display_name=m.persona.display_name,
                persona_type=m.persona.persona_type,
                position=m.position,
                is_active=m.is_active,
            )
            for m in council.members
        ],
    )
