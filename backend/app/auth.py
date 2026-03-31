from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.config import Settings
from app.models.user import User


def resolve_user(db: Session, *, settings: Settings, external_id: str | None = None, email: str | None = None) -> User:
    """Resolve or create a user. Used by both dev bypass and Supabase auth."""
    ext_id = external_id or settings.default_user_external_id

    user = db.query(User).filter(User.external_id == ext_id).first()
    if user:
        return user

    user = User(
        external_id=ext_id,
        email=email or settings.default_user_email,
        display_name=settings.default_user_display_name,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user
