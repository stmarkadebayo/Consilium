from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal, Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    cors_origins: Union[str, list[str]] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001", "*"]
    )

    database_url: str = "sqlite:///./consilium.db"
    auth_provider: str = "development"
    supabase_url: Optional[str] = None
    supabase_publishable_key: Optional[str] = None

    # LLM
    gemini_api_key: Optional[str] = None
    default_model: str = "gemini-2.5-flash"
    persona_creation_model: str = "gemini-2.5-flash"
    synthesis_model: str = "gemini-2.5-flash"
    persona_max_output_tokens: int = 4096
    synthesis_max_output_tokens: int = 4096
    persona_creation_max_output_tokens: int = 8192

    # Dev defaults
    default_user_external_id: str = "dev-user"
    default_user_email: str = "demo@consilium.local"
    default_user_display_name: str = "Demo User"

    # Runtime
    auto_create_tables: bool = True
    council_timeout_seconds: int = 30
    job_runner_enabled: bool = True
    job_runner_poll_interval_seconds: float = 0.5
    job_runner_stale_after_seconds: int = 120

    # Memory
    memory_recent_turns: int = 6
    memory_summary_interval: int = 4

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, list[str]]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    def validate_runtime(self, *, role: Literal["api", "worker"]) -> None:
        if self.app_env not in {"staging", "production"}:
            return
        if self.auth_provider != "supabase":
            raise RuntimeError("Supabase auth is required outside local development.")
        if self.database_url.startswith("sqlite"):
            raise RuntimeError("SQLite is not allowed in staging or production.")
        if self.auto_create_tables:
            raise RuntimeError("AUTO_CREATE_TABLES must be disabled outside local development.")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
