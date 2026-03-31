from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.dependencies import DbDep, UserDep
from app.schemas import (
    CreatePersonaDraftRequest,
    PersonaDraftResponse,
    PersonaResponse,
    UpdatePersonaDraftRequest,
)
from app.services.persona_service import PersonaService

router = APIRouter(prefix="/personas", tags=["personas"])


@router.get("", response_model=dict)
def list_personas(user: UserDep, db: DbDep):
    personas = PersonaService.list_personas(db, user.id)
    return {"personas": [PersonaService.serialize_persona(p) for p in personas]}


@router.get("/{persona_id}", response_model=PersonaResponse)
def get_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    return PersonaService.serialize_persona(persona)


@router.post("/{persona_id}/deactivate", response_model=PersonaResponse)
def deactivate_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    persona = PersonaService.deactivate_persona(db, persona)
    return PersonaService.serialize_persona(persona)


@router.post("/{persona_id}/activate", response_model=PersonaResponse)
def activate_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    persona = PersonaService.activate_persona(db, persona)
    return PersonaService.serialize_persona(persona)


# --- Drafts ---

@router.post("/drafts", response_model=PersonaDraftResponse)
def create_draft(body: CreatePersonaDraftRequest, user: UserDep, db: DbDep):
    draft = PersonaService.create_draft(
        db,
        user=user,
        input_name=body.input_name,
        persona_type=body.persona_type,
        custom_brief=body.custom_brief,
    )
    return _serialize_draft(draft)


@router.get("/drafts/{draft_id}", response_model=PersonaDraftResponse)
def get_draft(draft_id: str, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _serialize_draft(draft)


@router.patch("/drafts/{draft_id}", response_model=PersonaDraftResponse)
def update_draft(draft_id: str, body: UpdatePersonaDraftRequest, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    try:
        draft = PersonaService.update_draft(db, draft, body.draft_profile)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _serialize_draft(draft)


@router.post("/drafts/{draft_id}/approve")
def approve_draft(draft_id: str, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.review_status != "ready":
        raise HTTPException(status_code=400, detail=f"Draft is not ready for approval (status: {draft.review_status})")
    persona, member = PersonaService.approve_draft(db, draft, user)
    return {
        "persona_id": persona.id,
        "council_member_id": member.id if member else None,
    }


def _serialize_draft(draft) -> PersonaDraftResponse:
    return PersonaDraftResponse(
        id=draft.id,
        input_name=draft.input_name,
        persona_type=draft.persona_type,
        custom_brief=draft.custom_brief,
        review_status=draft.review_status,
        draft_profile=draft.draft_profile_json or {},
        job_id=draft.job_id,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )
