import pytest
import time
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def headers() -> dict[str, str]:
    return {
        "X-User-External-Id": "test-user",
        "X-User-Email": "test@example.com",
        "X-User-Name": "Test User",
    }


@pytest.fixture
def client(tmp_path) -> TestClient:
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'consilium-test.db'}",
        auto_create_tables=True,
        cors_origins=["http://localhost:3000"],
        job_runner_poll_interval_seconds=0.05,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def wait_for_job_completion(client: TestClient, headers: dict[str, str], job_id: str, timeout_seconds: float = 5.0) -> dict:
    started = time.time()
    while time.time() - started < timeout_seconds:
        response = client.get(f"/jobs/{job_id}", headers=headers)
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] in {"completed", "failed", "cancelled"}:
            return payload
        time.sleep(0.05)
    raise AssertionError("Timed out waiting for job completion")
