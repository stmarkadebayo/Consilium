from __future__ import annotations

import re
from collections import Counter
from itertools import combinations
from typing import Any


class CouncilOutputEvaluator:
    STOPWORDS = {
        "about",
        "after",
        "against",
        "also",
        "because",
        "before",
        "being",
        "could",
        "from",
        "have",
        "into",
        "just",
        "more",
        "most",
        "only",
        "other",
        "over",
        "should",
        "than",
        "that",
        "their",
        "there",
        "these",
        "they",
        "this",
        "through",
        "under",
        "very",
        "what",
        "when",
        "where",
        "which",
        "while",
        "with",
        "would",
    }

    @classmethod
    def evaluate(
        cls,
        persona_responses: list[dict[str, Any]],
        synthesis_payload: dict[str, Any],
    ) -> dict[str, Any]:
        if not persona_responses:
            return {
                "persona_count": 0,
                "response_mode_distribution": {},
                "diversity_score": 0.0,
                "abstention_rate": 0.0,
                "low_confidence_rate": 0.0,
                "grounding_coverage": 0.0,
                "synthesis_captures_disagreement": False,
            }

        response_types = Counter(str(item.get("response_type", "unknown")) for item in persona_responses)
        confidences = [
            float(item["confidence"])
            for item in persona_responses
            if isinstance(item.get("confidence"), (float, int))
        ]
        evidence_backed = sum(1 for item in persona_responses if int(item.get("evidence_count", 0)) > 0)
        disagreement_present = cls._has_disagreement(persona_responses)
        diversity_score = cls._diversity_score(persona_responses)

        return {
            "persona_count": len(persona_responses),
            "response_mode_distribution": dict(response_types),
            "diversity_score": diversity_score,
            "abstention_rate": round(response_types.get("no_basis", 0) / len(persona_responses), 4),
            "low_confidence_rate": (
                round(sum(1 for confidence in confidences if confidence < 0.5) / len(confidences), 4)
                if confidences
                else 0.0
            ),
            "grounding_coverage": round(evidence_backed / len(persona_responses), 4),
            "synthesis_captures_disagreement": bool(synthesis_payload.get("disagreements")) if disagreement_present else True,
        }

    @classmethod
    def _diversity_score(cls, persona_responses: list[dict[str, Any]]) -> float:
        verdicts = [str(item.get("verdict", "")).strip() for item in persona_responses if str(item.get("verdict", "")).strip()]
        if len(verdicts) < 2:
            return 0.0 if not verdicts else 1.0

        overlaps = [
            cls._token_overlap(first, second)
            for first, second in combinations(verdicts, 2)
        ]
        if not overlaps:
            return 1.0
        average_overlap = sum(overlaps) / len(overlaps)
        return round(max(0.0, min(1.0, 1 - average_overlap)), 4)

    @classmethod
    def _has_disagreement(cls, persona_responses: list[dict[str, Any]]) -> bool:
        normalized_verdicts = {
            cls._normalize_text(str(item.get("verdict", "")))
            for item in persona_responses
            if str(item.get("verdict", "")).strip()
        }
        return len(normalized_verdicts) > 1

    @classmethod
    def _token_overlap(cls, first: str, second: str) -> float:
        first_tokens = cls._tokenize(first)
        second_tokens = cls._tokenize(second)
        if not first_tokens or not second_tokens:
            return 0.0
        union = first_tokens | second_tokens
        if not union:
            return 0.0
        return len(first_tokens & second_tokens) / len(union)

    @classmethod
    def _tokenize(cls, text: str) -> set[str]:
        return {
            token for token in re.findall(r"[a-zA-Z]{4,}", text.lower())
            if token not in cls.STOPWORDS
        }

    @staticmethod
    def _normalize_text(text: str) -> str:
        return " ".join(text.lower().split())
