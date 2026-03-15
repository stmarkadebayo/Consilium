from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Consilium API"
    app_env: str = "local"
    app_secret_key: str = "change-me-in-production"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    database_url: str = "sqlite:///./consilium.db"
    database_url_async: Optional[str] = None
    auth_provider: str = "development"
    supabase_url: Optional[str] = None
    supabase_publishable_key: Optional[str] = None

    default_model: str = "mock-council"
    gemini_api_key: Optional[str] = None
    gemini_synthesis_model: Optional[str] = "gemini-2.5-flash-lite"
    gemini_persona_max_output_tokens: int = 180
    gemini_synthesis_max_output_tokens: int = 280
    gemini_evidence_char_limit: int = 240
    embedding_model: Optional[str] = None
    embedding_dimensions: Optional[int] = None
    posthog_host: Optional[str] = None

    default_user_external_id: str = "dev-user"
    default_user_email: str = "demo@consilium.local"
    default_user_display_name: str = "Demo User"

    auto_create_tables: bool = True
    council_timeout_seconds: int = 15
    job_runner_enabled: bool = True
    job_runner_poll_interval_seconds: float = 0.25
    job_runner_stale_after_seconds: int = 120

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, list[str]]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
