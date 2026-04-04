from __future__ import annotations

from datetime import datetime

from pydantic import ConfigDict, Field

from app.schemas.common import APIModel


class CommunicationStyle(APIModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    tone: str | None = None
    sentence_shape: str | None = None
    emotional_temperature: str | None = None
    metaphor_use: str | None = None
    wit_level: str | None = None
    rhetorical_rhythm: str | None = None


class PersonaProfile(APIModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    display_name: str | None = None
    identity_summary: str | None = None
    domains: list[str] = Field(default_factory=list)
    core_beliefs: list[str] = Field(default_factory=list)
    priorities: list[str] = Field(default_factory=list)
    anti_values: list[str] = Field(default_factory=list)
    decision_patterns: list[str] = Field(default_factory=list)
    communication_style: CommunicationStyle = Field(default_factory=CommunicationStyle)
    style_markers: list[str] = Field(default_factory=list)
    abstention_rules: list[str] = Field(default_factory=list)
    confidence_by_topic: dict[str, float] = Field(default_factory=dict)
    source_quality_note: str | None = None
    generated_prompt: str | None = None


class PersonaResponse(APIModel):
    id: str
    display_name: str
    persona_type: str
    identity_summary: str | None
    domains: list[str]
    core_beliefs: list[str]
    priorities: list[str]
    anti_values: list[str]
    decision_patterns: list[str]
    communication_style: CommunicationStyle
    style_markers: list[str]
    abstention_rules: list[str]
    confidence_by_topic: dict[str, float]
    source_count: int
    source_quality_score: float | None
    status: str
    created_at: datetime | None
    updated_at: datetime | None


class PersonaListResponse(APIModel):
    personas: list[PersonaResponse]


class CreatePersonaDraftRequest(APIModel):
    input_name: str = Field(..., min_length=1, max_length=255)
    persona_type: str = "real_person"
    custom_brief: str | None = None


class PersonaDraftResponse(APIModel):
    id: str
    input_name: str
    persona_type: str
    custom_brief: str | None
    review_status: str
    draft_profile: PersonaProfile
    job_id: str | None
    created_at: datetime
    updated_at: datetime


class UpdatePersonaDraftRequest(APIModel):
    draft_profile: PersonaProfile


class RevisePersonaDraftRequest(APIModel):
    instruction: str = Field(..., min_length=1, max_length=4000)


class PersonaDraftRevisionResponse(APIModel):
    id: str
    revision_kind: str
    instruction: str | None
    profile: PersonaProfile
    created_at: datetime


class ApproveDraftResponse(APIModel):
    persona_id: str
    council_member_id: str | None
