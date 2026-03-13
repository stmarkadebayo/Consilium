import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.dependencies import get_current_user, get_db, get_retrieval_service
from app.models.user import User
from app.schemas.persona import (
    PersonaApproveRead,
    PersonaCreate,
    PersonaDraftCreate,
    PersonaDraftRead,
    PersonaSourceCreate,
    PersonaSourceListRead,
    PersonaSourceRead,
    PersonaDraftUpdate,
    PersonaListRead,
    PersonaRead,
    PersonaReplaceRequest,
    PersonaUpdate,
)
from app.services.persona_service import PersonaService

router = APIRouter(prefix="/personas", tags=["personas"])


def serialize_persona(persona) -> PersonaRead:
    return PersonaRead(
        id=persona.id,
        display_name=persona.display_name,
        persona_type=persona.persona_type,
        identity_summary=persona.identity_summary,
        worldview=persona.worldview_json,
        communication_style=persona.communication_style_json,
        decision_style=persona.decision_style_json,
        values=persona.values_json,
        blind_spots=persona.blind_spots_json,
        domain_confidence=persona.domain_confidence_json,
        source_count=persona.source_count,
        source_quality_score=persona.source_quality_score,
        status=persona.status,
        created_at=persona.created_at,
        updated_at=persona.updated_at,
    )


def serialize_draft(draft) -> PersonaDraftRead:
    sources = [
        serialize_source(source)
        for source in draft.sources
    ]
    return PersonaDraftRead(
        id=draft.id,
        job_id=draft.job_id,
        input_name=draft.input_name,
        persona_type=draft.persona_type,
        review_status=draft.review_status,
        draft_profile=draft.draft_profile_json,
        sources=sources,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )


def serialize_source(source) -> PersonaSourceRead:
    notes = source.notes_json or {}
    return PersonaSourceRead(
        id=source.id,
        url=source.url,
        title=source.title,
        source_type=source.source_type,
        publisher=source.publisher,
        quality_score=source.quality_score,
        is_primary=source.is_primary,
        notes_excerpt=(notes.get("excerpt") or notes.get("content", ""))[:220] or None,
        chunk_count=len(source.chunks or []),
    )


@router.post("", response_model=PersonaRead, status_code=status.HTTP_201_CREATED)
def create_persona(
    payload: PersonaCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
    retrieval_service=Depends(get_retrieval_service),
) -> PersonaRead:
    try:
        persona, _member = PersonaService.create_persona(
            db,
            user=current_user,
            persona_payload=payload.model_dump(exclude={"persona_type", "add_to_council"}),
            persona_type=payload.persona_type,
            add_to_council=payload.add_to_council,
            retrieval_service=retrieval_service,
        )
        db.commit()
        db.refresh(persona)
        return serialize_persona(persona)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/drafts", response_model=PersonaDraftRead, status_code=status.HTTP_202_ACCEPTED)
def create_draft(
    payload: PersonaDraftCreate,
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaDraftRead:
    draft = PersonaService.create_draft(
        db,
        user=current_user,
        input_name=payload.input_name,
        persona_type=payload.persona_type,
        custom_brief=payload.custom_brief,
    )
    db.commit()
    db.refresh(draft)
    request.app.state.job_runner.notify()
    return serialize_draft(draft)


@router.get("/drafts/{draft_id}", response_model=PersonaDraftRead)
def get_draft(draft_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)) -> PersonaDraftRead:
    draft = PersonaService.get_draft(db, draft_id, current_user.id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    return serialize_draft(draft)


@router.patch("/drafts/{draft_id}", response_model=PersonaDraftRead)
def update_draft(
    draft_id: str,
    payload: PersonaDraftUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaDraftRead:
    draft = PersonaService.get_draft(db, draft_id, current_user.id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    try:
        draft = PersonaService.update_draft(db, draft, payload.draft_profile)
        db.commit()
        db.refresh(draft)
        return serialize_draft(draft)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/drafts/{draft_id}/sources", response_model=PersonaSourceRead, status_code=status.HTTP_201_CREATED)
def add_draft_source(
    draft_id: str,
    payload: PersonaSourceCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaSourceRead:
    draft = PersonaService.get_draft(db, draft_id, current_user.id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    try:
        source = PersonaService.add_draft_source(db, draft=draft, source_payload=payload.model_dump())
        db.commit()
        db.refresh(source)
        return serialize_source(source)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except httpx.HTTPError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch source URL: {error}") from error


@router.post("/drafts/{draft_id}/approve", response_model=PersonaApproveRead, status_code=status.HTTP_201_CREATED)
def approve_draft(
    draft_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
    retrieval_service=Depends(get_retrieval_service),
) -> PersonaApproveRead:
    draft = PersonaService.get_draft(db, draft_id, current_user.id)
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    if draft.review_status != "ready":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Draft is not ready for approval")
    try:
        persona, member = PersonaService.approve_draft(db, draft, current_user, retrieval_service=retrieval_service)
        db.commit()
        return PersonaApproveRead(persona_id=persona.id, council_member_id=member.id if member else None)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("", response_model=PersonaListRead)
def list_personas(db=Depends(get_db), current_user: User = Depends(get_current_user)) -> PersonaListRead:
    personas = PersonaService.list_personas(db, current_user.id)
    return PersonaListRead(personas=[serialize_persona(persona) for persona in personas])


@router.get("/{persona_id}/sources", response_model=PersonaSourceListRead)
def list_persona_sources(
    persona_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaSourceListRead:
    persona = PersonaService.get_persona(db, persona_id, current_user.id)
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    sources = PersonaService.list_sources(db, persona=persona)
    return PersonaSourceListRead(sources=[serialize_source(source) for source in sources])


@router.post("/{persona_id}/sources", response_model=PersonaSourceRead, status_code=status.HTTP_201_CREATED)
def add_persona_source(
    persona_id: str,
    payload: PersonaSourceCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
    retrieval_service=Depends(get_retrieval_service),
) -> PersonaSourceRead:
    persona = PersonaService.get_persona(db, persona_id, current_user.id)
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    try:
        source = PersonaService.add_source(
            db,
            persona=persona,
            source_payload=payload.model_dump(),
            retrieval_service=retrieval_service,
        )
        db.commit()
        db.refresh(source)
        return serialize_source(source)
    except httpx.HTTPError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch source URL: {error}") from error


@router.get("/{persona_id}", response_model=PersonaRead)
def get_persona(persona_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)) -> PersonaRead:
    persona = PersonaService.get_persona(db, persona_id, current_user.id)
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    return serialize_persona(persona)


@router.patch("/{persona_id}", response_model=PersonaRead)
def update_persona(
    persona_id: str,
    payload: PersonaUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
    retrieval_service=Depends(get_retrieval_service),
) -> PersonaRead:
    persona = PersonaService.get_persona(db, persona_id, current_user.id)
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    persona = PersonaService.update_persona(
        db,
        persona,
        payload.model_dump(exclude_unset=True),
        retrieval_service=retrieval_service,
    )
    db.commit()
    db.refresh(persona)
    return serialize_persona(persona)


@router.post("/{persona_id}/deactivate", response_model=PersonaRead)
def deactivate_persona(persona_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)) -> PersonaRead:
    persona = PersonaService.get_persona(db, persona_id, current_user.id)
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    try:
        persona = PersonaService.deactivate_persona(db, persona)
        db.commit()
        db.refresh(persona)
        return serialize_persona(persona)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.post("/{persona_id}/replace", response_model=PersonaDraftRead, status_code=status.HTTP_202_ACCEPTED)
def replace_persona(
    persona_id: str,
    payload: PersonaReplaceRequest,
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PersonaDraftRead:
    persona = PersonaService.get_persona(db, persona_id, current_user.id)
    if persona is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona not found")
    draft = PersonaService.replace_persona(
        db,
        user=current_user,
        old_persona=persona,
        input_name=payload.new_input_name,
        persona_type=payload.new_persona_type,
        custom_brief=payload.custom_brief,
    )
    db.commit()
    db.refresh(draft)
    request.app.state.job_runner.notify()
    return serialize_draft(draft)
