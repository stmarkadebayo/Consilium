from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import DbDep, UserDep
from app.errors import not_found
from app.schemas import CouncilMemberResponse, CouncilResponse, UpdateCouncilMemberRequest, UpdateCouncilRequest
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


@router.patch("/members/{member_id}", response_model=CouncilResponse)
def update_council_member(member_id: str, body: UpdateCouncilMemberRequest, user: UserDep, db: DbDep):
    council = CouncilService.get_or_create_for_user(db, user)
    member = CouncilService.get_member(council, member_id)
    if not member:
        raise not_found("council_member_not_found", "Council member not found.")

    if body.is_active is not None:
        CouncilService.set_member_active(db, member, body.is_active)
    if body.position is not None:
        CouncilService.move_member(db, council, member, body.position)

    CouncilService.sync_onboarding_state(db, user=user, council=council)
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
                identity_summary=m.persona.identity_summary,
                status=m.persona.status,
            )
            for m in council.members
        ],
    )
