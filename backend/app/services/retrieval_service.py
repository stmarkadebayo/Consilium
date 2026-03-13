from __future__ import annotations

import math
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Query
from sqlalchemy.orm import Session, joinedload

from app.config import Settings
from app.models.persona import Persona, PersonaSource, PersonaSourceChunk


class RetrievalService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.embedding_model = settings.embedding_model
        self.embedding_dimensions = settings.embedding_dimensions or 768
        self.gemini_api_key = settings.gemini_api_key
        self.enabled = bool(self.embedding_model and self.gemini_api_key)
        self.source_quality_threshold = 0.4
        self.chunk_size = 500
        self.chunk_overlap = 80
        self.top_k = 4

    def sync_persona_index(self, db: Session, persona: Persona) -> None:
        persona = (
            db.query(Persona)
            .options(joinedload(Persona.sources).joinedload(PersonaSource.chunks))
            .filter(Persona.id == persona.id)
            .first()
        ) or persona

        generated_source = self._get_or_create_generated_source(db, persona)
        generated_source.notes_json = {
            **(generated_source.notes_json or {}),
            "generated": True,
            "content": self._build_profile_document(persona),
        }
        generated_source.title = "Persona profile"
        generated_source.publisher = "Consilium"
        generated_source.source_type = "other"
        generated_source.quality_score = persona.source_quality_score or 0.6
        generated_source.is_primary = False
        db.add(generated_source)
        db.flush()

        sources_to_index = list(persona.sources)
        if all(source.id != generated_source.id for source in sources_to_index):
            sources_to_index.append(generated_source)

        for source in sources_to_index:
            source_text = self._extract_source_text(source, persona)
            source.chunks.clear()
            if not source_text:
                continue

            chunks = self._split_text(source_text)
            embeddings = self._embed_texts(chunks, task_type="RETRIEVAL_DOCUMENT", title=source.title)
            for index, chunk_text in enumerate(chunks):
                db.add(
                    PersonaSourceChunk(
                        source_id=source.id,
                        persona_id=persona.id,
                        chunk_text=chunk_text,
                        chunk_index=index,
                        embedding=embeddings[index] if index < len(embeddings) else None,
                    )
                )
        db.flush()

    def retrieve_evidence(
        self,
        db: Session,
        *,
        persona_id: str,
        prompt: str,
        limit: Optional[int] = None,
        query_embedding: Optional[list[float]] = None,
    ) -> list[dict[str, Any]]:
        query_vector = query_embedding
        if query_vector is None and self.enabled:
            embeddings = self._embed_texts([prompt], task_type="RETRIEVAL_QUERY")
            query_vector = embeddings[0] if embeddings else None

        rows = self._load_candidate_rows(
            db,
            persona_id=persona_id,
            query_embedding=query_vector,
            limit=limit or self.top_k,
        )
        if not rows:
            return []

        scored_rows = []
        for row in rows:
            source = row.source
            if source is None:
                continue
            if not self._allow_source(source):
                continue

            score = self._score_chunk(row, prompt=prompt, query_embedding=query_vector)
            scored_rows.append((score, row))

        scored_rows.sort(key=lambda item: item[0], reverse=True)
        selected = scored_rows[: (limit or self.top_k)]
        return [
            {
                "chunk_text": row.chunk_text,
                "source_id": row.source_id,
                "source_title": row.source.title,
                "source_url": row.source.url,
                "source_type": row.source.source_type,
                "quality_score": row.source.quality_score,
                "is_primary": row.source.is_primary,
                "score": round(score, 4),
            }
            for score, row in selected
        ]

    def _load_candidate_rows(
        self,
        db: Session,
        *,
        persona_id: str,
        query_embedding: Optional[list[float]],
        limit: int,
    ) -> list[PersonaSourceChunk]:
        if self._database_supports_vector_search(db, query_embedding):
            rows = self._retrieve_pgvector_candidates(
                db,
                persona_id=persona_id,
                query_embedding=query_embedding or [],
                limit=limit,
            )
            if rows:
                return rows

        return (
            db.query(PersonaSourceChunk)
            .options(joinedload(PersonaSourceChunk.source))
            .filter(PersonaSourceChunk.persona_id == persona_id)
            .all()
        )

    def embed_query(self, text: str) -> Optional[list[float]]:
        if not self.enabled:
            return None
        embeddings = self._embed_texts([text], task_type="RETRIEVAL_QUERY")
        return embeddings[0] if embeddings else None

    def _embed_texts(
        self,
        texts: list[str],
        *,
        task_type: str,
        title: Optional[str] = None,
    ) -> list[Optional[list[float]]]:
        if not self.enabled:
            return [None for _ in texts]

        embeddings: list[Optional[list[float]]] = []
        for text in texts:
            response = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.embedding_model}:embedContent",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.gemini_api_key,
                },
                json={
                    "model": f"models/{self.embedding_model}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                    "title": title,
                    "outputDimensionality": self.embedding_dimensions,
                },
                timeout=45.0,
            )
            if response.status_code >= 400:
                raise RuntimeError(self._extract_error_message(response))

            payload = response.json()
            vector = payload.get("embedding", {}).get("values")
            embeddings.append(vector if isinstance(vector, list) else None)
        return embeddings

    @staticmethod
    def _database_supports_vector_search(db: Session, query_embedding: Optional[list[float]]) -> bool:
        if not query_embedding:
            return False
        bind = db.get_bind()
        return bool(bind is not None and bind.dialect.name == "postgresql")

    def _retrieve_pgvector_candidates(
        self,
        db: Session,
        *,
        persona_id: str,
        query_embedding: list[float],
        limit: int,
    ) -> list[PersonaSourceChunk]:
        candidate_limit = max(limit, self.top_k) * 8
        distance_expr = PersonaSourceChunk.embedding.cosine_distance(query_embedding)
        query: Query[PersonaSourceChunk] = (
            db.query(PersonaSourceChunk)
            .options(joinedload(PersonaSourceChunk.source))
            .filter(
                PersonaSourceChunk.persona_id == persona_id,
                PersonaSourceChunk.embedding.is_not(None),
            )
            .order_by(distance_expr.asc())
            .limit(candidate_limit)
        )
        return query.all()

    def _score_chunk(
        self,
        chunk: PersonaSourceChunk,
        *,
        prompt: str,
        query_embedding: Optional[list[float]],
    ) -> float:
        source = chunk.source
        quality_score = (source.quality_score if source and source.quality_score is not None else 0.5)
        primary_bonus = 0.08 if source and source.is_primary else 0.0
        semantic_score = 0.0
        if query_embedding and chunk.embedding:
            semantic_score = self._cosine_similarity(query_embedding, chunk.embedding)
        lexical_score = self._lexical_overlap(prompt, chunk.chunk_text)
        return (semantic_score * 0.7) + (lexical_score * 0.3) + quality_score * 0.1 + primary_bonus

    def _get_or_create_generated_source(self, db: Session, persona: Persona) -> PersonaSource:
        for source in persona.sources:
            if source.url == self._generated_source_url(persona.id):
                return source

        source = PersonaSource(
            persona_id=persona.id,
            url=self._generated_source_url(persona.id),
            title="Persona profile",
            source_type="other",
            publisher="Consilium",
            quality_score=persona.source_quality_score or 0.6,
            is_primary=False,
            notes_json={"generated": True},
        )
        db.add(source)
        db.flush()
        return source

    @staticmethod
    def _generated_source_url(persona_id: str) -> str:
        return f"consilium://persona/{persona_id}/profile"

    @staticmethod
    def _allow_source(source: PersonaSource) -> bool:
        notes = source.notes_json or {}
        if notes.get("generated"):
            return True
        quality_score = source.quality_score if source.quality_score is not None else 0.0
        return quality_score >= 0.4

    def _build_profile_document(self, persona: Persona) -> str:
        domain_confidence = ", ".join(
            f"{key}: {round(value, 2)}" for key, value in sorted((persona.domain_confidence_json or {}).items())
        ) or "none"
        sections = [
            f"Display name: {persona.display_name}",
            f"Persona type: {persona.persona_type}",
            f"Identity summary: {persona.identity_summary or 'none'}",
            f"Worldview: {'; '.join(persona.worldview_json or []) or 'none'}",
            f"Communication style: {'; '.join(persona.communication_style_json or []) or 'none'}",
            f"Decision style: {'; '.join(persona.decision_style_json or []) or 'none'}",
            f"Values: {'; '.join(persona.values_json or []) or 'none'}",
            f"Blind spots: {'; '.join(persona.blind_spots_json or []) or 'none'}",
            f"Domain confidence: {domain_confidence}",
        ]
        return "\n".join(sections)

    def _extract_source_text(self, source: PersonaSource, persona: Persona) -> str:
        notes = source.notes_json or {}
        if notes.get("content"):
            return str(notes["content"])
        if notes.get("excerpt"):
            return str(notes["excerpt"])
        if source.url == self._generated_source_url(persona.id):
            return self._build_profile_document(persona)
        fallback_parts = [source.title or "", source.publisher or "", source.url]
        return "\n".join(part for part in fallback_parts if part)

    def _split_text(self, text: str) -> list[str]:
        normalized = " ".join(text.split())
        if len(normalized) <= self.chunk_size:
            return [normalized]

        chunks = []
        start = 0
        while start < len(normalized):
            end = min(len(normalized), start + self.chunk_size)
            chunks.append(normalized[start:end])
            if end >= len(normalized):
                break
            start = max(end - self.chunk_overlap, start + 1)
        return chunks

    @staticmethod
    def _lexical_overlap(prompt: str, chunk_text: str) -> float:
        prompt_terms = {term for term in RetrievalService._tokenize(prompt) if len(term) > 2}
        chunk_terms = {term for term in RetrievalService._tokenize(chunk_text) if len(term) > 2}
        if not prompt_terms or not chunk_terms:
            return 0.0
        overlap = len(prompt_terms & chunk_terms)
        return overlap / max(len(prompt_terms), 1)

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        token = []
        tokens = []
        for char in text.lower():
            if char.isalnum():
                token.append(char)
            elif token:
                tokens.append("".join(token))
                token = []
        if token:
            tokens.append("".join(token))
        return tokens

    @staticmethod
    def _cosine_similarity(left: list[float], right: list[float]) -> float:
        if len(left) != len(right) or not left or not right:
            return 0.0
        numerator = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return numerator / (left_norm * right_norm)

    @staticmethod
    def _extract_error_message(response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return f"Embedding request failed with status {response.status_code}"
        return str(payload.get("error", {}).get("message") or f"Embedding request failed with status {response.status_code}")
