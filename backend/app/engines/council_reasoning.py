from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from time import perf_counter
from typing import Any

from app.evals import CouncilOutputEvaluator
from app.engines.persona_intelligence import PersonaIntelligenceEngine, PersonaRuntimeContext
from app.models.conversation import PersonaResponse, Synthesis
from app.services.persona_service import PersonaService


@dataclass
class PersonaExecutionResult:
    context: PersonaRuntimeContext
    response_mode_assessment: dict[str, Any] | None
    payload: dict[str, Any] | None
    error: Exception | None
    latency_ms: int


class CouncilReasoningEngine:
    def __init__(self, *, provider, retrieval_service) -> None:
        self.provider = provider
        self.retrieval_service = retrieval_service

    def execute(self, db, *, conversation, message, members) -> tuple[list[PersonaResponse], Synthesis]:
        runtime_contexts = self._build_runtime_contexts(db, members=members, prompt=message.content)
        execution_results = self._run_persona_generation(runtime_contexts, prompt=message.content)

        successful_payloads: list[dict[str, Any]] = []
        response_rows: list[PersonaResponse] = []

        for result in execution_results:
            row = self._build_response_row(
                conversation_id=conversation.id,
                message_id=message.id,
                result=result,
            )
            db.add(row)
            response_rows.append(row)

            if result.payload is not None and result.payload.get("response_type") != "no_basis":
                successful_payloads.append(
                    {
                        **result.payload,
                        "persona_name": result.context.persona_name,
                        "evidence_count": len(result.context.evidence_snippets),
                        "grounding_profile": result.context.grounding_profile,
                    }
                )

        synthesis_started = perf_counter()
        synthesis_payload = self.provider.generate_synthesis(message.content, successful_payloads)
        evaluation = CouncilOutputEvaluator.evaluate(successful_payloads, synthesis_payload)
        synthesis = Synthesis(
            conversation_id=conversation.id,
            message_id=message.id,
            agreements=synthesis_payload.get("agreements", []),
            disagreements=synthesis_payload.get("disagreements", []),
            next_step=synthesis_payload.get("next_step"),
            combined_recommendation=synthesis_payload.get("combined_recommendation"),
            latency_ms=int((perf_counter() - synthesis_started) * 1000),
            raw_output_json={
                **synthesis_payload,
                "evaluation": evaluation,
                "runtime_trace": {
                    "engine": "council_reasoning_engine_v1",
                    "persona_count": len(runtime_contexts),
                    "successful_persona_count": len(successful_payloads),
                },
            },
        )
        db.add(synthesis)
        db.flush()
        return response_rows, synthesis

    def _build_runtime_contexts(self, db, *, members, prompt: str) -> list[PersonaRuntimeContext]:
        snapshots = [PersonaService.create_snapshot(db, member.persona) for member in members]
        query_embedding = self.retrieval_service.embed_query(prompt)
        contexts: list[PersonaRuntimeContext] = []
        for snapshot in snapshots:
            evidence_snippets = self.retrieval_service.retrieve_evidence(
                db,
                persona_id=snapshot.persona_id,
                prompt=prompt,
                query_embedding=query_embedding,
            )
            contexts.append(
                PersonaIntelligenceEngine.build_runtime_context(
                    snapshot=snapshot,
                    evidence_snippets=evidence_snippets,
                )
            )
        return contexts

    def _run_persona_generation(
        self,
        runtime_contexts: list[PersonaRuntimeContext],
        *,
        prompt: str,
    ) -> list[PersonaExecutionResult]:
        results_by_snapshot_id: dict[str, PersonaExecutionResult] = {}
        with ThreadPoolExecutor(max_workers=max(1, len(runtime_contexts))) as executor:
            future_map = {
                executor.submit(self._generate_persona_payload, context=context, prompt=prompt): context
                for context in runtime_contexts
            }
            for future in as_completed(future_map):
                context = future_map[future]
                try:
                    result = future.result()
                except Exception as error:
                    result = PersonaExecutionResult(
                        context=context,
                        response_mode_assessment=None,
                        payload=None,
                        error=error,
                        latency_ms=0,
                    )
                results_by_snapshot_id[context.snapshot_id] = result
        return [results_by_snapshot_id[context.snapshot_id] for context in runtime_contexts]

    def _generate_persona_payload(self, *, context: PersonaRuntimeContext, prompt: str) -> PersonaExecutionResult:
        started = perf_counter()
        response_mode_assessment = self.provider.classify_response_mode(
            context.snapshot_json,
            prompt,
            context.evidence_snippets,
        )
        payload = self.provider.generate_persona_response(
            context.snapshot_json,
            prompt,
            context.evidence_snippets,
            expected_response_type=response_mode_assessment.get("response_type"),
        )
        return PersonaExecutionResult(
            context=context,
            response_mode_assessment=response_mode_assessment,
            payload=payload,
            error=None,
            latency_ms=int((perf_counter() - started) * 1000),
        )

    @staticmethod
    def _build_response_row(
        *,
        conversation_id: str,
        message_id: str,
        result: PersonaExecutionResult,
    ) -> PersonaResponse:
        runtime_trace = {
            "engine": "council_reasoning_engine_v1",
            "grounding_profile": result.context.grounding_profile,
            "response_mode_assessment": result.response_mode_assessment,
            "evidence_count": len(result.context.evidence_snippets),
        }
        if result.error is not None or result.payload is None:
            return PersonaResponse(
                conversation_id=conversation_id,
                message_id=message_id,
                persona_snapshot_id=result.context.snapshot_id,
                response_type="no_basis",
                verdict="No clear answer yet.",
                reasoning="This persona could not form a grounded response for this turn.",
                recommended_action=None,
                confidence=0.0,
                latency_ms=result.latency_ms,
                raw_output_json={
                    "error": str(result.error) if result.error else "Unknown execution failure",
                    "evidence_snippets": result.context.evidence_snippets,
                    "runtime_trace": runtime_trace,
                },
                status="failed",
            )

        expected_response_type = (result.response_mode_assessment or {}).get("response_type")
        actual_response_type = result.payload.get("response_type")
        runtime_trace["response_type_alignment"] = {
            "expected": expected_response_type,
            "actual": actual_response_type,
            "matched": expected_response_type == actual_response_type if expected_response_type else None,
        }
        return PersonaResponse(
            conversation_id=conversation_id,
            message_id=message_id,
            persona_snapshot_id=result.context.snapshot_id,
            response_type=result.payload["response_type"],
            verdict=result.payload.get("verdict"),
            reasoning=result.payload.get("reasoning"),
            recommended_action=result.payload.get("recommended_action"),
            confidence=result.payload.get("confidence"),
            latency_ms=result.latency_ms,
            raw_output_json={
                **result.payload,
                "evidence_snippets": result.context.evidence_snippets,
                "runtime_trace": runtime_trace,
            },
            status=result.payload.get("status", "completed"),
        )
