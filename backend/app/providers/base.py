from __future__ import annotations

from abc import ABC, abstractmethod
from collections import Counter
from typing import Any


class BaseProvider(ABC):
    @abstractmethod
    def classify_response_mode(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def generate_persona_response(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
        *,
        expected_response_type: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def generate_synthesis(self, prompt: str, persona_responses: list[dict[str, Any]]) -> dict[str, Any]:
        raise NotImplementedError


class MockProvider(BaseProvider):
    def classify_response_mode(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        evidence_count = len(evidence_snippets or [])
        source_count = int(persona_snapshot.get("source_count") or 0)
        quality_score = float(persona_snapshot.get("source_quality_score") or 0.0)

        if evidence_count >= 2 or (source_count >= 5 and quality_score >= 0.75):
            response_type = "answer"
            basis_score = 0.82
            reasoning = "Retrieved evidence is strong enough for a grounded answer."
        elif evidence_count >= 1 or source_count >= 1:
            response_type = "inference"
            basis_score = 0.58
            reasoning = "There is some grounding, but not enough for a direct answer."
        else:
            response_type = "no_basis"
            basis_score = 0.21
            reasoning = "The persona lacks enough source support for this question."

        return {
            "response_type": response_type,
            "basis_score": basis_score,
            "reasoning": reasoning,
        }

    def generate_persona_response(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
        *,
        expected_response_type: str | None = None,
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
        response_type = expected_response_type or "inference"

        if response_type == "no_basis":
            return {
                "response_type": "no_basis",
                "verdict": f"{name} does not have enough basis to answer directly.",
                "reasoning": f"The available material is too thin to respond faithfully.{evidence_note}",
                "recommended_action": "Add stronger source material or narrow the question.",
                "confidence": 0.22,
                "status": "completed",
            }

        if response_type == "answer":
            verdict = f"{name} would act directly from {primary_worldview}."
            confidence = 0.81
        else:
            verdict = f"{name} would move carefully and optimize around {primary_worldview}."
            confidence = 0.73

        return {
            "response_type": response_type,
            "verdict": verdict,
            "reasoning": (
                f"Using a {primary_style} lens, {name} reads this prompt as a question about "
                f"{primary_value} and downside control.{evidence_note}"
            ),
            "recommended_action": f"Run one bounded next step that tests {primary_worldview}.",
            "confidence": confidence,
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
