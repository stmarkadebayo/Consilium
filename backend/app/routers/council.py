from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.council import CouncilMemberRead, CouncilRead, CouncilUpdate
from app.services.council_service import CouncilService

router = APIRouter(tags=["council"])


def serialize_council(council) -> CouncilRead:
    members = [
        CouncilMemberRead(
            id=member.id,
            persona_id=member.persona_id,
            display_name=member.persona.display_name,
            persona_type=member.persona.persona_type,
            position=member.position,
            is_active=member.is_active,
        )
        for member in council.members
    ]
    return CouncilRead(
        id=council.id,
        name=council.name,
        min_personas=council.min_personas,
        max_personas=council.max_personas,
        created_at=council.created_at,
        updated_at=council.updated_at,
        members=members,
    )


@router.get("/council", response_model=CouncilRead)
def get_council(db=Depends(get_db), current_user: User = Depends(get_current_user)) -> CouncilRead:
    council = CouncilService.get_or_create_for_user(db, current_user)
    db.commit()
    db.refresh(council)
    return serialize_council(council)


@router.patch("/council", response_model=CouncilRead)
def update_council(
    payload: CouncilUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CouncilRead:
    council = CouncilService.get_or_create_for_user(db, current_user)
    council = CouncilService.update_name(db, council, payload.name)
    db.commit()
    db.refresh(council)
    return serialize_council(council)
