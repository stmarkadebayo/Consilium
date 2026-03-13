def create_persona(client, headers, name: str) -> str:
    response = client.post(
        "/personas",
        json={
            "display_name": name,
            "persona_type": "custom",
            "identity_summary": f"{name} is grounded in explicit source material.",
            "worldview": [f"{name} values validation before commitment"],
            "communication_style": ["concise"],
            "decision_style": ["structured"],
            "values": ["clarity"],
            "blind_spots": ["may move slowly"],
            "domain_confidence": {"general_reasoning": 0.7},
            "source_count": 0,
            "source_quality_score": 0.3,
            "add_to_council": False,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_add_and_list_persona_sources(client, headers):
    persona_id = create_persona(client, headers, "Archivist")

    create_response = client.post(
        f"/personas/{persona_id}/sources",
        json={
            "url": "https://example.com/interview",
            "title": "Founder interview",
            "source_type": "interview",
            "publisher": "Example FM",
            "quality_score": 0.81,
            "is_primary": True,
            "content": "The founder says hiring should follow clear demand, not hope.",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    assert create_response.json()["chunk_count"] >= 1

    list_response = client.get(f"/personas/{persona_id}/sources", headers=headers)
    assert list_response.status_code == 200
    body = list_response.json()
    assert len(body["sources"]) == 1
    assert body["sources"][0]["title"] == "Founder interview"
    assert "clear demand" in (body["sources"][0]["notes_excerpt"] or "")

    persona_response = client.get(f"/personas/{persona_id}", headers=headers)
    assert persona_response.status_code == 200
    assert persona_response.json()["source_count"] == 1
