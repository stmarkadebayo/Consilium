from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.db import Base, utcnow


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    persona_type: Mapped[str] = mapped_column(String(32))
    identity_summary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    worldview_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    communication_style_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    decision_style_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    values_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    blind_spots_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    domain_confidence_json: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)
    source_count: Mapped[int] = mapped_column(Integer, default=0)
    source_quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="personas")
    council_members = relationship("CouncilMember", back_populates="persona")
    snapshots = relationship("PersonaSnapshot", back_populates="persona", cascade="all, delete-orphan")
    sources = relationship("PersonaSource", back_populates="persona", cascade="all, delete-orphan")
    source_chunks = relationship("PersonaSourceChunk", back_populates="persona", cascade="all, delete-orphan")


class PersonaDraft(Base):
    __tablename__ = "persona_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    input_name: Mapped[str] = mapped_column(String(255))
    persona_type: Mapped[str] = mapped_column(String(32))
    custom_brief: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    draft_profile_json: Mapped[dict] = mapped_column(JSON, default=dict)
    review_status: Mapped[str] = mapped_column(String(32), default="pending")
    job_id: Mapped[Optional[str]] = mapped_column(ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="persona_drafts")
    job = relationship("Job", back_populates="persona_drafts")
    sources = relationship("PersonaSource", back_populates="draft", cascade="all, delete-orphan")


class PersonaSnapshot(Base):
    __tablename__ = "persona_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    persona_id: Mapped[str] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    persona = relationship("Persona", back_populates="snapshots")
    responses = relationship("PersonaResponse", back_populates="persona_snapshot")


class PersonaSource(Base):
    __tablename__ = "persona_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    persona_id: Mapped[Optional[str]] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"), nullable=True, index=True)
    draft_id: Mapped[Optional[str]] = mapped_column(ForeignKey("persona_drafts.id", ondelete="CASCADE"), nullable=True, index=True)
    url: Mapped[str] = mapped_column(String)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(64), default="other")
    publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    quality_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_primary: Mapped[bool] = mapped_column(default=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    notes_json: Mapped[dict] = mapped_column(JSON, default=dict)

    persona = relationship("Persona", back_populates="sources")
    draft = relationship("PersonaDraft", back_populates="sources")
    chunks = relationship("PersonaSourceChunk", back_populates="source", cascade="all, delete-orphan")


class PersonaSourceChunk(Base):
    __tablename__ = "persona_source_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("persona_sources.id", ondelete="CASCADE"), index=True)
    persona_id: Mapped[str] = mapped_column(ForeignKey("personas.id", ondelete="CASCADE"), index=True)
    chunk_text: Mapped[str] = mapped_column(String)
    chunk_index: Mapped[int] = mapped_column(Integer)
    embedding: Mapped[Optional[list[float]]] = mapped_column(
        Vector(768).with_variant(JSON, "sqlite"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    source = relationship("PersonaSource", back_populates="chunks")
    persona = relationship("Persona", back_populates="source_chunks")
