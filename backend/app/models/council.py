from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


class Council(Base):
    __tablename__ = "councils"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="My Council")
    min_personas: Mapped[int] = mapped_column(Integer, default=3)
    max_personas: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="council")
    members = relationship(
        "CouncilMember",
        back_populates="council",
        cascade="all, delete-orphan",
        order_by="CouncilMember.position",
    )
    conversations = relationship("Conversation", back_populates="council", cascade="all, delete-orphan")


class CouncilMember(Base):
    __tablename__ = "council_members"
    __table_args__ = (UniqueConstraint("council_id", "persona_id", name="uq_council_persona"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    council_id: Mapped[str] = mapped_column(ForeignKey("councils.id", ondelete="CASCADE"), index=True)
    persona_id: Mapped[str] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    council = relationship("Council", back_populates="members")
    persona = relationship("Persona", back_populates="council_members")
