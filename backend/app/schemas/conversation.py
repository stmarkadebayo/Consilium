from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ConversationSummaryResponse(APIModel):
    id: str
    title: str | None
    created_at: datetime | None
    updated_at: datetime | None
    message_count: int


class ConversationListResponse(APIModel):
    conversations: list[ConversationSummaryResponse]


class CreateConversationRequest(APIModel):
    title: str | None = None


class SubmitMessageRequest(APIModel):
    content: str = Field(..., min_length=1)


class SubmitMessageResponse(APIModel):
    message_id: str
    job_id: str


class StartConsultRequest(APIModel):
    content: str = Field(..., min_length=1)


class StartConsultResponse(APIModel):
    conversation_id: str
    message_id: str
    job_id: str


class PersonaMessageResponse(APIModel):
    id: str
    persona_name: str
    content: str
    answer_mode: str | None
    confidence: float | None
    stance: str | None
    latency_ms: int | None
    status: str


class SynthesisResponse(APIModel):
    id: str
    agreements: list[str]
    disagreements: list[str]
    next_step: str | None
    combined_recommendation: str | None
    created_at: datetime | None


class ConversationTurnResponse(APIModel):
    turn_number: int
    user_message: dict | None
    persona_responses: list[PersonaMessageResponse]
    synthesis: SynthesisResponse | None


class ConversationResponse(APIModel):
    id: str
    title: str | None
    turns: list[ConversationTurnResponse]
