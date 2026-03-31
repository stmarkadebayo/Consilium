from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import resolve_user
from app.config import Settings
from app.models.user import User


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request):
    session_maker = request.app.state.session_maker
    with session_maker() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Extract the current user from the request.

    In development mode, auto-creates a dev user.
    In production, validates the Supabase JWT.
    """
    if settings.auth_provider == "development":
        return resolve_user(db, settings=settings)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header[7:]

    try:
        from jose import jwt
        # For Supabase, we verify the JWT and extract the sub claim
        payload = jwt.decode(
            token,
            settings.app_secret_key,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        external_id = payload.get("sub")
        email = payload.get("email")
        if not external_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")
        return resolve_user(db, settings=settings, external_id=external_id, email=email)
    except Exception as error:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {error}") from error


# Type aliases for dependency injection
SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]
