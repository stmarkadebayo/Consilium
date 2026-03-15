from __future__ import annotations

import json
from typing import Any

import httpx

from app.providers.base import BaseProvider


class GeminiProvider(BaseProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        synthesis_model: str | None = None,
        persona_max_output_tokens: int = 180,
        synthesis_max_output_tokens: int = 280,
        evidence_char_limit: int = 240,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.synthesis_model = synthesis_model or model
        self.persona_max_output_tokens = persona_max_output_tokens
        self.synthesis_max_output_tokens = synthesis_max_output_tokens
        self.evidence_char_limit = evidence_char_limit

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
            "Use only the provided persona and evidence. Be grounded, concise, and decision-useful."
        )
        evidence_lines = self._format_evidence(evidence_snippets, self.evidence_char_limit)
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
            "Return one council response object. Keep reasoning under 80 words. "
            "Keep verdict and recommended_action brief. Set status to 'completed'. Set confidence between 0 and 1."
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
            model=self.model,
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            schema=schema,
            temperature=0.4,
            max_output_tokens=self.persona_max_output_tokens,
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
            "disagreements, and recommend the smallest useful next step. Stay concise and do not invent evidence."
        )
        user_prompt = (
            f"Original prompt:\n{prompt}\n\n"
            "Persona responses:\n"
            f"{chr(10).join(rendered_responses)}\n\n"
            "Return concise synthesis output. Keep each agreement/disagreement short."
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
            model=self.synthesis_model,
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            schema=schema,
            temperature=0.2,
            max_output_tokens=self.synthesis_max_output_tokens,
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
        model: str,
        system_instruction: str,
        user_prompt: str,
        schema: dict[str, Any],
        temperature: float,
        max_output_tokens: int,
    ) -> dict[str, Any]:
        text_payload = self._request_json_payload(
            model=model,
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            schema=schema,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        try:
            return self._coerce_json_object(text_payload)
        except RuntimeError as error:
            if "invalid JSON" not in str(error):
                raise

        retry_prompt = (
            f"{user_prompt}\n\n"
            "Return valid JSON only. Do not include markdown fences, commentary, or any text before or after the JSON object."
        )
        retry_payload = self._request_json_payload(
            model=model,
            system_instruction=system_instruction,
            user_prompt=retry_prompt,
            schema=schema,
            temperature=temperature,
            max_output_tokens=max(max_output_tokens, 320),
        )
        return self._coerce_json_object(retry_payload)

    def _request_json_payload(
        self,
        *,
        model: str,
        system_instruction: str,
        user_prompt: str,
        schema: dict[str, Any],
        temperature: float,
        max_output_tokens: int,
    ) -> str:
        response = httpx.post(
            self._build_endpoint(model),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": self.api_key,
            },
            json={
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_output_tokens,
                    "responseMimeType": "application/json",
                    "responseJsonSchema": schema,
                },
            },
            timeout=45.0,
        )
        if response.status_code >= 400:
            raise RuntimeError(self._extract_error_message(response))

        body = response.json()
        return self._extract_text_payload(body)

    @staticmethod
    def _build_endpoint(model: str) -> str:
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

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
    def _coerce_json_object(text_payload: str) -> dict[str, Any]:
        candidate = text_payload.strip()
        if candidate.startswith("```"):
            lines = candidate.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            candidate = "\n".join(lines).strip()

        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            start = candidate.find("{")
            end = candidate.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise RuntimeError("Gemini returned invalid JSON")
            try:
                parsed = json.loads(candidate[start : end + 1])
            except json.JSONDecodeError as error:
                raise RuntimeError("Gemini returned invalid JSON") from error

        if not isinstance(parsed, dict):
            raise RuntimeError("Gemini returned a non-object JSON payload")
        return parsed

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
    def _format_evidence(
        evidence_snippets: list[dict[str, Any]] | None, evidence_char_limit: int
    ) -> str:
        if not evidence_snippets:
            return "- No retrieved evidence snippets available."
        lines = []
        for item in evidence_snippets:
            source_title = item.get("source_title") or "Untitled source"
            score = item.get("score")
            score_text = f"{score:.2f}" if isinstance(score, (float, int)) else "n/a"
            chunk_text = str(item.get("chunk_text", "")).strip()
            if len(chunk_text) > evidence_char_limit:
                chunk_text = f"{chunk_text[:evidence_char_limit].rstrip()}..."
            lines.append(f"- {source_title} (score {score_text}): {chunk_text}")
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
