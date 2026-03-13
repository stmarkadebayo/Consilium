from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx
from fastapi import HTTPException, status

from app.config import Settings


@dataclass
class AuthenticatedIdentity:
    external_id: str
    email: str
    display_name: str
    raw_user: dict[str, Any]


def _derive_display_name(payload: dict[str, Any]) -> str:
    metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}
    candidates = [
        metadata.get("full_name"),
        metadata.get("name"),
        metadata.get("display_name"),
        app_metadata.get("provider"),
        payload.get("email"),
    ]
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return "Consilium User"


def verify_supabase_token(settings: Settings, bearer_token: Optional[str]) -> AuthenticatedIdentity:
    if not bearer_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase auth is not configured on the server",
        )

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    try:
        response = httpx.get(
            url,
            headers={
                "apikey": settings.supabase_publishable_key,
                "Authorization": f"Bearer {bearer_token}",
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase auth service is unavailable",
        ) from exc

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase session",
        )

    payload = response.json()
    external_id = payload.get("id")
    email = payload.get("email")

    if not external_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase user payload is missing required fields",
        )

    return AuthenticatedIdentity(
        external_id=external_id,
        email=email,
        display_name=_derive_display_name(payload),
        raw_user=payload,
    )
