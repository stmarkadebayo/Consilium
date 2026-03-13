from __future__ import annotations

from abc import ABC, abstractmethod
from collections import Counter
from typing import Any


class BaseProvider(ABC):
    @abstractmethod
    def generate_persona_response(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def generate_synthesis(self, prompt: str, persona_responses: list[dict[str, Any]]) -> dict[str, Any]:
        raise NotImplementedError


class MockProvider(BaseProvider):
    def generate_persona_response(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        name = persona_snapshot["display_name"]
        worldview = persona_snapshot.get("worldview", []) or ["clarity before commitment"]
        decision_style = persona_snapshot.get("decision_style", []) or ["structured tradeoff analysis"]
        values = persona_snapshot.get("values", []) or ["long-term upside"]

        if "force-failure" in name.lower() or any("force-failure" in item.lower() for item in worldview):
            raise RuntimeError(f"{name} could not produce a response")

        primary_worldview = worldview[0]
        primary_style = decision_style[0]
        primary_value = values[0]
        evidence_note = ""
        if evidence_snippets:
            evidence_note = f" Based on {len(evidence_snippets)} retrieved evidence snippets."

        return {
            "response_type": "inference",
            "verdict": f"{name} would move carefully and optimize around {primary_worldview}.",
            "reasoning": (
                f"Using a {primary_style} lens, {name} reads this prompt as a question about "
                f"{primary_value} and downside control.{evidence_note}"
            ),
            "recommended_action": f"Run one bounded next step that tests {primary_worldview}.",
            "confidence": 0.73,
            "status": "completed",
        }

    def generate_synthesis(self, prompt: str, persona_responses: list[dict[str, Any]]) -> dict[str, Any]:
        if not persona_responses:
            return {
                "agreements": ["The council does not have enough grounded output yet."],
                "disagreements": [],
                "next_step": "Refine the prompt and retry with more context.",
                "combined_recommendation": "Pause the decision until the council has enough signal.",
            }

        actions = [response["recommended_action"] for response in persona_responses if response.get("recommended_action")]
        consensus = Counter(actions).most_common(1)[0][0] if actions else "Take the smallest reversible next step."
        agreements = [
            "Most advisors recommend a deliberate, low-regret next step.",
            "The council prefers validation over impulsive action.",
        ]
        disagreements = [
            response["verdict"]
            for response in persona_responses[1:3]
            if response.get("verdict")
        ]

        return {
            "agreements": agreements,
            "disagreements": disagreements,
            "next_step": consensus,
            "combined_recommendation": (
                f"For '{prompt}', the council suggests a measured experiment before committing."
            ),
        }
