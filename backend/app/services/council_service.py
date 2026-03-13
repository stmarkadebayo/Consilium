from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.council import Council, CouncilMember
from app.models.persona import Persona
from app.models.user import User


class CouncilService:
    @staticmethod
    def get_or_create_for_user(db: Session, user: User) -> Council:
        council = (
            db.query(Council)
            .options(joinedload(Council.members).joinedload(CouncilMember.persona))
            .filter(Council.user_id == user.id)
            .first()
        )
        if council:
            return council

        council = Council(user_id=user.id)
        db.add(council)
        db.flush()
        db.refresh(council)
        return council

    @staticmethod
    def get_for_user(db: Session, user_id: str) -> Optional[Council]:
        return (
            db.query(Council)
            .options(joinedload(Council.members).joinedload(CouncilMember.persona))
            .filter(Council.user_id == user_id)
            .first()
        )

    @staticmethod
    def update_name(db: Session, council: Council, name: str) -> Council:
        council.name = name.strip()
        db.add(council)
        db.flush()
        db.refresh(council)
        return council

    @staticmethod
    def active_members(council: Council) -> list[CouncilMember]:
        return [member for member in council.members if member.is_active and member.persona.status == "active"]

    @staticmethod
    def add_persona(db: Session, council: Council, persona: Persona) -> CouncilMember:
        active_member_count = len(CouncilService.active_members(council))
        if active_member_count >= council.max_personas:
            raise ValueError("Council is at maximum capacity")

        existing = next((member for member in council.members if member.persona_id == persona.id), None)
        if existing:
            existing.is_active = True
            db.add(existing)
            db.flush()
            return existing

        next_position = max((member.position for member in council.members), default=0) + 1
        member = CouncilMember(council_id=council.id, persona_id=persona.id, position=next_position)
        db.add(member)
        db.flush()
        return member

    @staticmethod
    def deactivate_member(db: Session, council: Council, persona_id: str) -> CouncilMember:
        active_members = CouncilService.active_members(council)
        if len(active_members) <= council.min_personas:
            raise ValueError("Deactivation would violate the council minimum")

        member = next((item for item in council.members if item.persona_id == persona_id), None)
        if not member:
            raise ValueError("Persona is not in the council")

        member.is_active = False
        db.add(member)
        db.flush()
        return member
