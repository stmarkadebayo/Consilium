from __future__ import annotations

from app.models.persona import PersonaDraft
from app.services.council_service import CouncilService
from app.services.persona_service import PersonaService


def build_profile(name: str) -> dict:
    return {
        "display_name": name,
        "identity_summary": f"{name} identity",
        "domains": ["strategy"],
        "core_beliefs": [f"{name} belief"],
        "priorities": [f"{name} priority"],
        "anti_values": [],
        "decision_patterns": ["first principles"],
        "communication_style": {"tone": "measured"},
        "style_markers": ["precise"],
        "abstention_rules": ["avoids unsupported claims"],
        "confidence_by_topic": {"strategy": 0.9},
        "generated_prompt": f"Prompt for {name}",
    }


def create_ready_draft(db, user, name: str) -> PersonaDraft:
    draft = PersonaDraft(
        user_id=user.id,
        input_name=name,
        persona_type="real_person",
        draft_profile_json=PersonaService.normalize_profile(build_profile(name)),
        review_status="ready",
    )
    db.add(draft)
    db.flush()
    PersonaService.create_draft_revision(
        db,
        draft,
        revision_kind="initial",
        instruction="Initial generated profile",
    )
    db.commit()
    db.refresh(draft)
    return draft


def test_draft_revision_restore_and_approve_flow(client, db, user, monkeypatch):
    draft = create_ready_draft(db, user, "Ada Lovelace")

    def fake_revise_profile(self, **kwargs):
        profile = dict(kwargs["current_profile"])
        profile["identity_summary"] = "Sharper identity summary"
        profile["core_beliefs"] = ["Seek rigor", "Prefer clarity"]
        return profile

    def fake_runtime_prompt(self, profile):
        return f"Runtime prompt for {profile['display_name']}"

    monkeypatch.setattr("app.engines.persona_pipeline.PersonaPipeline.revise_profile", fake_revise_profile)
    monkeypatch.setattr("app.engines.persona_pipeline.PersonaPipeline.generate_runtime_prompt", fake_runtime_prompt)

    revise_response = client.post(f"/personas/drafts/{draft.id}/revise", json={"instruction": "Make it sharper"})
    assert revise_response.status_code == 200
    assert revise_response.json()["draft_profile"]["identity_summary"] == "Sharper identity summary"

    update_response = client.patch(
        f"/personas/drafts/{draft.id}",
        json={
            "draft_profile": {
                "display_name": "Ada Lovelace",
                "identity_summary": "Manual summary",
                "core_beliefs": ["Manual belief"],
                "priorities": ["Manual priority"],
                "anti_values": [],
                "decision_patterns": ["Manual pattern"],
                "communication_style": {"tone": "precise"},
                "style_markers": ["precise"],
                "abstention_rules": ["Manual abstention"],
                "domains": ["mathematics"],
                "confidence_by_topic": {"mathematics": 0.95},
            }
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["draft_profile"]["identity_summary"] == "Manual summary"

    revisions_response = client.get(f"/personas/drafts/{draft.id}/revisions")
    assert revisions_response.status_code == 200
    revisions = revisions_response.json()
    assert [item["revision_kind"] for item in revisions] == ["initial", "ai", "manual"]

    restore_response = client.post(f"/personas/drafts/{draft.id}/revisions/{revisions[0]['id']}/restore")
    assert restore_response.status_code == 200
    assert restore_response.json()["draft_profile"]["identity_summary"] == "Ada Lovelace identity"

    approve_response = client.post(f"/personas/drafts/{draft.id}/approve")
    assert approve_response.status_code == 200
    body = approve_response.json()
    assert body["persona_id"]
    assert body["council_member_id"]

    db.expire_all()
    approved_draft = db.get(PersonaDraft, draft.id)
    assert approved_draft.review_status == "approved"


def test_consult_requires_minimum_active_personas_and_does_not_create_conversation(client, db, user):
    for name in ["Advisor One", "Advisor Two"]:
        PersonaService.create_persona_from_profile(
            db,
            user=user,
            profile=build_profile(name),
            persona_type="real_person",
            add_to_council=True,
        )
    db.commit()

    response = client.post("/conversations/consult", json={"content": "What should I do next?"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "council_min_personas_not_met"

    list_response = client.get("/conversations")
    assert list_response.status_code == 200
    assert list_response.json()["conversations"] == []


def test_council_max_personas_is_enforced_on_approve(client, db, user):
    council = CouncilService.get_or_create_for_user(db, user)
    council.max_personas = 1
    db.add(council)
    db.commit()

    first_draft = create_ready_draft(db, user, "Advisor Prime")
    first_response = client.post(f"/personas/drafts/{first_draft.id}/approve")
    assert first_response.status_code == 200

    second_draft = create_ready_draft(db, user, "Advisor Overflow")
    second_response = client.post(f"/personas/drafts/{second_draft.id}/approve")
    assert second_response.status_code == 400
    assert second_response.json()["detail"]["code"] == "council_max_personas_reached"


def test_delete_persona_reindexes_council_and_updates_onboarding(client, db, user):
    personas = []
    for name in ["Advisor Alpha", "Advisor Beta", "Advisor Gamma"]:
        persona, _ = PersonaService.create_persona_from_profile(
            db,
            user=user,
            profile=build_profile(name),
            persona_type="real_person",
            add_to_council=True,
        )
        personas.append(persona)
    db.commit()

    delete_response = client.post(f"/personas/{personas[1].id}/delete")
    assert delete_response.status_code == 204

    db.expire_all()
    refreshed_user = db.get(type(user), user.id)
    council = CouncilService.get_for_user(db, user.id)
    assert refreshed_user.onboarding_done is False
    assert [member.position for member in council.members] == [0, 1]
    assert [member.persona.display_name for member in council.members] == ["Advisor Alpha", "Advisor Gamma"]
