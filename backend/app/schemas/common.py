from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ErrorDetail(APIModel):
    code: str
    message: str
    extra: dict[str, Any] | None = None


class ErrorResponse(APIModel):
    detail: ErrorDetail
