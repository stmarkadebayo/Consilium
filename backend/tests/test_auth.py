from fastapi import HTTPException

from app.auth import verify_supabase_token
from app.config import Settings


class DummyResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_verify_supabase_token_returns_identity(monkeypatch):
    settings = Settings(
        auth_provider="supabase",
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="anon-key",
    )

    def fake_get(url, headers, timeout):
        assert url == "https://example.supabase.co/auth/v1/user"
        assert headers["Authorization"] == "Bearer test-token"
        return DummyResponse(
            200,
            {
                "id": "user-123",
                "email": "user@example.com",
                "user_metadata": {"full_name": "Test User"},
            },
        )

    monkeypatch.setattr("app.auth.httpx.get", fake_get)

    identity = verify_supabase_token(settings, "test-token")

    assert identity.external_id == "user-123"
    assert identity.email == "user@example.com"
    assert identity.display_name == "Test User"


def test_verify_supabase_token_rejects_invalid_session(monkeypatch):
    settings = Settings(
        auth_provider="supabase",
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="anon-key",
    )

    monkeypatch.setattr(
        "app.auth.httpx.get",
        lambda *args, **kwargs: DummyResponse(401, {"message": "Unauthorized"}),
    )

    try:
        verify_supabase_token(settings, "bad-token")
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 401
