from __future__ import annotations

import logging
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import Settings
from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)


class GeminiProvider(BaseProvider):
    """Google Gemini LLM provider via langchain-google-genai."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._models: dict[str, ChatGoogleGenerativeAI] = {}

    def _get_model(self, model_key: str) -> ChatGoogleGenerativeAI:
        if model_key in self._models:
            return self._models[model_key]

        model_name = {
            "default": self.settings.default_model,
            "persona_creation": self.settings.persona_creation_model,
            "synthesis": self.settings.synthesis_model,
        }.get(model_key, self.settings.default_model)

        max_tokens = {
            "default": self.settings.persona_max_output_tokens,
            "persona_creation": self.settings.persona_creation_max_output_tokens,
            "synthesis": self.settings.synthesis_max_output_tokens,
        }.get(model_key, 1024)

        model = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=self.settings.gemini_api_key,
            max_output_tokens=max_tokens,
            temperature=0.7,
        )
        self._models[model_key] = model
        return model

    def generate_json(self, prompt: str, *, model_key: str, purpose: str) -> dict[str, Any]:
        logger.info("Generating JSON [model_key=%s, purpose=%s]", model_key, purpose)
        model = self._get_model(model_key)
        response = model.invoke(prompt)
        raw_text = response.content if hasattr(response, "content") else str(response)
        return self.extract_json(raw_text)

    def generate_text(self, prompt: str, *, model_key: str, purpose: str) -> str:
        logger.info("Generating text [model_key=%s, purpose=%s]", model_key, purpose)
        model = self._get_model(model_key)
        response = model.invoke(prompt)
        return response.content if hasattr(response, "content") else str(response)
