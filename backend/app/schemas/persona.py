from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


PersonaType = Literal["real_person", "custom"]
ResponseType = Literal["answer", "inference", "no_basis"]


class PersonaProfileBase(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    identity_summary: Optional[str] = None
    worldview: list[str] = Field(default_factory=list)
    communication_style: list[str] = Field(default_factory=list)
    decision_style: list[str] = Field(default_factory=list)
    values: list[str] = Field(default_factory=list)
    blind_spots: list[str] = Field(default_factory=list)
    domain_confidence: dict[str, float] = Field(default_factory=dict)
    source_count: int = 0
    source_quality_score: Optional[float] = Field(default=None, ge=0, le=1)

    @field_validator("domain_confidence")
    @classmethod
    def validate_confidence_map(cls, value: dict[str, float]) -> dict[str, float]:
        for score in value.values():
            if score < 0 or score > 1:
                raise ValueError("domain confidence values must be between 0 and 1")
        return value


class PersonaCreate(PersonaProfileBase):
    persona_type: PersonaType
    add_to_council: bool = True


class PersonaUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    identity_summary: Optional[str] = None
    worldview: Optional[list[str]] = None
    communication_style: Optional[list[str]] = None
    decision_style: Optional[list[str]] = None
    values: Optional[list[str]] = None
    blind_spots: Optional[list[str]] = None
    domain_confidence: Optional[dict[str, float]] = None
    source_count: Optional[int] = None
    source_quality_score: Optional[float] = Field(default=None, ge=0, le=1)
    status: Optional[str] = None


class PersonaRead(PersonaProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    persona_type: PersonaType
    status: str
    created_at: datetime
    updated_at: datetime


class PersonaListRead(BaseModel):
    personas: list[PersonaRead]


class PersonaSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    title: Optional[str]
    source_type: str
    publisher: Optional[str]
    quality_score: Optional[float]
    is_primary: bool
    notes_excerpt: Optional[str] = None
    chunk_count: int = 0


class PersonaSourceCreate(BaseModel):
    url: str = Field(min_length=1)
    title: Optional[str] = Field(default=None, max_length=255)
    source_type: str = Field(min_length=1, max_length=64)
    publisher: Optional[str] = Field(default=None, max_length=255)
    quality_score: Optional[float] = Field(default=None, ge=0, le=1)
    is_primary: bool = False
    content: Optional[str] = Field(default=None)


class PersonaSourceListRead(BaseModel):
    sources: list[PersonaSourceRead]


class PersonaDraftCreate(BaseModel):
    input_name: str = Field(min_length=1, max_length=255)
    persona_type: PersonaType
    custom_brief: Optional[str] = None


class PersonaDraftUpdate(BaseModel):
    draft_profile: dict[str, Any]


class PersonaDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: Optional[str] = None
    input_name: str
    persona_type: PersonaType
    review_status: str
    draft_profile: dict[str, Any]
    sources: list[PersonaSourceRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PersonaApproveRead(BaseModel):
    persona_id: str
    council_member_id: Optional[str] = None


class PersonaReplaceRequest(BaseModel):
    new_input_name: str = Field(min_length=1, max_length=255)
    new_persona_type: PersonaType
    custom_brief: Optional[str] = None


class PersonaResponseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    persona_name: str
    response_type: ResponseType
    verdict: Optional[str]
    reasoning: Optional[str]
    recommended_action: Optional[str]
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    status: str
    latency_ms: Optional[int] = None
    evidence_snippets: list[dict[str, Any]] = Field(default_factory=list)
