from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth import resolve_user
from app.config import Settings
from app.main import create_app


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        auth_provider="development",
        auto_run_migrations=True,
        job_runner_enabled=False,
        gemini_api_key="test-key",
    )


@pytest.fixture()
def app(settings: Settings):
    return create_app(settings)


@pytest.fixture()
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db(app):
    with app.state.session_maker() as session:
        yield session


@pytest.fixture()
def user(db, settings: Settings):
    user = resolve_user(db, settings=settings)
    db.commit()
    db.refresh(user)
    return user
