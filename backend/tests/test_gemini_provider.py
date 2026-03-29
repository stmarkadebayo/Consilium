from app.providers.gemini import GeminiProvider


class DummyResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_generate_persona_response_parses_structured_json(monkeypatch):
    provider = GeminiProvider(api_key="test-key", model="gemini-2.5-flash")

    def fake_post(url, headers, json, timeout):
        assert url.endswith("/models/gemini-2.5-flash:generateContent")
        assert headers["x-goog-api-key"] == "test-key"
        assert json["generationConfig"]["responseMimeType"] == "application/json"
        return DummyResponse(
            200,
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        '{"response_type":"inference","verdict":"Wait for signal.",'
                                        '"reasoning":"Demand quality evidence first.",'
                                        '"recommended_action":"Run two customer calls.",'
                                        '"confidence":0.82,"status":"completed"}'
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("app.providers.gemini.httpx.post", fake_post)

    result = provider.generate_persona_response(
        {
            "display_name": "Operator",
            "identity_summary": "Grounded operator",
            "worldview": ["evidence first"],
            "communication_style": ["direct"],
            "decision_style": ["structured"],
            "values": ["clarity"],
            "blind_spots": ["speed bias"],
        },
        "Should we launch this quarter?",
    )

    assert result["response_type"] == "inference"
    assert result["status"] == "completed"
    assert result["confidence"] == 0.82


def test_classify_response_mode_parses_structured_json(monkeypatch):
    provider = GeminiProvider(api_key="test-key", model="gemini-2.5-flash")

    monkeypatch.setattr(
        "app.providers.gemini.httpx.post",
        lambda *args, **kwargs: DummyResponse(
            200,
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        '{"response_type":"no_basis","basis_score":0.19,'
                                        '"reasoning":"The evidence is too thin."}'
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        ),
    )

    result = provider.classify_response_mode(
        {"display_name": "Operator", "grounding_profile": {"grounding_tier": "thin"}},
        "Should we enter this market?",
        [],
    )

    assert result["response_type"] == "no_basis"
    assert result["basis_score"] == 0.19


def test_generate_persona_response_normalizes_unexpected_response_type(monkeypatch):
    provider = GeminiProvider(api_key="test-key", model="gemini-2.5-flash")

    monkeypatch.setattr(
        "app.providers.gemini.httpx.post",
        lambda *args, **kwargs: DummyResponse(
            200,
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": (
                                        '{"response_type":"strategic_advice","verdict":"Wait for signal.",'
                                        '"reasoning":"Demand quality evidence first.",'
                                        '"recommended_action":"Run two customer calls.",'
                                        '"confidence":0.82,"status":"completed"}'
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        ),
    )

    result = provider.generate_persona_response(
        {
            "display_name": "Operator",
            "identity_summary": "Grounded operator",
            "worldview": ["evidence first"],
            "communication_style": ["direct"],
            "decision_style": ["structured"],
            "values": ["clarity"],
            "blind_spots": ["speed bias"],
        },
        "Should we launch this quarter?",
    )

    assert result["response_type"] == "inference"


def test_generate_synthesis_falls_back_cleanly_on_provider_error(monkeypatch):
    provider = GeminiProvider(api_key="test-key", model="gemini-2.5-flash")

    monkeypatch.setattr(
        "app.providers.gemini.httpx.post",
        lambda *args, **kwargs: DummyResponse(429, {"error": {"message": "Rate limit exceeded"}}),
    )

    result = provider.generate_synthesis(
        "Should we hire now?",
        [
            {
                "persona_name": "Strategist",
                "verdict": "Wait",
                "reasoning": "Need stronger signal",
                "recommended_action": "Interview users",
                "confidence": 0.7,
            }
        ],
    )

    assert result["agreements"] == []
    assert result["disagreements"] == []
    assert result["next_step"] == "Interview users"
    assert result["combined_recommendation"] == "Wait"
