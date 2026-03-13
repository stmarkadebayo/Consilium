from app.models.persona import PersonaSourceChunk
from app.services.retrieval_service import RetrievalService


def test_create_persona_indexes_profile_source(client, headers):
    response = client.post(
        "/personas",
        json={
            "display_name": "Allocator",
            "persona_type": "custom",
            "identity_summary": "Allocator is disciplined about capital allocation.",
            "worldview": ["capital allocation discipline", "long-term compounding"],
            "communication_style": ["concise"],
            "decision_style": ["structured"],
            "values": ["clarity"],
            "blind_spots": ["may underweight speed"],
            "domain_confidence": {"investing": 0.8},
            "source_count": 0,
            "source_quality_score": 0.5,
            "add_to_council": True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    persona_id = response.json()["id"]

    session = client.app.state.session_maker()
    try:
        chunks = session.query(PersonaSourceChunk).filter(PersonaSourceChunk.persona_id == persona_id).all()
        assert len(chunks) >= 1
        assert any("capital allocation" in chunk.chunk_text.lower() for chunk in chunks)
    finally:
        session.close()


def test_retrieval_service_returns_relevant_chunk(client, headers):
    response = client.post(
        "/personas",
        json={
            "display_name": "Operator",
            "persona_type": "custom",
            "identity_summary": "Operator favors hiring only when customer demand justifies it.",
            "worldview": ["hire against validated demand", "protect burn multiple"],
            "communication_style": ["direct"],
            "decision_style": ["evidence aware"],
            "values": ["clarity"],
            "blind_spots": ["may move too slowly"],
            "domain_confidence": {"hiring": 0.76},
            "source_count": 0,
            "source_quality_score": 0.6,
            "add_to_council": False,
        },
        headers=headers,
    )
    assert response.status_code == 201
    persona_id = response.json()["id"]

    session = client.app.state.session_maker()
    try:
        retrieval_service = RetrievalService(client.app.state.settings)
        evidence = retrieval_service.retrieve_evidence(
            session,
            persona_id=persona_id,
            prompt="Should we hire now or wait for validated demand?",
        )
        assert len(evidence) >= 1
        assert "validated demand" in evidence[0]["chunk_text"].lower()
    finally:
        session.close()
