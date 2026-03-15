from app.config import Settings
from app.providers.base import BaseProvider, MockProvider
from app.providers.gemini import GeminiProvider


def build_provider(settings: Settings) -> BaseProvider:
    if settings.gemini_api_key and "gemini" in settings.default_model.lower():
        return GeminiProvider(
            api_key=settings.gemini_api_key,
            model=settings.default_model,
            synthesis_model=settings.gemini_synthesis_model or settings.default_model,
            persona_max_output_tokens=settings.gemini_persona_max_output_tokens,
            synthesis_max_output_tokens=settings.gemini_synthesis_max_output_tokens,
            evidence_char_limit=settings.gemini_evidence_char_limit,
        )
    return MockProvider()


__all__ = ["BaseProvider", "GeminiProvider", "MockProvider", "build_provider"]
