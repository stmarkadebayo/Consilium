from __future__ import annotations

from typing import Any, Optional


def build_persona_draft(input_name: str, persona_type: str, custom_brief: Optional[str] = None) -> dict[str, Any]:
    normalized_name = input_name.strip()
    worldview = (
        [
            "seek first-principles clarity",
            "prefer reversible experiments over irreversible bets",
            "optimize for long-term compounding",
        ]
        if persona_type == "real_person"
        else [
            "adapt to the user's stated goals",
            "surface tradeoffs clearly",
            "protect against obvious blind spots",
        ]
    )
    communication_style = ["concise", "structured", "direct"]
    decision_style = ["tradeoff-driven", "evidence-aware", "low-regret"]
    values = ["clarity", "restraint", "actionable next steps"]
    blind_spots = ["may underweight emotional context", "may prefer caution over speed"]

    if custom_brief:
        worldview = [custom_brief.strip()] + worldview[:2]
        values = ["user-defined perspective", *values[:2]]

    return {
        "display_name": normalized_name,
        "identity_summary": custom_brief or f"{normalized_name} is modeled as a perspective-oriented advisor.",
        "worldview": worldview,
        "communication_style": communication_style,
        "decision_style": decision_style,
        "values": values,
        "blind_spots": blind_spots,
        "domain_confidence": {"general_reasoning": 0.72, "strategy": 0.68},
        "source_count": 3 if persona_type == "real_person" else 0,
        "source_quality_score": 0.7 if persona_type == "real_person" else 0.35,
    }
