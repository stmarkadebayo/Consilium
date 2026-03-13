from __future__ import annotations

import json
from typing import Any

import httpx

from app.providers.base import BaseProvider


class GeminiProvider(BaseProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def generate_persona_response(
        self,
        persona_snapshot: dict[str, Any],
        prompt: str,
        evidence_snippets: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        display_name = persona_snapshot["display_name"]
        worldview = self._format_list(persona_snapshot.get("worldview"))
        communication_style = self._format_list(persona_snapshot.get("communication_style"))
        decision_style = self._format_list(persona_snapshot.get("decision_style"))
        values = self._format_list(persona_snapshot.get("values"))
        blind_spots = self._format_list(persona_snapshot.get("blind_spots"))

        system_instruction = (
            "You are simulating a council advisor. Stay faithful to the supplied persona snapshot. "
            "Do not claim external facts you cannot support from the prompt. Produce grounded, concise, "
            "decision-useful output."
        )
        evidence_lines = self._format_evidence(evidence_snippets)
        user_prompt = (
            f"User prompt:\n{prompt}\n\n"
            f"Persona display name: {display_name}\n"
            f"Identity summary: {persona_snapshot.get('identity_summary', 'N/A')}\n"
            f"Worldview:\n{worldview}\n\n"
            f"Communication style:\n{communication_style}\n\n"
            f"Decision style:\n{decision_style}\n\n"
            f"Values:\n{values}\n\n"
            f"Blind spots:\n{blind_spots}\n\n"
            f"Evidence pack:\n{evidence_lines}\n\n"
            "Return a single council response object. Keep reasoning under 120 words. "
            "Set status to 'completed'. Set confidence between 0 and 1."
        )
        schema = {
            "type": "object",
            "properties": {
                "response_type": {"type": "string"},
                "verdict": {"type": "string"},
                "reasoning": {"type": "string"},
                "recommended_action": {"type": "string"},
                "confidence": {"type": "number"},
                "status": {"type": "string"},
            },
            "required": [
                "response_type",
                "verdict",
                "reasoning",
                "recommended_action",
                "confidence",
                "status",
            ],
        }
        payload = self._generate_json(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            schema=schema,
            temperature=0.4,
        )
        confidence = max(0.0, min(1.0, float(payload.get("confidence", 0.0))))
        return {
            "response_type": self._normalize_response_type(payload.get("response_type")),
            "verdict": str(payload["verdict"]).strip(),
            "reasoning": str(payload["reasoning"]).strip(),
            "recommended_action": str(payload["recommended_action"]).strip(),
            "confidence": confidence,
            "status": str(payload.get("status", "completed")).strip() or "completed",
        }

    def generate_synthesis(self, prompt: str, persona_responses: list[dict[str, Any]]) -> dict[str, Any]:
        rendered_responses = []
        for response in persona_responses:
            rendered_responses.append(
                "\n".join(
                    [
                        f"Persona: {response.get('persona_name', 'Unknown')}",
                        f"Verdict: {response.get('verdict', '')}",
                        f"Reasoning: {response.get('reasoning', '')}",
                        f"Recommended action: {response.get('recommended_action', '')}",
                        f"Confidence: {response.get('confidence', '')}",
                    ]
                )
            )

        system_instruction = (
            "You are the synthesis layer for a private council. Find the genuine overlap, surface the real "
            "disagreements, and recommend the smallest useful next step. Do not invent evidence."
        )
        user_prompt = (
            f"Original prompt:\n{prompt}\n\n"
            "Persona responses:\n"
            f"{chr(10).join(rendered_responses)}\n\n"
            "Return concise synthesis output."
        )
        schema = {
            "type": "object",
            "properties": {
                "agreements": {"type": "array", "items": {"type": "string"}},
                "disagreements": {"type": "array", "items": {"type": "string"}},
                "next_step": {"type": "string"},
                "combined_recommendation": {"type": "string"},
            },
            "required": ["agreements", "disagreements", "next_step", "combined_recommendation"],
        }
        payload = self._generate_json(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            schema=schema,
            temperature=0.2,
        )
        return {
            "agreements": [str(item).strip() for item in payload.get("agreements", []) if str(item).strip()],
            "disagreements": [
                str(item).strip() for item in payload.get("disagreements", []) if str(item).strip()
            ],
            "next_step": str(payload["next_step"]).strip(),
            "combined_recommendation": str(payload["combined_recommendation"]).strip(),
        }

    def _generate_json(
        self,
        *,
        system_instruction: str,
        user_prompt: str,
        schema: dict[str, Any],
        temperature: float,
    ) -> dict[str, Any]:
        response = httpx.post(
            self.endpoint,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            },
            json={
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "responseMimeType": "application/json",
                    "responseJsonSchema": schema,
                },
            },
            timeout=45.0,
        )
        if response.status_code >= 400:
            raise RuntimeError(self._extract_error_message(response))

        body = response.json()
        text_payload = self._extract_text_payload(body)
        try:
            parsed = json.loads(text_payload)
        except json.JSONDecodeError as error:
            raise RuntimeError("Gemini returned invalid JSON") from error

        if not isinstance(parsed, dict):
            raise RuntimeError("Gemini returned a non-object JSON payload")
        return parsed

    @staticmethod
    def _extract_text_payload(body: dict[str, Any]) -> str:
        candidates = body.get("candidates") or []
        if not candidates:
            raise RuntimeError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_chunks = [part.get("text", "") for part in parts if part.get("text")]
        payload = "".join(text_chunks).strip()
        if not payload:
            raise RuntimeError("Gemini returned an empty response payload")
        return payload

    @staticmethod
    def _extract_error_message(response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return f"Gemini request failed with status {response.status_code}"

        error_message = payload.get("error", {}).get("message")
        if error_message:
            return str(error_message)
        return f"Gemini request failed with status {response.status_code}"

    @staticmethod
    def _format_list(values: Any) -> str:
        if not values:
            return "- none provided"
        return "\n".join(f"- {value}" for value in values)

    @staticmethod
    def _format_evidence(evidence_snippets: list[dict[str, Any]] | None) -> str:
        if not evidence_snippets:
            return "- No retrieved evidence snippets available."
        lines = []
        for item in evidence_snippets:
            source_title = item.get("source_title") or "Untitled source"
            score = item.get("score")
            score_text = f"{score:.2f}" if isinstance(score, (float, int)) else "n/a"
            lines.append(f"- {source_title} (score {score_text}): {item.get('chunk_text', '')}")
        return "\n".join(lines)

    @staticmethod
    def _normalize_response_type(value: Any) -> str:
        normalized = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
        if normalized in {"answer", "inference", "no_basis"}:
            return normalized
        if normalized in {"advice", "strategic_advice", "recommendation", "opinion"}:
            return "inference"
        if normalized in {"unknown", "unsupported", "insufficient_basis"}:
            return "no_basis"
        return "inference"
