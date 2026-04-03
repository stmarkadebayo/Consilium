from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


class PersonaPipeline:
    """Builds a persona profile and runtime prompt using the LLM.

    Simplified pipeline (steps from the brief):
    1. Name input (handled by caller)
    2-4. Profile generation (LLM builds profile from its knowledge)
    5. Profile assembly (structured output)
    6. Runtime prompt generation
    7. Review & save (handled by caller)
    """

    def __init__(self, *, provider) -> None:
        self.provider = provider

    def generate_profile(
        self,
        *,
        person_name: str,
        persona_type: str,
        custom_brief: str | None = None,
    ) -> dict[str, Any]:
        """Steps 2-5: Generate the structured persona profile."""
        prompt_template = _load_prompt("persona_profile.txt")
        prompt = prompt_template.format(
            person_name=person_name,
            persona_type=persona_type,
            custom_brief=custom_brief or "No additional context provided.",
        )

        raw = self.provider.generate_json(
            prompt,
            model_key="persona_creation",
            purpose="persona_profile",
        )
        return raw

    def generate_runtime_prompt(self, profile: dict[str, Any]) -> str:
        """Step 6: Generate the reusable runtime prompt from the profile."""
        prompt_template = _load_prompt("persona_prompt_gen.txt")
        prompt = prompt_template.format(
            profile_json=json.dumps(profile, indent=2),
        )

        raw = self.provider.generate_text(
            prompt,
            model_key="persona_creation",
            purpose="persona_prompt_generation",
        )
        return raw.strip()

    def revise_profile(
        self,
        *,
        person_name: str,
        persona_type: str,
        current_profile: dict[str, Any],
        revision_instruction: str,
        custom_brief: str | None = None,
    ) -> dict[str, Any]:
        """Revise an existing persona profile from a natural-language instruction."""
        prompt_template = _load_prompt("persona_profile_edit.txt")
        prompt = prompt_template.format(
            person_name=person_name,
            persona_type=persona_type,
            custom_brief=custom_brief or "No additional context provided.",
            current_profile_json=json.dumps(current_profile, indent=2),
            revision_instruction=revision_instruction,
        )

        raw = self.provider.generate_json(
            prompt,
            model_key="persona_creation",
            purpose="persona_profile_revision",
        )
        return raw

    def run(
        self,
        *,
        person_name: str,
        persona_type: str,
        custom_brief: str | None = None,
    ) -> dict[str, Any]:
        """Full pipeline: profile generation + prompt generation.

        Returns the complete draft profile dict with generated_prompt included.
        """
        logger.info("Starting persona pipeline for %r (type=%s)", person_name, persona_type)

        profile = self.generate_profile(
            person_name=person_name,
            persona_type=persona_type,
            custom_brief=custom_brief,
        )

        generated_prompt = self.generate_runtime_prompt(profile)
        profile["generated_prompt"] = generated_prompt

        logger.info("Persona pipeline complete for %r", person_name)
        return profile
