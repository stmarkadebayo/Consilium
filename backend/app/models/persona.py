from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


class Persona(Base):
    """A fully-formed advisor persona built from public material."""
    __tablename__ = "personas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    persona_type: Mapped[str] = mapped_column(String(32))  # real_person | custom

    # Profile fields aligned with the MVP brief schema
    identity_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    domains: Mapped[list[str]] = mapped_column(JSON, default=list)
    core_beliefs: Mapped[list[str]] = mapped_column(JSON, default=list)
    priorities: Mapped[list[str]] = mapped_column(JSON, default=list)
    anti_values: Mapped[list[str]] = mapped_column(JSON, default=list)
    decision_patterns: Mapped[list[str]] = mapped_column(JSON, default=list)
    communication_style_json: Mapped[dict] = mapped_column(JSON, default=dict)
    style_markers: Mapped[list[str]] = mapped_column(JSON, default=list)
    abstention_rules: Mapped[list[str]] = mapped_column(JSON, default=list)
    confidence_by_topic: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)

    # The reusable runtime prompt generated during persona creation
    generated_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Source quality metrics
    source_count: Mapped[int] = mapped_column(Integer, default=0)
    source_quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="personas")
    council_members = relationship("CouncilMember", back_populates="persona")
    snapshots = relationship("PersonaSnapshot", back_populates="persona", cascade="all, delete-orphan")
    sources = relationship("PersonaSource", back_populates="persona", cascade="all, delete-orphan")


class PersonaDraft(Base):
    """In-progress persona being built through the creation pipeline."""
    __tablename__ = "persona_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    input_name: Mapped[str] = mapped_column(String(255))
    persona_type: Mapped[str] = mapped_column(String(32))
    custom_brief: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    draft_profile_json: Mapped[dict] = mapped_column(JSON, default=dict)
    review_status: Mapped[str] = mapped_column(String(32), default="pending")  # pending | generating | ready | approved | failed
    job_id: Mapped[Optional[str]] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="persona_drafts")
    job = relationship("Job", back_populates="persona_drafts")
    sources = relationship("PersonaSource", back_populates="draft", cascade="all, delete-orphan")
    revisions = relationship(
        "PersonaDraftRevision",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="PersonaDraftRevision.created_at.asc()",
    )


class PersonaDraftRevision(Base):
    """Saved snapshot of a draft profile for timeline, diffing, and restore."""
    __tablename__ = "persona_draft_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    draft_id: Mapped[str] = mapped_column(ForeignKey("persona_drafts.id", ondelete="CASCADE"), index=True)
    revision_kind: Mapped[str] = mapped_column(String(32), default="manual")  # initial | ai | manual | restore
    instruction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    draft = relationship("PersonaDraft", back_populates="revisions")


class PersonaSnapshot(Base):
    """Frozen copy of a persona profile used at query time."""
    __tablename__ = "persona_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    persona_id: Mapped[str] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    persona = relationship("Persona", back_populates="snapshots")
    messages = relationship("Message", back_populates="persona_snapshot")


class PersonaSource(Base):
    """A source document used to build or ground a persona."""
    __tablename__ = "persona_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    persona_id: Mapped[Optional[str]] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"), nullable=True, index=True)
    draft_id: Mapped[Optional[str]] = mapped_column(ForeignKey("persona_drafts.id", ondelete="CASCADE"), nullable=True, index=True)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(64), default="other")
    publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_primary: Mapped[bool] = mapped_column(default=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes_json: Mapped[dict] = mapped_column(JSON, default=dict)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    persona = relationship("Persona", back_populates="sources")
    draft = relationship("PersonaDraft", back_populates="sources")
