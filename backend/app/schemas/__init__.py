from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- User ---
class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    onboarding_done: bool
    created_at: datetime


# --- Council ---
class CouncilMemberResponse(BaseModel):
    id: str
    persona_id: str
    display_name: str
    persona_type: str
    position: int
    is_active: bool


class CouncilResponse(BaseModel):
    id: str
    name: str
    min_personas: int
    max_personas: int
    created_at: datetime
    updated_at: datetime
    members: list[CouncilMemberResponse]


class UpdateCouncilRequest(BaseModel):
    name: str


# --- Persona ---
class PersonaResponse(BaseModel):
    id: str
    display_name: str
    persona_type: str
    identity_summary: str | None
    domains: list[str]
    core_beliefs: list[str]
    priorities: list[str]
    anti_values: list[str]
    decision_patterns: list[str]
    communication_style: dict
    style_markers: list[str]
    abstention_rules: list[str]
    confidence_by_topic: dict[str, float]
    source_count: int
    source_quality_score: float | None
    status: str
    created_at: datetime | None
    updated_at: datetime | None


class CreatePersonaDraftRequest(BaseModel):
    input_name: str
    persona_type: str = "real_person"
    custom_brief: str | None = None


class PersonaDraftResponse(BaseModel):
    id: str
    input_name: str
    persona_type: str
    custom_brief: str | None
    review_status: str
    draft_profile: dict
    job_id: str | None
    created_at: datetime
    updated_at: datetime


class UpdatePersonaDraftRequest(BaseModel):
    draft_profile: dict


# --- Conversation ---
class ConversationSummaryResponse(BaseModel):
    id: str
    title: str | None
    created_at: str | None
    updated_at: str | None
    message_count: int


class CreateConversationRequest(BaseModel):
    title: str | None = None


class SubmitMessageRequest(BaseModel):
    content: str


class SubmitMessageResponse(BaseModel):
    message_id: str
    job_id: str


class StartConsultRequest(BaseModel):
    content: str


class StartConsultResponse(BaseModel):
    conversation_id: str
    message_id: str
    job_id: str


class PersonaMessageResponse(BaseModel):
    id: str
    persona_name: str
    content: str
    answer_mode: str | None
    confidence: float | None
    stance: str | None
    latency_ms: int | None
    status: str


class SynthesisResponse(BaseModel):
    id: str
    agreements: list[str]
    disagreements: list[str]
    next_step: str | None
    combined_recommendation: str | None
    created_at: str | None


class ConversationTurnResponse(BaseModel):
    turn_number: int
    user_message: dict | None
    persona_responses: list[PersonaMessageResponse]
    synthesis: SynthesisResponse | None


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    turns: list[ConversationTurnResponse]


# --- Job ---
class JobResponse(BaseModel):
    id: str
    job_type: str
    status: str
    retry_count: int
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
