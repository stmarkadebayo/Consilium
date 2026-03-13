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


def create_persona(client, headers, name: str) -> str:
    response = client.post(
        "/personas",
        json={
            "display_name": name,
            "persona_type": "custom",
            "identity_summary": f"{name} is a council member",
            "worldview": [f"{name} worldview"],
            "communication_style": ["concise"],
            "decision_style": ["structured"],
            "values": ["clarity"],
            "blind_spots": ["speed bias"],
            "domain_confidence": {"general_reasoning": 0.7},
            "source_count": 0,
            "source_quality_score": 0.3,
            "add_to_council": True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_council_query_runs_end_to_end(client, headers):
    create_persona(client, headers, "Strategist")
    create_persona(client, headers, "Operator")
    create_persona(client, headers, "Skeptic")

    conversation_response = client.post("/conversations", json={"title": "Fundraising"}, headers=headers)
    assert conversation_response.status_code == 201
    conversation_id = conversation_response.json()["id"]

    message_response = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"content": "Should I raise a seed round now?"},
        headers=headers,
    )
    assert message_response.status_code == 202
    job_id = message_response.json()["job_id"]

    job_response = wait_for_job_completion(client, headers, job_id)
    assert job_response["status"] == "completed"

    detail_response = client.get(f"/conversations/{conversation_id}", headers=headers)
    assert detail_response.status_code == 200

    body = detail_response.json()
    assert len(body["turns"]) == 1
    assert len(body["turns"][0]["persona_responses"]) == 3
    assert body["turns"][0]["synthesis"]["next_step"]
    assert any(item["evidence_snippets"] for item in body["turns"][0]["persona_responses"])


def test_council_query_handles_partial_failure(client, headers):
    create_persona(client, headers, "Strategist")
    create_persona(client, headers, "Force-Failure Advisor")
    create_persona(client, headers, "Skeptic")

    conversation_id = client.post("/conversations", json={"title": "Hiring"}, headers=headers).json()["id"]
    response = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"content": "Should I hire a senior engineer this quarter?"},
        headers=headers,
    )
    assert response.status_code == 202
    wait_for_job_completion(client, headers, response.json()["job_id"])

    detail = client.get(f"/conversations/{conversation_id}", headers=headers).json()
    persona_responses = detail["turns"][0]["persona_responses"]

    assert len(persona_responses) == 3
    assert any(item["status"] == "failed" for item in persona_responses)
    assert detail["turns"][0]["synthesis"]["combined_recommendation"]


def test_council_query_requires_minimum_active_personas(client, headers):
    create_persona(client, headers, "Strategist")
    create_persona(client, headers, "Operator")

    conversation_id = client.post("/conversations", json={"title": "Launch"}, headers=headers).json()["id"]
    response = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"content": "Should we launch next week?"},
        headers=headers,
    )
    assert response.status_code == 409
    assert "At least 3 active personas" in response.json()["detail"]
