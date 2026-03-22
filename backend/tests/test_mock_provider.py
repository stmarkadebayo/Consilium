from app.providers.base import MockProvider


def test_mock_provider_classifies_answer_with_strong_grounding():
    provider = MockProvider()

    result = provider.classify_response_mode(
        {
            "display_name": "Operator",
            "source_count": 6,
            "source_quality_score": 0.84,
        },
        "Should we launch this quarter?",
        [
            {"chunk_text": "Demand is visible.", "score": 0.82},
            {"chunk_text": "Retention is improving.", "score": 0.79},
        ],
    )

    assert result["response_type"] == "answer"
    assert result["basis_score"] > 0.8


def test_mock_provider_respects_no_basis_generation_mode():
    provider = MockProvider()

    result = provider.generate_persona_response(
        {"display_name": "Generalist"},
        "Should we redesign the chip architecture?",
        [],
        expected_response_type="no_basis",
    )

    assert result["response_type"] == "no_basis"
    assert result["confidence"] < 0.3
