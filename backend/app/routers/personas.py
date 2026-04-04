from __future__ import annotations

from fastapi import APIRouter, Request

from app.dependencies import DbDep, UserDep
from app.schemas import (
    ApproveDraftResponse,
    CreatePersonaDraftRequest,
    PersonaDraftResponse,
    PersonaDraftRevisionResponse,
    PersonaListResponse,
    PersonaResponse,
    RevisePersonaDraftRequest,
    UpdatePersonaDraftRequest,
)
from app.errors import not_found
from app.services.persona_service import PersonaService

router = APIRouter(prefix="/personas", tags=["personas"])


@router.get("", response_model=PersonaListResponse)
def list_personas(user: UserDep, db: DbDep):
    personas = PersonaService.list_personas(db, user.id)
    return PersonaListResponse(personas=[PersonaService.serialize_persona(p) for p in personas])


@router.get("/{persona_id}", response_model=PersonaResponse)
def get_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise not_found("persona_not_found", "Persona not found.")
    return PersonaService.serialize_persona(persona)


@router.delete("/{persona_id}", status_code=204)
def delete_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise not_found("persona_not_found", "Persona not found.")
    PersonaService.delete_persona(db, persona, user=user)


@router.post("/{persona_id}/delete", status_code=204)
def delete_persona_via_post(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise not_found("persona_not_found", "Persona not found.")
    PersonaService.delete_persona(db, persona, user=user)


@router.post("/{persona_id}/deactivate", response_model=PersonaResponse)
def deactivate_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise not_found("persona_not_found", "Persona not found.")
    persona = PersonaService.deactivate_persona(db, persona)
    return PersonaService.serialize_persona(persona)


@router.post("/{persona_id}/activate", response_model=PersonaResponse)
def activate_persona(persona_id: str, user: UserDep, db: DbDep):
    persona = PersonaService.get_persona(db, persona_id, user.id)
    if not persona:
        raise not_found("persona_not_found", "Persona not found.")
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
        raise not_found("draft_not_found", "Draft not found.")
    return _serialize_draft(draft)


@router.patch("/drafts/{draft_id}", response_model=PersonaDraftResponse)
def update_draft(draft_id: str, body: UpdatePersonaDraftRequest, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise not_found("draft_not_found", "Draft not found.")
    draft = PersonaService.update_draft(db, draft, body.draft_profile.model_dump(mode="python"))
    return _serialize_draft(draft)


@router.post("/drafts/{draft_id}/revise", response_model=PersonaDraftResponse)
def revise_draft(
    draft_id: str,
    body: RevisePersonaDraftRequest,
    request: Request,
    user: UserDep,
    db: DbDep,
):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise not_found("draft_not_found", "Draft not found.")
    draft = PersonaService.revise_draft(
        db,
        draft,
        instruction=body.instruction.strip(),
        provider=request.app.state.provider,
    )
    return _serialize_draft(draft)


@router.post("/drafts/{draft_id}/approve", response_model=ApproveDraftResponse)
def approve_draft(draft_id: str, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise not_found("draft_not_found", "Draft not found.")
    persona, member = PersonaService.approve_draft(db, draft, user)
    return ApproveDraftResponse(persona_id=persona.id, council_member_id=member.id if member else None)


@router.get("/drafts/{draft_id}/revisions", response_model=list[PersonaDraftRevisionResponse])
def list_draft_revisions(draft_id: str, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise not_found("draft_not_found", "Draft not found.")
    return [
        PersonaDraftRevisionResponse(
            id=revision.id,
            revision_kind=revision.revision_kind,
            instruction=revision.instruction,
            profile=PersonaService.normalize_profile(revision.profile_json or {}),
            created_at=revision.created_at,
        )
        for revision in PersonaService.list_draft_revisions(draft)
    ]


@router.post("/drafts/{draft_id}/revisions/{revision_id}/restore", response_model=PersonaDraftResponse)
def restore_draft_revision(draft_id: str, revision_id: str, user: UserDep, db: DbDep):
    draft = PersonaService.get_draft(db, draft_id, user.id)
    if not draft:
        raise not_found("draft_not_found", "Draft not found.")
    draft = PersonaService.restore_draft_revision(db, draft, revision_id)
    return _serialize_draft(draft)


def _serialize_draft(draft) -> PersonaDraftResponse:
    return PersonaDraftResponse(
        id=draft.id,
        input_name=draft.input_name,
        persona_type=draft.persona_type,
        custom_brief=draft.custom_brief,
        review_status=draft.review_status,
        draft_profile=PersonaService.normalize_profile(draft.draft_profile_json or {}),
        job_id=draft.job_id,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )
