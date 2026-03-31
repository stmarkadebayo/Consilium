from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, utcnow


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    council_id: Mapped[str] = mapped_column(ForeignKey("councils.id", ondelete="CASCADE"), index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # 3-layer memory: rolling summary and pinned facts stored on the conversation
    rolling_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pinned_facts: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="conversations")
    council = relationship("Council", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.turn_number")


class Message(Base):
    """A single message in a conversation thread.

    role values:
      - "user": the human's input
      - "persona": a persona's response (persona_snapshot_id is set)
      - "synthesis": the council synthesis
    """
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32))  # user | persona | synthesis
    persona_snapshot_id: Mapped[Optional[str]] = mapped_column(ForeignKey("persona_snapshots.id"), nullable=True)
    turn_number: Mapped[int] = mapped_column(Integer)

    # The visible content shown to the user (for persona messages, this is final_response)
    content: Mapped[str] = mapped_column(Text, default="")

    # Hidden structured response — brief's internal schema
    # For persona messages: {answer_mode, stance, reasoning_basis, tone_mode, confidence, inference_level, abstain_flag}
    # For synthesis messages: {agreements, disagreements, next_step, combined_recommendation}
    internal_json: Mapped[dict] = mapped_column(JSON, default=dict)

    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    persona_snapshot = relationship("PersonaSnapshot", back_populates="messages")
