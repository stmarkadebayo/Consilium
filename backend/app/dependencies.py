from __future__ import annotations

from typing import Generator, Optional

from fastapi import Depends, Header, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import verify_supabase_token
from app.config import Settings
from app.models.user import User
from app.services.council_service import CouncilService


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Generator[Session, None, None]:
    session_maker = request.app.state.session_maker
    db = session_maker()
    try:
        yield db
    finally:
        db.close()


def get_provider(request: Request):
    return request.app.state.provider


def get_retrieval_service(request: Request):
    return request.app.state.retrieval_service


def get_current_user(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    authorization: Optional[str] = Header(default=None),
    x_user_external_id: Optional[str] = Header(default=None),
    x_user_email: Optional[str] = Header(default=None),
    x_user_name: Optional[str] = Header(default=None),
) -> User:
    if settings.auth_provider == "supabase":
        bearer_token = None
        if authorization and authorization.lower().startswith("bearer "):
            bearer_token = authorization.split(" ", 1)[1].strip()
        identity = verify_supabase_token(settings, bearer_token)
        external_id = identity.external_id
        email = identity.email
        display_name = identity.display_name
    else:
        external_id = x_user_external_id or settings.default_user_external_id
        email = x_user_email or settings.default_user_email
        display_name = x_user_name or settings.default_user_display_name

    user = (
        db.query(User)
        .filter((User.external_id == external_id) | (User.email == email))
        .first()
    )
    if user is None:
        user = User(external_id=external_id, email=email, display_name=display_name)
        db.add(user)
        try:
            db.flush()
            CouncilService.get_or_create_for_user(db, user)
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            db.rollback()
            user = (
                db.query(User)
                .filter((User.external_id == external_id) | (User.email == email))
                .first()
            )
            if user is None:
                raise

    user.external_id = external_id
    if email and user.email != email:
        user.email = email
    if display_name and user.display_name != display_name:
        user.display_name = display_name
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
