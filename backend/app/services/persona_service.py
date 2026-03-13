from __future__ import annotations

import logging
from typing import Optional, Tuple

import httpx
from sqlalchemy.orm import Session, joinedload

from app.graphs.persona_creation import build_persona_draft
from app.models.council import CouncilMember
from app.models.job import Job
from app.models.persona import Persona, PersonaDraft, PersonaSnapshot, PersonaSource
from app.models.user import User
from app.services.council_service import CouncilService
from app.services.job_service import JobService
from app.services.source_capture_service import SourceCaptureService
from app.services.source_discovery_service import SourceDiscoveryService

logger = logging.getLogger(__name__)


class PersonaService:
    @staticmethod
    def list_personas(db: Session, user_id: str) -> list[Persona]:
        return db.query(Persona).filter(Persona.user_id == user_id).order_by(Persona.created_at.asc()).all()

    @staticmethod
    def get_persona(db: Session, persona_id: str, user_id: str) -> Optional[Persona]:
        return (
            db.query(Persona)
            .options(joinedload(Persona.council_members), joinedload(Persona.sources).joinedload(PersonaSource.chunks))
            .filter(Persona.id == persona_id, Persona.user_id == user_id)
            .first()
        )

    @staticmethod
    def create_persona(
        db: Session,
        *,
        user: User,
        persona_payload: dict,
        persona_type: str,
        add_to_council: bool = True,
        retrieval_service=None,
    ) -> Tuple[Persona, Optional[CouncilMember]]:
        persona = Persona(
            user_id=user.id,
            display_name=persona_payload["display_name"],
            persona_type=persona_type,
            identity_summary=persona_payload.get("identity_summary"),
            worldview_json=persona_payload.get("worldview", []),
            communication_style_json=persona_payload.get("communication_style", []),
            decision_style_json=persona_payload.get("decision_style", []),
            values_json=persona_payload.get("values", []),
            blind_spots_json=persona_payload.get("blind_spots", []),
            domain_confidence_json=persona_payload.get("domain_confidence", {}),
            source_count=persona_payload.get("source_count", 0),
            source_quality_score=persona_payload.get("source_quality_score"),
            status="active",
        )
        db.add(persona)
        db.flush()

        member = None
        if add_to_council:
            council = CouncilService.get_or_create_for_user(db, user)
            member = CouncilService.add_persona(db, council, persona)

        if retrieval_service is not None:
            retrieval_service.sync_persona_index(db, persona)

        db.flush()
        db.refresh(persona)
        return persona, member

    @staticmethod
    def update_persona(db: Session, persona: Persona, updates: dict, retrieval_service=None) -> Persona:
        field_map = {
            "display_name": "display_name",
            "identity_summary": "identity_summary",
            "worldview": "worldview_json",
            "communication_style": "communication_style_json",
            "decision_style": "decision_style_json",
            "values": "values_json",
            "blind_spots": "blind_spots_json",
            "domain_confidence": "domain_confidence_json",
            "source_count": "source_count",
            "source_quality_score": "source_quality_score",
            "status": "status",
        }
        for key, value in updates.items():
            if key in field_map and value is not None:
                setattr(persona, field_map[key], value)
        db.add(persona)
        db.flush()
        if retrieval_service is not None:
            retrieval_service.sync_persona_index(db, persona)
        db.refresh(persona)
        return persona

    @staticmethod
    def list_sources(db: Session, *, persona: Persona) -> list[PersonaSource]:
        refreshed_persona = (
            db.query(Persona)
            .options(joinedload(Persona.sources).joinedload(PersonaSource.chunks))
            .filter(Persona.id == persona.id)
            .first()
        ) or persona
        return [
            source for source in refreshed_persona.sources if not (source.notes_json or {}).get("generated")
        ]

    @staticmethod
    def add_source(
        db: Session,
        *,
        persona: Persona,
        source_payload: dict,
        retrieval_service=None,
    ) -> PersonaSource:
        normalized_payload = PersonaService._prepare_source_payload(source_payload)
        source = PersonaSource(
            persona_id=persona.id,
            url=normalized_payload["url"],
            title=normalized_payload.get("title"),
            source_type=normalized_payload["source_type"],
            publisher=normalized_payload.get("publisher"),
            quality_score=normalized_payload.get("quality_score"),
            is_primary=normalized_payload.get("is_primary", False),
            notes_json={"content": normalized_payload["content"]},
        )
        db.add(source)
        db.flush()
        db.refresh(persona)
        PersonaService._sync_source_metrics(persona)
        db.add(persona)
        db.flush()
        if retrieval_service is not None:
            retrieval_service.sync_persona_index(db, persona)
        db.refresh(source)
        return source

    @staticmethod
    def deactivate_persona(db: Session, persona: Persona) -> Persona:
        council = CouncilService.get_for_user(db, persona.user_id)
        if council:
            CouncilService.deactivate_member(db, council, persona.id)
        persona.status = "inactive"
        db.add(persona)
        db.flush()
        db.refresh(persona)
        return persona

    @staticmethod
    def create_snapshot(db: Session, persona: Persona) -> PersonaSnapshot:
        snapshot = PersonaSnapshot(
            persona_id=persona.id,
            snapshot_json=PersonaService.serialize_persona(persona),
        )
        db.add(snapshot)
        db.flush()
        return snapshot

    @staticmethod
    def create_draft(
        db: Session,
        *,
        user: User,
        input_name: str,
        persona_type: str,
        custom_brief: Optional[str] = None,
    ) -> PersonaDraft:
        job = JobService.create_job(
            db,
            user_id=user.id,
            job_type="persona_creation",
            payload={"input_name": input_name, "persona_type": persona_type, "custom_brief": custom_brief},
        )
        profile = build_persona_draft(input_name=input_name, persona_type=persona_type, custom_brief=custom_brief)
        draft = PersonaDraft(
            user_id=user.id,
            input_name=input_name,
            persona_type=persona_type,
            custom_brief=custom_brief,
            draft_profile_json=profile,
            review_status="generating" if persona_type == "real_person" else "ready",
            job_id=job.id,
        )
        db.add(draft)
        db.flush()
        job.payload_json = {**(job.payload_json or {}), "draft_id": draft.id}
        if persona_type != "real_person":
            JobService.mark_completed(job, {"draft_id": draft.id})
        db.refresh(draft)
        return draft

    @staticmethod
    def process_persona_creation_job(db: Session, job: Job) -> None:
        payload = job.payload_json or {}
        draft_id = payload.get("draft_id")
        input_name = payload.get("input_name")
        persona_type = payload.get("persona_type")
        custom_brief = payload.get("custom_brief")
        user_id = job.user_id

        if not draft_id or not input_name or not persona_type:
            JobService.mark_failed(job, "Persona creation job payload is incomplete")
            return

        draft = PersonaService.get_draft(db, draft_id, user_id)
        if draft is None:
            JobService.mark_failed(job, "Draft not found for persona creation job")
            return

        if draft.review_status == "approved":
            JobService.mark_completed(job, {"draft_id": draft.id})
            return

        if persona_type != "real_person":
            draft.review_status = "ready"
            db.add(draft)
            JobService.mark_completed(job, {"draft_id": draft.id})
            return

        try:
            PersonaService._clear_auto_discovered_draft_sources(db, draft)
            discovery_service = SourceDiscoveryService()
            discovered_sources = discovery_service.discover_sources(
                person_name=input_name,
                custom_brief=custom_brief,
            )
            for source_payload in discovered_sources:
                PersonaService.add_draft_source(
                    db,
                    draft=draft,
                    source_payload=source_payload,
                    metadata={"auto_discovered": True},
                )
            draft = PersonaService.get_draft(db, draft.id, user_id) or draft
            draft.draft_profile_json = PersonaService._build_draft_profile_with_source_summary(draft)
            draft.review_status = "ready"
            db.add(draft)
            JobService.mark_completed(job, {"draft_id": draft.id, "source_count": len(draft.sources)})
        except httpx.HTTPError as error:
            PersonaService._fail_draft_job(
                db,
                draft=draft,
                job=job,
                warning="Automated source discovery failed. Add sources manually or by URL.",
                error_message=f"Automated source discovery failed: {error.__class__.__name__}",
            )
        except Exception as error:
            logger.exception("Unexpected draft generation failure for draft %s", draft.id)
            PersonaService._fail_draft_job(
                db,
                draft=draft,
                job=job,
                warning="Draft generation hit an internal error. Review and continue manually if needed.",
                error_message=f"Draft generation failed: {error.__class__.__name__}",
            )

    @staticmethod
    def get_draft(db: Session, draft_id: str, user_id: str) -> Optional[PersonaDraft]:
        return (
            db.query(PersonaDraft)
            .options(joinedload(PersonaDraft.sources).joinedload(PersonaSource.chunks))
            .filter(PersonaDraft.id == draft_id, PersonaDraft.user_id == user_id)
            .first()
        )

    @staticmethod
    def add_draft_source(
        db: Session,
        *,
        draft: PersonaDraft,
        source_payload: dict,
        metadata: Optional[dict] = None,
    ) -> PersonaSource:
        if not (metadata or {}).get("auto_discovered"):
            PersonaService._ensure_draft_editable(draft)
        normalized_payload = PersonaService._prepare_source_payload(source_payload)
        source = PersonaSource(
            draft_id=draft.id,
            url=normalized_payload["url"],
            title=normalized_payload.get("title"),
            source_type=normalized_payload["source_type"],
            publisher=normalized_payload.get("publisher"),
            quality_score=normalized_payload.get("quality_score"),
            is_primary=normalized_payload.get("is_primary", False),
            notes_json={**(metadata or {}), "content": normalized_payload["content"]},
        )
        db.add(source)
        db.flush()
        db.refresh(draft)
        draft.draft_profile_json = PersonaService._build_draft_profile_with_source_summary(draft)
        db.add(draft)
        db.flush()
        db.refresh(source)
        return source

    @staticmethod
    def update_draft(db: Session, draft: PersonaDraft, draft_profile: dict) -> PersonaDraft:
        PersonaService._ensure_draft_editable(draft)
        merged = {**(draft.draft_profile_json or {}), **draft_profile}
        draft.draft_profile_json = merged
        draft.review_status = "ready"
        db.add(draft)
        db.flush()
        db.refresh(draft)
        return draft

    @staticmethod
    def approve_draft(db: Session, draft: PersonaDraft, user: User, retrieval_service=None) -> Tuple[Persona, Optional[CouncilMember]]:
        persona, member = PersonaService.create_persona(
            db,
            user=user,
            persona_payload=draft.draft_profile_json,
            persona_type=draft.persona_type,
            add_to_council=True,
        )
        for source in draft.sources:
            db.add(
                PersonaSource(
                    persona_id=persona.id,
                    url=source.url,
                    title=source.title,
                    source_type=source.source_type,
                    publisher=source.publisher,
                    quality_score=source.quality_score,
                    is_primary=source.is_primary,
                    notes_json=source.notes_json,
                )
            )
        db.flush()
        db.refresh(persona)
        PersonaService._sync_source_metrics(persona)
        db.add(persona)
        db.flush()
        if retrieval_service is not None:
            retrieval_service.sync_persona_index(db, persona)
        draft.review_status = "approved"
        db.add(draft)
        db.flush()
        return persona, member

    @staticmethod
    def replace_persona(
        db: Session,
        *,
        user: User,
        old_persona: Persona,
        input_name: str,
        persona_type: str,
        custom_brief: Optional[str] = None,
    ) -> PersonaDraft:
        old_persona.status = "replaced"
        db.add(old_persona)
        return PersonaService.create_draft(
            db,
            user=user,
            input_name=input_name,
            persona_type=persona_type,
            custom_brief=custom_brief,
        )

    @staticmethod
    def serialize_persona(persona: Persona) -> dict:
        return {
            "id": persona.id,
            "display_name": persona.display_name,
            "persona_type": persona.persona_type,
            "identity_summary": persona.identity_summary,
            "worldview": persona.worldview_json,
            "communication_style": persona.communication_style_json,
            "decision_style": persona.decision_style_json,
            "values": persona.values_json,
            "blind_spots": persona.blind_spots_json,
            "domain_confidence": persona.domain_confidence_json,
            "source_count": persona.source_count,
            "source_quality_score": persona.source_quality_score,
            "status": persona.status,
            "created_at": persona.created_at.isoformat() if persona.created_at else None,
            "updated_at": persona.updated_at.isoformat() if persona.updated_at else None,
        }

    @staticmethod
    def _sync_source_metrics(persona: Persona) -> None:
        external_sources = [
            source for source in persona.sources if not (source.notes_json or {}).get("generated")
        ]
        persona.source_count = len(external_sources)
        quality_scores = [source.quality_score for source in external_sources if source.quality_score is not None]
        persona.source_quality_score = (
            round(sum(quality_scores) / len(quality_scores), 4) if quality_scores else None
        )

    @staticmethod
    def _prepare_source_payload(source_payload: dict) -> dict:
        normalized_payload = dict(source_payload)
        content = (normalized_payload.get("content") or "").strip()
        if content:
            normalized_payload["content"] = content
            return normalized_payload

        captured = SourceCaptureService.capture(normalized_payload["url"])
        normalized_payload["content"] = captured["content"]
        if not normalized_payload.get("title") and captured.get("title"):
            normalized_payload["title"] = captured["title"][:255]
        return normalized_payload

    @staticmethod
    def _build_draft_profile_with_source_summary(draft: PersonaDraft) -> dict:
        profile = dict(draft.draft_profile_json or {})
        external_sources = list(draft.sources)
        quality_scores = [source.quality_score for source in external_sources if source.quality_score is not None]
        primary_count = sum(1 for source in external_sources if source.is_primary)
        persistent_warnings = [
            warning
            for warning in list(profile.get("warnings", []))
            if "Automated source discovery failed" in warning
        ]

        warnings = list(persistent_warnings)
        if len(external_sources) < 5:
            warnings.append(
                f"Limited evidence available: {len(external_sources)} of 5 recommended sources collected."
            )
        if primary_count < 2:
            warnings.append(
                f"Primary-source coverage is weak: {primary_count} of 2 recommended primary sources collected."
            )

        profile["source_count"] = len(external_sources)
        profile["source_quality_score"] = round(sum(quality_scores) / len(quality_scores), 4) if quality_scores else None
        profile["warnings"] = warnings
        return profile

    @staticmethod
    def _ensure_draft_editable(draft: PersonaDraft) -> None:
        if draft.review_status == "generating":
            raise ValueError("Draft is still generating")
        if draft.review_status == "approved":
            raise ValueError("Approved drafts can no longer be modified")

    @staticmethod
    def _clear_auto_discovered_draft_sources(db: Session, draft: PersonaDraft) -> None:
        refreshed_draft = PersonaService.get_draft(db, draft.id, draft.user_id) or draft
        for source in list(refreshed_draft.sources):
            if (source.notes_json or {}).get("auto_discovered"):
                db.delete(source)
        db.flush()

    @staticmethod
    def _fail_draft_job(
        db: Session,
        *,
        draft: PersonaDraft,
        job: Job,
        warning: str,
        error_message: str,
    ) -> None:
        profile = dict(draft.draft_profile_json or {})
        warnings = list(profile.get("warnings", []))
        if warning not in warnings:
            warnings.append(warning)
        profile["warnings"] = warnings
        draft.draft_profile_json = profile
        draft.review_status = "failed"
        db.add(draft)
        JobService.mark_failed(job, error_message)
