from __future__ import annotations

from app.config import Settings
from app.providers.base import BaseProvider
from app.providers.gemini import GeminiProvider


def build_provider(settings: Settings) -> BaseProvider:
    """Factory to create the appropriate LLM provider."""
    return GeminiProvider(settings)


__all__ = ["BaseProvider", "GeminiProvider", "build_provider"]
