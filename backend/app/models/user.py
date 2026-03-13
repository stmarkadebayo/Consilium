from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    onboarding_done: Mapped[bool] = mapped_column(Boolean, default=False)
    tier: Mapped[str] = mapped_column(String(32), default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    council = relationship("Council", back_populates="user", uselist=False, cascade="all, delete-orphan")
    personas = relationship("Persona", back_populates="user", cascade="all, delete-orphan")
    persona_drafts = relationship("PersonaDraft", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
