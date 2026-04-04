from __future__ import annotations

from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError, bad_request
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
    def assert_ready_for_consult(council: Council | None) -> Council:
        if council is None:
            raise bad_request("council_not_found", "Council not found.")

        active_count = len(CouncilService.active_members(council))
        if active_count < council.min_personas:
            raise bad_request(
                "council_min_personas_not_met",
                f"At least {council.min_personas} active personas are required.",
                extra={"active_count": active_count, "required_count": council.min_personas},
            )
        return council

    @staticmethod
    def add_persona(db: Session, council: Council, persona: Persona) -> CouncilMember:
        if len(council.members) >= council.max_personas:
            raise bad_request(
                "council_max_personas_reached",
                f"Council already has the maximum of {council.max_personas} advisors.",
                extra={"max_personas": council.max_personas},
            )
        if any(member.persona_id == persona.id for member in council.members):
            raise bad_request("council_member_exists", "Persona is already in the council.")

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

        if new_position < 0 or new_position >= len(ordered_members):
            raise bad_request(
                "council_member_position_out_of_range",
                "Requested council position is out of range.",
                extra={"position": new_position, "member_count": len(ordered_members)},
            )

        current_index = next((index for index, item in enumerate(ordered_members) if item.id == member.id), None)
        if current_index is None:
            raise bad_request("council_member_not_found", "Council member not found.")

        if current_index != new_position:
            ordered_members.pop(current_index)
            ordered_members.insert(new_position, member)

        for index, item in enumerate(ordered_members):
            item.position = index
            db.add(item)

        db.flush()
        db.refresh(member)
        return member

    @staticmethod
    def remove_persona(db: Session, council: Council, persona_id: str) -> None:
        remaining_members: list[CouncilMember] = []
        removed_member: CouncilMember | None = None

        for member in list(council.members):
            if member.persona_id == persona_id and removed_member is None:
                removed_member = member
                db.delete(member)
                continue
            remaining_members.append(member)

        if removed_member is None:
            return

        for index, member in enumerate(sorted(remaining_members, key=lambda item: item.position)):
            member.position = index
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
