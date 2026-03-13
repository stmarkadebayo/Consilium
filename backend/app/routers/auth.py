from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
