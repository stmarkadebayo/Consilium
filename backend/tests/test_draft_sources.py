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


def test_draft_sources_copy_into_approved_persona(client, headers, monkeypatch):
    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        lambda *args, **kwargs: [],
    )
    draft_response = client.post(
        "/personas/drafts",
        json={
          "input_name": "Warren Buffett",
          "persona_type": "real_person",
          "custom_brief": "Value investor focused on disciplined capital allocation.",
        },
        headers=headers,
    )
    assert draft_response.status_code == 202
    draft_id = draft_response.json()["id"]
    job_id = draft_response.json()["job_id"]

    job = wait_for_job_completion(client, headers, job_id)
    assert job["status"] == "completed"

    source_response = client.post(
        f"/personas/drafts/{draft_id}/sources",
        json={
            "url": "https://example.com/shareholder-letters",
            "title": "Shareholder letters",
            "source_type": "official_website",
            "publisher": "Berkshire Hathaway",
            "quality_score": 0.92,
            "is_primary": True,
            "content": "Capital allocation should follow durable economics and a margin of safety.",
        },
        headers=headers,
    )
    assert source_response.status_code == 201

    approve_response = client.post(f"/personas/drafts/{draft_id}/approve", headers=headers)
    assert approve_response.status_code == 201
    persona_id = approve_response.json()["persona_id"]

    persona_response = client.get(f"/personas/{persona_id}", headers=headers)
    assert persona_response.status_code == 200
    assert persona_response.json()["source_count"] == 1

    list_response = client.get(f"/personas/{persona_id}/sources", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()["sources"]) == 1
    assert list_response.json()["sources"][0]["title"] == "Shareholder letters"
