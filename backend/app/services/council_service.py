from __future__ import annotations

from typing import Optional

from sqlalchemy.exc import IntegrityError
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
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            council = db.query(Council).filter(Council.user_id == user.id).first()
            if council:
                return council
            raise
        db.refresh(council)
        return council

    @staticmethod
    def get_for_user(db: Session, user_id: str) -> Optional[Council]:
        return db.query(Council).filter(Council.user_id == user_id).first()

    @staticmethod
    def get_member(council: Council, member_id: str) -> Optional[CouncilMember]:
        for member in council.members:
            if member.id == member_id:
                return member
        return None

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
    def set_member_active(db: Session, member: CouncilMember, is_active: bool) -> CouncilMember:
        member.is_active = is_active
        db.add(member)
        db.flush()
        db.refresh(member)
        return member

    @staticmethod
    def move_member(db: Session, council: Council, member: CouncilMember, new_position: int) -> CouncilMember:
        ordered_members = list(council.members)
        if not ordered_members:
            return member

        clamped_position = max(0, min(new_position, len(ordered_members) - 1))
        current_index = next((index for index, item in enumerate(ordered_members) if item.id == member.id), None)
        if current_index is None:
            raise ValueError("Council member not found")

        if current_index != clamped_position:
            ordered_members.pop(current_index)
            ordered_members.insert(clamped_position, member)

        for index, item in enumerate(ordered_members):
            item.position = index
            db.add(item)

        db.flush()
        db.refresh(member)
        return member

    @staticmethod
    def sync_onboarding_state(db: Session, *, user: User, council: Council) -> None:
        active_count = len(CouncilService.active_members(council))
        should_be_done = active_count >= council.min_personas
        if user.onboarding_done != should_be_done:
            user.onboarding_done = should_be_done
            db.add(user)
            db.flush()
