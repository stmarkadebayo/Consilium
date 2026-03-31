from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import DbDep, UserDep
from app.schemas import UserResponse

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=UserResponse)
def get_me(user: UserDep):
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        onboarding_done=user.onboarding_done,
        created_at=user.created_at,
    )
