from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from time import perf_counter
from typing import Optional

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Message, PersonaResponse, Synthesis
from app.models.council import CouncilMember
from app.services.persona_service import PersonaService


def execute_council_query(
    db: Session,
    *,
    provider,
    retrieval_service,
    conversation: Conversation,
    message: Message,
    members: list[CouncilMember],
) -> tuple[list[PersonaResponse], Synthesis]:
    snapshots = []
    for member in members:
        snapshots.append(PersonaService.create_snapshot(db, member.persona))
    db.flush()

    query_embedding = retrieval_service.embed_query(message.content)
    evidence_by_snapshot_id = {
        snapshot.id: retrieval_service.retrieve_evidence(
            db,
            persona_id=snapshot.persona_id,
            prompt=message.content,
            query_embedding=query_embedding,
        )
        for snapshot in snapshots
    }

    persona_results: dict[str, tuple[Optional[dict], Optional[Exception], int]] = {}

    with ThreadPoolExecutor(max_workers=max(1, len(snapshots))) as executor:
        future_map = {}
        for snapshot in snapshots:
            started = perf_counter()
            future = executor.submit(
                provider.generate_persona_response,
                snapshot.snapshot_json,
                message.content,
                evidence_by_snapshot_id.get(snapshot.id, []),
            )
            future_map[future] = (snapshot, started)

        for future in as_completed(future_map):
            snapshot, started = future_map[future]
            latency_ms = int((perf_counter() - started) * 1000)
            try:
                persona_results[snapshot.id] = (future.result(), None, latency_ms)
            except Exception as error:
                persona_results[snapshot.id] = (None, error, latency_ms)

    successful_payloads = []
    response_rows = []

    for snapshot in snapshots:
        result, error, latency_ms = persona_results[snapshot.id]
        if error is not None:
            response = PersonaResponse(
                conversation_id=conversation.id,
                message_id=message.id,
                persona_snapshot_id=snapshot.id,
                response_type="no_basis",
                verdict="Execution failed",
                reasoning=str(error),
                recommended_action="Retry or refine the prompt with more context.",
                confidence=0.0,
                latency_ms=latency_ms,
                raw_output_json={"error": str(error)},
                status="failed",
            )
        else:
            response = PersonaResponse(
                conversation_id=conversation.id,
                message_id=message.id,
                persona_snapshot_id=snapshot.id,
                response_type=result["response_type"],
                verdict=result.get("verdict"),
                reasoning=result.get("reasoning"),
                recommended_action=result.get("recommended_action"),
                confidence=result.get("confidence"),
                latency_ms=latency_ms,
                raw_output_json={**result, "evidence_snippets": evidence_by_snapshot_id.get(snapshot.id, [])},
                status=result.get("status", "completed"),
            )
            successful_payloads.append(
                {
                    **result,
                    "persona_name": snapshot.snapshot_json["display_name"],
                }
            )
        db.add(response)
        response_rows.append(response)

    synthesis_started = perf_counter()
    synthesis_payload = provider.generate_synthesis(message.content, successful_payloads)
    synthesis = Synthesis(
        conversation_id=conversation.id,
        message_id=message.id,
        agreements=synthesis_payload.get("agreements", []),
        disagreements=synthesis_payload.get("disagreements", []),
        next_step=synthesis_payload.get("next_step"),
        combined_recommendation=synthesis_payload.get("combined_recommendation"),
        latency_ms=int((perf_counter() - synthesis_started) * 1000),
        raw_output_json=synthesis_payload,
    )
    db.add(synthesis)
    db.flush()
    return response_rows, synthesis
