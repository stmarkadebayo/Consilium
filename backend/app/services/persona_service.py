from __future__ import annotations

import logging
from typing import Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.engines.persona_pipeline import PersonaPipeline
from app.models.council import CouncilMember
from app.models.job import Job
from app.models.persona import Persona, PersonaDraft, PersonaSnapshot, PersonaSource
from app.models.user import User
from app.services.council_service import CouncilService
from app.services.event_service import EventService
from app.services.job_service import JobService

logger = logging.getLogger(__name__)


class PersonaService:
    @staticmethod
    def list_personas(db: Session, user_id: str) -> list[Persona]:
        return db.query(Persona).filter(Persona.user_id == user_id).order_by(Persona.created_at.asc()).all()

    @staticmethod
    def get_persona(db: Session, persona_id: str, user_id: str) -> Optional[Persona]:
        return (
            db.query(Persona)
            .options(joinedload(Persona.council_members), joinedload(Persona.sources))
            .filter(Persona.id == persona_id, Persona.user_id == user_id)
            .first()
        )

    @staticmethod
    def create_persona_from_profile(
        db: Session,
        *,
        user: User,
        profile: dict,
        persona_type: str,
        add_to_council: bool = True,
    ) -> Tuple[Persona, Optional[CouncilMember]]:
        """Create a fully-formed persona from a profile dict."""
        comm_style = profile.get("communication_style", {})
        if isinstance(comm_style, list):
            comm_style = {"traits": comm_style}

        persona = Persona(
            user_id=user.id,
            display_name=profile.get("display_name", "Unknown"),
            persona_type=persona_type,
            identity_summary=profile.get("identity_summary"),
            domains=profile.get("domains", []),
            core_beliefs=profile.get("core_beliefs", []),
            priorities=profile.get("priorities", []),
            anti_values=profile.get("anti_values", []),
            decision_patterns=profile.get("decision_patterns", []),
            communication_style_json=comm_style,
            style_markers=profile.get("style_markers", []),
            abstention_rules=profile.get("abstention_rules", []),
            confidence_by_topic=profile.get("confidence_by_topic", {}),
            generated_prompt=profile.get("generated_prompt"),
            source_count=0,
            source_quality_score=None,
            status="active",
        )
        db.add(persona)
        db.flush()

        member = None
        if add_to_council:
            council = CouncilService.get_or_create_for_user(db, user)
            member = CouncilService.add_persona(db, council, persona)
            CouncilService.sync_onboarding_state(db, user=user, council=council)

        EventService.record(
            db,
            user_id=user.id,
            event_type="persona_created",
            payload={"persona_id": persona.id, "persona_type": persona_type},
        )

        db.flush()
        db.refresh(persona)
        return persona, member

    @staticmethod
    def create_snapshot(db: Session, persona: Persona) -> PersonaSnapshot:
        """Create a frozen snapshot for use at query time."""
        snapshot_data = {
            "id": persona.id,
            "display_name": persona.display_name,
            "persona_type": persona.persona_type,
            "identity_summary": persona.identity_summary,
            "domains": persona.domains,
            "core_beliefs": persona.core_beliefs,
            "priorities": persona.priorities,
            "anti_values": persona.anti_values,
            "decision_patterns": persona.decision_patterns,
            "communication_style": persona.communication_style_json,
            "style_markers": persona.style_markers,
            "abstention_rules": persona.abstention_rules,
            "confidence_by_topic": persona.confidence_by_topic,
            "generated_prompt": persona.generated_prompt,
            "source_count": persona.source_count,
            "source_quality_score": persona.source_quality_score,
        }
        snapshot = PersonaSnapshot(persona_id=persona.id, snapshot_json=snapshot_data)
        db.add(snapshot)
        db.flush()
        return snapshot

    # --- Draft flow ---

    @staticmethod
    def create_draft(
        db: Session,
        *,
        user: User,
        input_name: str,
        persona_type: str,
        custom_brief: str | None = None,
    ) -> PersonaDraft:
        """Create a draft and kick off the persona creation job."""
        job = JobService.create_job(
            db,
            user_id=user.id,
            job_type="persona_creation",
            payload={
                "input_name": input_name,
                "persona_type": persona_type,
                "custom_brief": custom_brief,
            },
        )
        draft = PersonaDraft(
            user_id=user.id,
            input_name=input_name,
            persona_type=persona_type,
            custom_brief=custom_brief,
            draft_profile_json={},
            review_status="generating",
            job_id=job.id,
        )
        db.add(draft)
        db.flush()

        # Store draft_id back on the job
        job.payload_json = {**(job.payload_json or {}), "draft_id": draft.id}
        db.add(job)
        db.flush()
        db.refresh(draft)
        return draft

    @staticmethod
    def process_persona_creation_job(db: Session, job: Job, *, provider) -> None:
        """Background job handler: runs the persona pipeline and updates the draft."""
        payload = job.payload_json or {}
        draft_id = payload.get("draft_id")
        input_name = payload.get("input_name")
        persona_type = payload.get("persona_type")
        custom_brief = payload.get("custom_brief")

        if not draft_id or not input_name:
            JobService.mark_failed(job, "Incomplete persona creation job payload")
            return

        draft = PersonaService.get_draft(db, draft_id, job.user_id)
        if draft is None:
            JobService.mark_failed(job, "Draft not found")
            return

        if draft.review_status == "approved":
            JobService.mark_completed(job, {"draft_id": draft.id})
            return

        try:
            pipeline = PersonaPipeline(provider=provider)
            profile = pipeline.run(
                person_name=input_name,
                persona_type=persona_type,
                custom_brief=custom_brief,
            )
            draft.draft_profile_json = profile
            draft.review_status = "ready"
            db.add(draft)
            JobService.mark_completed(job, {"draft_id": draft.id})
        except Exception as error:
            logger.exception("Persona creation failed for draft %s", draft_id)
            draft.review_status = "failed"
            db.add(draft)
            JobService.mark_failed(job, f"Pipeline failed: {error.__class__.__name__}: {error}")
            raise

    @staticmethod
    def get_draft(db: Session, draft_id: str, user_id: str) -> Optional[PersonaDraft]:
        return (
            db.query(PersonaDraft)
            .options(joinedload(PersonaDraft.sources))
            .filter(PersonaDraft.id == draft_id, PersonaDraft.user_id == user_id)
            .first()
        )

    @staticmethod
    def update_draft(db: Session, draft: PersonaDraft, updates: dict) -> PersonaDraft:
        if draft.review_status == "generating":
            raise ValueError("Draft is still generating")
        if draft.review_status == "approved":
            raise ValueError("Approved drafts cannot be modified")
        merged = {**(draft.draft_profile_json or {}), **updates}
        draft.draft_profile_json = merged
        draft.review_status = "ready"
        db.add(draft)
        db.flush()
        db.refresh(draft)
        return draft

    @staticmethod
    def approve_draft(
        db: Session,
        draft: PersonaDraft,
        user: User,
    ) -> Tuple[Persona, Optional[CouncilMember]]:
        """Approve a draft, creating the full persona and adding to council."""
        persona, member = PersonaService.create_persona_from_profile(
            db,
            user=user,
            profile=draft.draft_profile_json,
            persona_type=draft.persona_type,
            add_to_council=True,
        )
        draft.review_status = "approved"
        db.add(draft)
        db.flush()

        council = CouncilService.get_for_user(db, user.id)
        active_count = len(CouncilService.active_members(council)) if council else 0

        EventService.record(
            db,
            user_id=user.id,
            event_type="persona_draft_approved",
            payload={
                "draft_id": draft.id,
                "persona_id": persona.id,
                "active_advisor_count": active_count,
            },
        )
        if active_count in {1, 2, 3}:
            EventService.record(
                db,
                user_id=user.id,
                event_type=f"advisor_{active_count}_approved",
                payload={"draft_id": draft.id, "persona_id": persona.id},
            )
        return persona, member

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
    def activate_persona(db: Session, persona: Persona) -> Persona:
        council = CouncilService.get_for_user(db, persona.user_id)
        if council:
            CouncilService.activate_member(db, council, persona.id)
        persona.status = "active"
        db.add(persona)
        db.flush()
        db.refresh(persona)
        return persona

    @staticmethod
    def serialize_persona(persona: Persona) -> dict:
        return {
            "id": persona.id,
            "display_name": persona.display_name,
            "persona_type": persona.persona_type,
            "identity_summary": persona.identity_summary,
            "domains": persona.domains,
            "core_beliefs": persona.core_beliefs,
            "priorities": persona.priorities,
            "anti_values": persona.anti_values,
            "decision_patterns": persona.decision_patterns,
            "communication_style": persona.communication_style_json,
            "style_markers": persona.style_markers,
            "abstention_rules": persona.abstention_rules,
            "confidence_by_topic": persona.confidence_by_topic,
            "source_count": persona.source_count,
            "source_quality_score": persona.source_quality_score,
            "status": persona.status,
            "created_at": persona.created_at.isoformat() if persona.created_at else None,
            "updated_at": persona.updated_at.isoformat() if persona.updated_at else None,
        }
