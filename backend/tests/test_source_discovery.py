import httpx
import time


def wait_for_job_completion(client, headers, job_id: str, timeout_seconds: float = 5.0) -> dict:
    started = time.time()
    while time.time() - started < timeout_seconds:
        response = client.get(f"/jobs/{job_id}", headers=headers)
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] in {"completed", "failed", "cancelled"}:
            return payload
        time.sleep(0.05)
    raise AssertionError("Timed out waiting for job completion")


def test_real_person_draft_seeds_discovered_sources(client, headers, monkeypatch):
    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        lambda *args, **kwargs: [
            {
                "url": "https://example.com/buffett-letters",
                "title": "Berkshire letters",
                "source_type": "official_website",
                "publisher": "berkshirehathaway.com",
                "quality_score": 0.93,
                "is_primary": True,
                "content": "Capital allocation follows durable economics and a margin of safety.",
            },
            {
                "url": "https://example.com/buffett-interview",
                "title": "Buffett interview",
                "source_type": "interview",
                "publisher": "cnbc.com",
                "quality_score": 0.82,
                "is_primary": True,
                "content": "Temperament matters more than IQ in investing.",
            },
        ],
    )

    response = client.post(
        "/personas/drafts",
        json={"input_name": "Warren Buffett", "persona_type": "real_person"},
        headers=headers,
    )
    assert response.status_code == 202
    body = response.json()
    assert body["review_status"] == "generating"
    job = wait_for_job_completion(client, headers, body["job_id"])
    assert job["status"] == "completed"
    body = client.get(f"/personas/drafts/{body['id']}", headers=headers).json()
    assert len(body["sources"]) == 2
    assert body["draft_profile"]["source_count"] == 2
    assert body["draft_profile"]["source_quality_score"] == 0.875
    assert any("Limited evidence available" in warning for warning in body["draft_profile"]["warnings"])
    assert not any("Primary-source coverage is weak" in warning for warning in body["draft_profile"]["warnings"])


def test_real_person_draft_surfaces_warning_when_discovery_fails(client, headers, monkeypatch):
    def raise_http_error(*args, **kwargs):
        request = httpx.Request("GET", "https://duckduckgo.com/html/")
        response = httpx.Response(503, request=request)
        raise httpx.HTTPStatusError("service unavailable", request=request, response=response)

    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        raise_http_error,
    )

    response = client.post(
        "/personas/drafts",
        json={"input_name": "Charlie Munger", "persona_type": "real_person"},
        headers=headers,
    )
    assert response.status_code == 202
    payload = response.json()
    job = wait_for_job_completion(client, headers, payload["job_id"])
    assert job["status"] == "failed"
    warnings = client.get(f"/personas/drafts/{payload['id']}", headers=headers).json()["draft_profile"].get("warnings", [])
    assert any("Automated source discovery failed" in warning for warning in warnings)
