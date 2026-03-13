class DummyResponse:
    def __init__(self, text: str, content_type: str = "text/html; charset=utf-8", status_code: int = 200):
        self.text = text
        self.status_code = status_code
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"bad status {self.status_code}")


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


def test_add_source_fetches_content_when_omitted(client, headers, monkeypatch):
    persona_id = create_persona(client, headers, "Importer")

    monkeypatch.setattr(
        "app.services.source_capture_service.httpx.get",
        lambda *args, **kwargs: DummyResponse(
            "<html><head><title>Imported source</title></head><body><p>Durable economics matter.</p></body></html>"
        ),
    )

    response = client.post(
        f"/personas/{persona_id}/sources",
        json={
            "url": "https://example.com/imported",
            "source_type": "reference",
            "quality_score": 0.7,
            "is_primary": False,
        },
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Imported source"
    assert "Durable economics matter" in (body["notes_excerpt"] or "")


def test_capture_prefers_json_ld_and_ignores_script_noise(monkeypatch):
    from app.services.source_capture_service import SourceCaptureService

    monkeypatch.setattr(
        "app.services.source_capture_service.httpx.get",
        lambda *args, **kwargs: DummyResponse(
            """
            <html>
              <head>
                <title>Ignored title</title>
                <meta property="og:title" content="Clean title" />
                <script type="application/ld+json">
                  {"articleBody":"This is the structured article body with durable economics and allocation discipline."}
                </script>
                <script>window.noise = "ignore me";</script>
              </head>
              <body>
                <nav>menu noise</nav>
                <main><p>Visible body text.</p></main>
              </body>
            </html>
            """
        ),
    )

    captured = SourceCaptureService.capture("https://example.com/article")
    assert captured["title"] == "Clean title"
    assert "structured article body" in captured["content"]
    assert "ignore me" not in captured["content"]
    assert "menu noise" not in captured["content"]
