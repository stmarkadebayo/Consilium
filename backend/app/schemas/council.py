from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CouncilMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    persona_id: str
    display_name: str
    persona_type: str
    position: int
    is_active: bool


class CouncilRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    min_personas: int
    max_personas: int
    created_at: datetime
    updated_at: datetime
    members: list[CouncilMemberRead]


class CouncilUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
