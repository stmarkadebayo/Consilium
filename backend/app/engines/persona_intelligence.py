from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any


@dataclass
class PersonaRuntimeContext:
    snapshot_id: str
    persona_id: str
    persona_name: str
    snapshot_json: dict[str, Any]
    evidence_snippets: list[dict[str, Any]]
    grounding_profile: dict[str, Any]


class PersonaIntelligenceEngine:
    STOPWORDS = {
        "about",
        "after",
        "against",
        "also",
        "because",
        "before",
        "being",
        "between",
        "could",
        "first",
        "from",
        "have",
        "into",
        "just",
        "more",
        "most",
        "other",
        "over",
        "same",
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
    def serialize_persona(cls, persona) -> dict[str, Any]:
        source_count = int(persona.source_count or 0)
        quality_score = float(persona.source_quality_score or 0.0)
        grounding_tier = cls._grounding_tier(source_count=source_count, quality_score=quality_score)
        confidence_band = cls._confidence_band(source_count=source_count, quality_score=quality_score)
        return {
            "id": persona.id,
            "display_name": persona.display_name,
            "persona_type": persona.persona_type,
            "identity_summary": persona.identity_summary,
            "worldview": persona.worldview_json,
            "communication_style": persona.communication_style_json,
            "decision_style": persona.decision_style_json,
            "values": persona.values_json,
            "blind_spots": persona.blind_spots_json,
            "domain_confidence": persona.domain_confidence_json,
            "source_count": source_count,
            "source_quality_score": persona.source_quality_score,
            "status": persona.status,
            "created_at": persona.created_at.isoformat() if persona.created_at else None,
            "updated_at": persona.updated_at.isoformat() if persona.updated_at else None,
            "grounding_profile": {
                "source_count": source_count,
                "source_quality_score": persona.source_quality_score,
                "grounding_tier": grounding_tier,
                "confidence_band": confidence_band,
            },
            "runtime_directives": cls._build_runtime_directives(grounding_tier=grounding_tier),
        }

    @classmethod
    def compile_draft_profile(
        cls,
        draft_profile: dict[str, Any] | None,
        *,
        sources: list[Any],
    ) -> dict[str, Any]:
        profile = dict(draft_profile or {})
        evidence_summary = cls.summarize_sources(sources)
        profile["source_count"] = evidence_summary["source_count"]
        profile["source_quality_score"] = evidence_summary["average_quality_score"]
        profile["evidence_summary"] = evidence_summary
        profile["grounding_profile"] = {
            "grounding_tier": cls._grounding_tier(
                source_count=evidence_summary["source_count"],
                quality_score=evidence_summary["average_quality_score"] or 0.0,
            ),
            "confidence_band": cls._confidence_band(
                source_count=evidence_summary["source_count"],
                quality_score=evidence_summary["average_quality_score"] or 0.0,
            ),
            "recommended_response_modes": cls._recommended_response_modes(evidence_summary),
        }
        return profile

    @classmethod
    def build_runtime_context(
        cls,
        *,
        snapshot,
        evidence_snippets: list[dict[str, Any]],
    ) -> PersonaRuntimeContext:
        snapshot_json = dict(snapshot.snapshot_json or {})
        grounding_profile = cls.build_grounding_profile(snapshot_json, evidence_snippets)
        return PersonaRuntimeContext(
            snapshot_id=snapshot.id,
            persona_id=snapshot.persona_id,
            persona_name=str(snapshot_json.get("display_name", "Unknown")),
            snapshot_json=snapshot_json,
            evidence_snippets=evidence_snippets,
            grounding_profile=grounding_profile,
        )

    @classmethod
    def build_grounding_profile(
        cls,
        persona_snapshot: dict[str, Any],
        evidence_snippets: list[dict[str, Any]],
    ) -> dict[str, Any]:
        evidence_count = len(evidence_snippets)
        source_count = int(persona_snapshot.get("source_count") or 0)
        source_quality_score = float(persona_snapshot.get("source_quality_score") or 0.0)
        average_evidence_score = 0.0
        if evidence_snippets:
            numeric_scores = [float(item["score"]) for item in evidence_snippets if isinstance(item.get("score"), (int, float))]
            if numeric_scores:
                average_evidence_score = round(sum(numeric_scores) / len(numeric_scores), 4)

        if evidence_count >= 3 and average_evidence_score >= 0.55:
            retrieval_strength = "strong"
        elif evidence_count >= 1:
            retrieval_strength = "partial"
        else:
            retrieval_strength = "thin"

        return {
            "source_count": source_count,
            "source_quality_score": persona_snapshot.get("source_quality_score"),
            "evidence_count": evidence_count,
            "average_evidence_score": average_evidence_score,
            "retrieval_strength": retrieval_strength,
            "grounding_tier": cls._grounding_tier(source_count=source_count, quality_score=source_quality_score),
            "confidence_band": cls._confidence_band(source_count=source_count, quality_score=source_quality_score),
        }

    @classmethod
    def summarize_sources(cls, sources: list[Any]) -> dict[str, Any]:
        quality_scores = [source.quality_score for source in sources if source.quality_score is not None]
        source_types = Counter((source.source_type or "other") for source in sources)
        publishers = Counter((source.publisher or "unknown") for source in sources)
        primary_count = sum(1 for source in sources if source.is_primary)
        combined_text = " ".join((source.notes_json or {}).get("content", "") for source in sources)

        return {
            "source_count": len(sources),
            "primary_source_count": primary_count,
            "average_quality_score": round(sum(quality_scores) / len(quality_scores), 4) if quality_scores else None,
            "source_types": dict(source_types),
            "top_publishers": [publisher for publisher, _count in publishers.most_common(3)],
            "topical_terms": cls._extract_topical_terms(combined_text),
        }

    @classmethod
    def _extract_topical_terms(cls, text: str, limit: int = 5) -> list[str]:
        words = re.findall(r"[a-zA-Z]{5,}", text.lower())
        filtered = [word for word in words if word not in cls.STOPWORDS]
        counts = Counter(filtered)
        return [word for word, _count in counts.most_common(limit)]

    @staticmethod
    def _build_runtime_directives(*, grounding_tier: str) -> list[str]:
        directives = [
            "Stay faithful to the persona profile and retrieved evidence.",
            "Prefer concise reasoning over long-form imitation.",
            "Surface uncertainty explicitly when support is thin.",
        ]
        if grounding_tier == "strong":
            directives.append("Answer directly only when the evidence materially supports the claim.")
        elif grounding_tier == "moderate":
            directives.append("Default to inference unless there is clear supporting evidence.")
        else:
            directives.append("Prefer no_basis when the question outruns the available material.")
        return directives

    @staticmethod
    def _recommended_response_modes(evidence_summary: dict[str, Any]) -> list[str]:
        source_count = int(evidence_summary.get("source_count") or 0)
        primary_source_count = int(evidence_summary.get("primary_source_count") or 0)
        average_quality_score = float(evidence_summary.get("average_quality_score") or 0.0)
        if source_count >= 5 and primary_source_count >= 2 and average_quality_score >= 0.75:
            return ["answer", "inference"]
        if source_count >= 2 and average_quality_score >= 0.45:
            return ["inference", "no_basis"]
        return ["no_basis", "inference"]

    @staticmethod
    def _grounding_tier(*, source_count: int, quality_score: float) -> str:
        if source_count >= 5 and quality_score >= 0.75:
            return "strong"
        if source_count >= 2 and quality_score >= 0.45:
            return "moderate"
        return "thin"

    @staticmethod
    def _confidence_band(*, source_count: int, quality_score: float) -> str:
        if source_count >= 5 and quality_score >= 0.75:
            return "high"
        if source_count >= 2 and quality_score >= 0.45:
            return "medium"
        return "low"
