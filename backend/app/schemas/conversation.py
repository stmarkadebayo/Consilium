from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.persona import PersonaResponseRead


class ConversationCreate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)


class ConversationSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int


class ConversationListRead(BaseModel):
    conversations: list[ConversationSummaryRead]
    next_cursor: Optional[str] = None


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str
    created_at: datetime


class SynthesisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agreements: list[str]
    disagreements: list[str]
    next_step: Optional[str]
    combined_recommendation: Optional[str]
    created_at: datetime


class ConversationTurnRead(BaseModel):
    user_message: MessageRead
    persona_responses: list[PersonaResponseRead]
    synthesis: Optional[SynthesisRead] = None


class ConversationRead(BaseModel):
    id: str
    title: Optional[str]
    turns: list[ConversationTurnRead]


class TurnSubmissionRead(BaseModel):
    message_id: str
    job_id: str
