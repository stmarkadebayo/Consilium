from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, Optional

from app.models.conversation import Message
from app.models.persona import PersonaSnapshot

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


@dataclass
class PersonaResult:
    snapshot: PersonaSnapshot
    payload: dict[str, Any] | None
    error: Exception | None
    latency_ms: int


class CouncilEngine:
    """Orchestrates parallel persona generation and synthesis.

    Flow from the brief:
    1. User sends a message
    2. Load active council and thread memory
    3. Fan out to all personas in parallel
    4. Each persona receives: saved prompt + recent context + user message
    5. Each persona responds independently
    6. Synthesis step produces closing summary
    7. Store everything + update memory
    """

    def __init__(self, *, provider) -> None:
        self.provider = provider

    def execute(
        self,
        db,
        *,
        conversation,
        user_message: Message,
        snapshots: list[PersonaSnapshot],
        thread_context: str,
    ) -> tuple[list[Message], Optional[Message]]:
        """Run all personas in parallel, then synthesize."""
        persona_results = self._run_parallel(
            snapshots=snapshots,
            user_prompt=user_message.content,
            thread_context=thread_context,
        )

        persona_messages: list[Message] = []
        successful_responses: list[dict[str, Any]] = []

        for result in persona_results:
            msg = self._build_persona_message(
                conversation_id=conversation.id,
                turn_number=user_message.turn_number,
                result=result,
            )
            db.add(msg)
            persona_messages.append(msg)

            if result.payload and result.payload.get("answer_mode") != "no_basis":
                successful_responses.append({
                    "persona_name": result.snapshot.snapshot_json.get("display_name", "Unknown"),
                    "final_response": result.payload.get("final_response", ""),
                    "stance": result.payload.get("stance", ""),
                    "confidence": result.payload.get("confidence", 0.0),
                    "answer_mode": result.payload.get("answer_mode", "no_basis"),
                })

        # Synthesis
        synthesis_msg = None
        if successful_responses:
            synthesis_started = perf_counter()
            synthesis_payload = self._generate_synthesis(
                user_prompt=user_message.content,
                persona_responses=successful_responses,
            )
            synthesis_msg = Message(
                conversation_id=conversation.id,
                role="synthesis",
                turn_number=user_message.turn_number,
                content=synthesis_payload.get("combined_recommendation", ""),
                internal_json=synthesis_payload,
                latency_ms=int((perf_counter() - synthesis_started) * 1000),
                status="completed",
            )
            db.add(synthesis_msg)

        db.flush()
        return persona_messages, synthesis_msg

    def _run_parallel(
        self,
        *,
        snapshots: list[PersonaSnapshot],
        user_prompt: str,
        thread_context: str,
    ) -> list[PersonaResult]:
        results_by_id: dict[str, PersonaResult] = {}

        with ThreadPoolExecutor(max_workers=max(1, len(snapshots))) as executor:
            future_map = {
                executor.submit(
                    self._generate_persona_response,
                    snapshot=snapshot,
                    user_prompt=user_prompt,
                    thread_context=thread_context,
                ): snapshot
                for snapshot in snapshots
            }

            for future in as_completed(future_map):
                snapshot = future_map[future]
                try:
                    result = future.result()
                except Exception as error:
                    logger.exception("Persona generation failed for %s", snapshot.id)
                    result = PersonaResult(
                        snapshot=snapshot,
                        payload=None,
                        error=error,
                        latency_ms=0,
                    )
                results_by_id[snapshot.id] = result

        return [results_by_id[s.id] for s in snapshots]

    def _generate_persona_response(
        self,
        *,
        snapshot: PersonaSnapshot,
        user_prompt: str,
        thread_context: str,
    ) -> PersonaResult:
        started = perf_counter()
        snap_data = snapshot.snapshot_json or {}
        persona_prompt = snap_data.get("generated_prompt", "")

        if not persona_prompt:
            # Fallback: build a minimal prompt from the profile
            persona_prompt = f"You are {snap_data.get('display_name', 'an advisor')}. {snap_data.get('identity_summary', '')}"

        runtime_template = _load_prompt("persona_runtime.txt")
        full_prompt = runtime_template.format(
            persona_prompt=persona_prompt,
            thread_context=thread_context or "No previous context.",
            user_prompt=user_prompt,
        )

        payload = self.provider.generate_json(
            full_prompt,
            model_key="default",
            purpose="persona_response",
        )

        return PersonaResult(
            snapshot=snapshot,
            payload=payload,
            error=None,
            latency_ms=int((perf_counter() - started) * 1000),
        )

    def _generate_synthesis(
        self,
        *,
        user_prompt: str,
        persona_responses: list[dict[str, Any]],
    ) -> dict[str, Any]:
        synthesis_template = _load_prompt("synthesis.txt")
        prompt = synthesis_template.format(
            persona_count=len(persona_responses),
            user_prompt=user_prompt,
            persona_responses_json=json.dumps(persona_responses, indent=2),
        )

        return self.provider.generate_json(
            prompt,
            model_key="synthesis",
            purpose="synthesis",
        )

    @staticmethod
    def _build_persona_message(
        *,
        conversation_id: str,
        turn_number: int,
        result: PersonaResult,
    ) -> Message:
        if result.error or result.payload is None:
            return Message(
                conversation_id=conversation_id,
                role="persona",
                persona_snapshot_id=result.snapshot.id,
                turn_number=turn_number,
                content="I don't have enough grounding to respond faithfully to this question.",
                internal_json={
                    "answer_mode": "no_basis",
                    "abstain_flag": True,
                    "error": str(result.error) if result.error else "Unknown failure",
                },
                latency_ms=result.latency_ms,
                status="failed",
            )

        return Message(
            conversation_id=conversation_id,
            role="persona",
            persona_snapshot_id=result.snapshot.id,
            turn_number=turn_number,
            content=result.payload.get("final_response", ""),
            internal_json={
                k: v for k, v in result.payload.items() if k != "final_response"
            },
            latency_ms=result.latency_ms,
            status="completed",
        )
