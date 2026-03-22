from app.models.conversation import PersonaResponse, Synthesis


def test_council_query_records_runtime_trace_and_evaluation(client, headers):
    for name in ("Strategist", "Operator", "Skeptic"):
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

    conversation_id = client.post("/conversations", json={"title": "Runtime"}, headers=headers).json()["id"]
    submission = client.post(
        f"/conversations/{conversation_id}/messages",
        json={"content": "Should we invest in this market now?"},
        headers=headers,
    )
    assert submission.status_code == 202

    started_job = submission.json()["job_id"]
    for _attempt in range(100):
        job_response = client.get(f"/jobs/{started_job}", headers=headers)
        payload = job_response.json()
        if payload["status"] in {"completed", "failed", "cancelled"}:
            break
    assert payload["status"] == "completed"

    session = client.app.state.session_maker()
    try:
        responses = session.query(PersonaResponse).all()
        synthesis = session.query(Synthesis).one()
        assert all("runtime_trace" in (row.raw_output_json or {}) for row in responses)
        assert all("response_mode_assessment" in row.raw_output_json["runtime_trace"] for row in responses)
        assert "evaluation" in (synthesis.raw_output_json or {})
        assert synthesis.raw_output_json["runtime_trace"]["engine"] == "council_reasoning_engine_v1"
    finally:
        session.close()
