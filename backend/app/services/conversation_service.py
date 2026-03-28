from __future__ import annotations

from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.engines.council_reasoning import CouncilReasoningEngine
from app.models.conversation import Conversation, Message, PersonaResponse
from app.models.job import Job
from app.models.user import User
from app.services.council_service import CouncilService
from app.services.job_service import JobService


class ConversationService:
    @staticmethod
    def create_conversation(db: Session, *, user: User, title: Optional[str] = None) -> Conversation:
        council = CouncilService.get_or_create_for_user(db, user)
        conversation = Conversation(user_id=user.id, council_id=council.id, title=title)
        db.add(conversation)
        db.flush()
        db.refresh(conversation)
        return conversation

    @staticmethod
    def list_conversations(db: Session, *, user_id: str, cursor: Optional[str] = None, limit: int = 20) -> Tuple[list[dict], Optional[str]]:
        query = (
            db.query(Conversation)
            .options(joinedload(Conversation.messages))
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.created_at.desc())
        )
        if cursor:
            cursor_row = db.query(Conversation).filter(Conversation.id == cursor, Conversation.user_id == user_id).first()
            if cursor_row:
                query = query.filter(Conversation.created_at < cursor_row.created_at)

        rows = query.limit(limit + 1).all()
        next_cursor = rows[-1].id if len(rows) > limit else None
        rows = rows[:limit]
        items = [
            {
                "id": row.id,
                "title": row.title,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "message_count": len(row.messages),
            }
            for row in rows
        ]
        return items, next_cursor

    @staticmethod
    def get_conversation(db: Session, *, conversation_id: str, user_id: str) -> Optional[Conversation]:
        return (
            db.query(Conversation)
            .options(
                joinedload(Conversation.messages)
                .joinedload(Message.persona_responses)
                .joinedload(PersonaResponse.persona_snapshot),
                joinedload(Conversation.messages).joinedload(Message.synthesis),
            )
            .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
            .first()
        )

    @staticmethod
    def submit_message(
        db: Session,
        *,
        user: User,
        conversation: Conversation,
        content: str,
    ) -> tuple[Message, str]:
        council = CouncilService.get_for_user(db, user.id)
        if not council:
            raise ValueError("Council not found")

        members = CouncilService.active_members(council)
        if len(members) < council.min_personas:
            raise ValueError("At least 2 active personas are required to query the council")

        next_turn = (db.query(func.max(Message.turn_index)).filter(Message.conversation_id == conversation.id).scalar() or 0) + 1
        message = Message(conversation_id=conversation.id, role="user", content=content, turn_index=next_turn)
        db.add(message)
        db.flush()

        job = JobService.create_job(
            db,
            user_id=user.id,
            job_type="council_query",
            payload={"conversation_id": conversation.id, "message_id": message.id},
        )
        db.flush()
        db.refresh(message)
        return message, job.id

    @staticmethod
    def process_council_query_job(db: Session, job: Job, *, provider, retrieval_service) -> None:
        payload = job.payload_json or {}
        conversation_id = payload.get("conversation_id")
        message_id = payload.get("message_id")
        if not conversation_id or not message_id:
            JobService.mark_failed(job, "Council query job payload is incomplete")
            return

        conversation = (
            db.query(Conversation)
            .options(joinedload(Conversation.council))
            .filter(Conversation.id == conversation_id, Conversation.user_id == job.user_id)
            .first()
        )
        if conversation is None:
            JobService.mark_failed(job, "Conversation not found for council query job")
            return

        message = (
            db.query(Message)
            .filter(
                Message.id == message_id,
                Message.conversation_id == conversation.id,
            )
            .first()
        )
        if message is None:
            JobService.mark_failed(job, "Message not found for council query job")
            return

        if message.persona_responses or message.synthesis is not None:
            JobService.mark_completed(job, {"message_id": message.id})
            return

        council = CouncilService.get_for_user(db, job.user_id)
        if not council:
            JobService.mark_failed(job, "Council not found")
            return

        members = CouncilService.active_members(council)
        if len(members) < council.min_personas:
            JobService.mark_failed(job, "At least 2 active personas are required to query the council")
            return

        try:
            engine = CouncilReasoningEngine(provider=provider, retrieval_service=retrieval_service)
            engine.execute(
                db,
                conversation=conversation,
                message=message,
                members=members,
            )
            conversation.updated_at = message.created_at
            JobService.mark_completed(job, {"message_id": message.id})
        except Exception as error:
            JobService.mark_failed(job, str(error))
            raise
        db.flush()

    @staticmethod
    def serialize_conversation(conversation: Conversation) -> dict:
        turns = []
        for message in sorted(conversation.messages, key=lambda item: item.turn_index):
            if message.role != "user":
                continue
            persona_responses = []
            for response in message.persona_responses:
                persona_responses.append(
                    {
                        "id": response.id,
                        "persona_name": response.persona_snapshot.snapshot_json["display_name"],
                        "response_type": response.response_type,
                        "verdict": response.verdict,
                        "reasoning": response.reasoning,
                        "recommended_action": response.recommended_action,
                        "confidence": response.confidence,
                        "status": response.status,
                        "latency_ms": response.latency_ms,
                        "evidence_snippets": (response.raw_output_json or {}).get("evidence_snippets", []),
                    }
                )
            turns.append(
                {
                    "user_message": {
                        "id": message.id,
                        "content": message.content,
                        "created_at": message.created_at,
                    },
                    "persona_responses": persona_responses,
                    "synthesis": (
                        {
                            "id": message.synthesis.id,
                            "agreements": message.synthesis.agreements,
                            "disagreements": message.synthesis.disagreements,
                            "next_step": message.synthesis.next_step,
                            "combined_recommendation": message.synthesis.combined_recommendation,
                            "created_at": message.synthesis.created_at,
                        }
                        if message.synthesis
                        else None
                    ),
                }
            )
        return {"id": conversation.id, "title": conversation.title, "turns": turns}
