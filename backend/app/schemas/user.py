from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)
    email: str
    display_name: Optional[str] = Field(default=None, max_length=255)


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=255)
    onboarding_done: Optional[bool] = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: Optional[str]
    onboarding_done: bool
    created_at: datetime
