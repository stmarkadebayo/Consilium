import time
import httpx


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


def test_persona_draft_can_be_created_updated_and_approved(client, headers, monkeypatch):
    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        lambda *args, **kwargs: [
            {
                "url": "https://example.com/naval-interview",
                "title": "Naval interview",
                "source_type": "interview",
                "publisher": "example.com",
                "quality_score": 0.81,
                "is_primary": True,
                "content": "Leverage and judgment matter more than brute-force effort over long horizons.",
            }
        ],
    )
    create_response = client.post(
        "/personas/drafts",
        json={
            "input_name": "Naval Ravikant",
            "persona_type": "real_person",
        },
        headers=headers,
    )
    assert create_response.status_code == 202
    draft_id = create_response.json()["id"]
    job_id = create_response.json()["job_id"]
    assert create_response.json()["review_status"] == "generating"

    job = wait_for_job_completion(client, headers, job_id)
    assert job["status"] == "completed"

    draft_response = client.get(f"/personas/drafts/{draft_id}", headers=headers)
    assert draft_response.status_code == 200
    assert draft_response.json()["review_status"] == "ready"
    assert len(draft_response.json()["sources"]) == 1

    update_response = client.patch(
        f"/personas/drafts/{draft_id}",
        json={"draft_profile": {"identity_summary": "Investor focused on leverage."}},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["draft_profile"]["identity_summary"] == "Investor focused on leverage."

    approve_response = client.post(f"/personas/drafts/{draft_id}/approve", headers=headers)
    assert approve_response.status_code == 201
    persona_id = approve_response.json()["persona_id"]

    persona_response = client.get(f"/personas/{persona_id}", headers=headers)
    assert persona_response.status_code == 200
    assert persona_response.json()["display_name"] == "Naval Ravikant"

    council_response = client.get("/council", headers=headers)
    assert council_response.status_code == 200
    assert len(council_response.json()["members"]) == 1


def test_generating_draft_cannot_be_edited_or_extended(client, headers, monkeypatch):
    def slow_discovery(*args, **kwargs):
        time.sleep(0.3)
        return []

    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        slow_discovery,
    )

    create_response = client.post(
        "/personas/drafts",
        json={"input_name": "Charlie Munger", "persona_type": "real_person"},
        headers=headers,
    )
    assert create_response.status_code == 202
    draft_id = create_response.json()["id"]

    update_response = client.patch(
        f"/personas/drafts/{draft_id}",
        json={"draft_profile": {"identity_summary": "Should not save while generating"}},
        headers=headers,
    )
    assert update_response.status_code == 409
    assert update_response.json()["detail"] == "Draft is still generating"

    source_response = client.post(
        f"/personas/drafts/{draft_id}/sources",
        json={
            "url": "https://example.com/manual-source",
            "title": "Manual source",
            "source_type": "interview",
            "publisher": "example.com",
            "quality_score": 0.7,
            "content": "Manual source content.",
        },
        headers=headers,
    )
    assert source_response.status_code == 409
    assert source_response.json()["detail"] == "Draft is still generating"

    job = wait_for_job_completion(client, headers, create_response.json()["job_id"])
    assert job["status"] == "completed"


def test_failed_draft_can_be_edited_and_approved_manually(client, headers, monkeypatch):
    def raise_http_error(*args, **kwargs):
        request = httpx.Request("GET", "https://duckduckgo.com/html/")
        response = httpx.Response(503, request=request)
        raise httpx.HTTPStatusError("service unavailable", request=request, response=response)

    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        raise_http_error,
    )

    create_response = client.post(
        "/personas/drafts",
        json={"input_name": "Charlie Munger", "persona_type": "real_person"},
        headers=headers,
    )
    assert create_response.status_code == 202
    draft_id = create_response.json()["id"]
    job_id = create_response.json()["job_id"]

    job = wait_for_job_completion(client, headers, job_id)
    assert job["status"] == "failed"

    update_response = client.patch(
        f"/personas/drafts/{draft_id}",
        json={"draft_profile": {"identity_summary": "Manual review completed."}},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["review_status"] == "ready"

    source_response = client.post(
        f"/personas/drafts/{draft_id}/sources",
        json={
            "url": "https://example.com/munger-manual-source",
            "title": "Manual source",
            "source_type": "interview",
            "publisher": "example.com",
            "quality_score": 0.82,
            "is_primary": True,
            "content": "Rationality compounds when incentives are understood clearly.",
        },
        headers=headers,
    )
    assert source_response.status_code == 201

    approve_response = client.post(f"/personas/drafts/{draft_id}/approve", headers=headers)
    assert approve_response.status_code == 201


def test_replace_real_person_queues_and_completes_new_draft(client, headers, monkeypatch):
    persona_response = client.post(
        "/personas",
        json={
            "display_name": "Placeholder Persona",
            "persona_type": "custom",
            "identity_summary": "Placeholder",
            "worldview": [],
            "communication_style": [],
            "decision_style": [],
            "values": [],
            "blind_spots": [],
            "domain_confidence": {},
        },
        headers=headers,
    )
    assert persona_response.status_code == 201
    persona_id = persona_response.json()["id"]

    monkeypatch.setattr(
        "app.services.source_discovery_service.SourceDiscoveryService.discover_sources",
        lambda *args, **kwargs: [
            {
                "url": "https://example.com/naval-interview",
                "title": "Naval interview",
                "source_type": "interview",
                "publisher": "example.com",
                "quality_score": 0.81,
                "is_primary": True,
                "content": "Specific knowledge and leverage matter.",
            }
        ],
    )

    replace_response = client.post(
        f"/personas/{persona_id}/replace",
        json={"new_input_name": "Naval Ravikant", "new_persona_type": "real_person"},
        headers=headers,
    )
    assert replace_response.status_code == 202
    payload = replace_response.json()
    assert payload["review_status"] == "generating"

    job = wait_for_job_completion(client, headers, payload["job_id"])
    assert job["status"] == "completed"

    draft_response = client.get(f"/personas/drafts/{payload['id']}", headers=headers)
    assert draft_response.status_code == 200
    assert draft_response.json()["review_status"] == "ready"
    assert len(draft_response.json()["sources"]) == 1

    old_persona_response = client.get(f"/personas/{persona_id}", headers=headers)
    assert old_persona_response.status_code == 200
    assert old_persona_response.json()["status"] == "replaced"
