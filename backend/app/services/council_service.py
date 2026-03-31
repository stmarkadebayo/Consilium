from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.council import Council, CouncilMember
from app.models.persona import Persona
from app.models.user import User


class CouncilService:
    @staticmethod
    def get_or_create_for_user(db: Session, user: User) -> Council:
        council = db.query(Council).filter(Council.user_id == user.id).first()
        if council:
            return council
        council = Council(user_id=user.id)
        db.add(council)
        db.flush()
        db.refresh(council)
        return council

    @staticmethod
    def get_for_user(db: Session, user_id: str) -> Optional[Council]:
        return db.query(Council).filter(Council.user_id == user_id).first()

    @staticmethod
    def active_members(council: Council) -> list[CouncilMember]:
        return [m for m in council.members if m.is_active]

    @staticmethod
    def add_persona(db: Session, council: Council, persona: Persona) -> CouncilMember:
        next_position = max((m.position for m in council.members), default=-1) + 1
        member = CouncilMember(
            council_id=council.id,
            persona_id=persona.id,
            position=next_position,
            is_active=True,
        )
        db.add(member)
        db.flush()
        return member

    @staticmethod
    def deactivate_member(db: Session, council: Council, persona_id: str) -> None:
        for member in council.members:
            if member.persona_id == persona_id:
                member.is_active = False
                db.add(member)
        db.flush()

    @staticmethod
    def activate_member(db: Session, council: Council, persona_id: str) -> None:
        for member in council.members:
            if member.persona_id == persona_id:
                member.is_active = True
                db.add(member)
        db.flush()

    @staticmethod
    def sync_onboarding_state(db: Session, *, user: User, council: Council) -> None:
        active_count = len(CouncilService.active_members(council))
        should_be_done = active_count >= council.min_personas
        if user.onboarding_done != should_be_done:
            user.onboarding_done = should_be_done
            db.add(user)
            db.flush()
