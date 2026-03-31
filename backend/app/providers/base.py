from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


class BaseProvider(ABC):
    """Abstract LLM provider interface."""

    @abstractmethod
    def generate_json(self, prompt: str, *, model_key: str, purpose: str) -> dict[str, Any]:
        """Generate a structured JSON response from the LLM."""
        ...

    @abstractmethod
    def generate_text(self, prompt: str, *, model_key: str, purpose: str) -> str:
        """Generate a plain text response from the LLM."""
        ...

    @staticmethod
    def extract_json(text: str) -> dict[str, Any]:
        """Extract JSON from LLM output, handling markdown fences and extra text."""
        # Try direct parse first
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from code fences
        fence_pattern = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)
        match = fence_pattern.search(text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

        last_err = None

        # Try finding first { ... } block
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end > brace_start:
            try:
                return json.loads(text[brace_start:brace_end + 1])
            except json.JSONDecodeError as e:
                last_err = e

        logger.error(f"Failed to parse JSON. Full LLM Output:\n{text}")
        raise ValueError(f"Could not extract JSON from LLM output. Decode error: {last_err}. Content preview: {text[:200]}")
