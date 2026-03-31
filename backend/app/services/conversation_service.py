from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.engines.council_engine import CouncilEngine
from app.models.conversation import Conversation, Message
from app.models.job import Job
from app.models.user import User
from app.services.council_service import CouncilService
from app.services.event_service import EventService
from app.services.job_service import JobService
from app.services.memory_service import MemoryService
from app.services.persona_service import PersonaService
from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()

class ConversationService:
    @staticmethod
    def create_conversation(db: Session, *, user: User, title: str | None = None) -> Conversation:
        council = CouncilService.get_or_create_for_user(db, user)
        conversation = Conversation(user_id=user.id, council_id=council.id, title=title)
        db.add(conversation)
        db.flush()
        db.refresh(conversation)
        return conversation

    @staticmethod
    def list_conversations(db: Session, *, user_id: str, limit: int = 50) -> list[dict]:
        rows = (
            db.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "title": r.title,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "message_count": len(r.messages) if r.messages else 0,
            }
            for r in rows
        ]

    @staticmethod
    def get_conversation(db: Session, *, conversation_id: str, user_id: str) -> Optional[Conversation]:
        return (
            db.query(Conversation)
            .options(
                joinedload(Conversation.messages).joinedload(Message.persona_snapshot),
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
        provider: BaseProvider | None = None,
    ) -> tuple[Message, str]:
        """Submit a user message and create a council query job."""
        council = CouncilService.get_for_user(db, user.id)
        if not council:
            raise ValueError("Council not found")

        members = CouncilService.active_members(council)
        if len(members) < council.min_personas:
            raise ValueError(f"At least {council.min_personas} active personas required")

        next_turn = (
            db.query(func.max(Message.turn_number))
            .filter(Message.conversation_id == conversation.id)
            .scalar() or 0
        ) + 1

        message = Message(
            conversation_id=conversation.id,
            role="user",
            content=content,
            turn_number=next_turn,
        )
        db.add(message)

        is_first_turn = next_turn == 1
        if is_first_turn and provider:
            try:
                prompt_template = _load_prompt("conversation_title.txt")
                prompt = prompt_template.format(user_message=content)
                title = provider.generate_text(prompt, model_key="synthesis", purpose="title_generation").strip()
                title = title.strip('"').strip("'")
                if title:
                    conversation.title = title
                    db.add(conversation)
            except Exception as e:
                logger.error(f"Failed to generate title: {e}")

        db.flush()

        job = JobService.create_job(
            db,
            user_id=user.id,
            job_type="council_query",
            payload={"conversation_id": conversation.id, "message_id": message.id},
        )
        db.flush()

        if is_first_turn:
            EventService.record(
                db,
                user_id=user.id,
                job_id=job.id,
                event_type="consult_started",
                payload={
                    "conversation_id": conversation.id,
                    "message_id": message.id,
                },
            )

        db.refresh(message)
        return message, job.id

    @staticmethod
    def start_consult(
        db: Session,
        *,
        user: User,
        content: str,
        provider: BaseProvider | None = None,
    ) -> tuple[Conversation, Message, str]:
        conversation = ConversationService.create_conversation(db, user=user)
        message, job_id = ConversationService.submit_message(
            db,
            user=user,
            conversation=conversation,
            content=content,
            provider=provider,
        )
        db.refresh(conversation)
        return conversation, message, job_id

    @staticmethod
    def process_council_query_job(db: Session, job: Job, *, provider, settings) -> None:
        """Background job handler: runs the council engine."""
        payload = job.payload_json or {}
        conversation_id = payload.get("conversation_id")
        message_id = payload.get("message_id")

        if not conversation_id or not message_id:
            JobService.mark_failed(job, "Incomplete council query job payload")
            return

        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.user_id == job.user_id)
            .first()
        )
        if not conversation:
            JobService.mark_failed(job, "Conversation not found")
            return

        user_message = (
            db.query(Message)
            .filter(Message.id == message_id, Message.conversation_id == conversation.id)
            .first()
        )
        if not user_message:
            JobService.mark_failed(job, "Message not found")
            return

        # Check if already processed
        existing = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation.id,
                Message.turn_number == user_message.turn_number,
                Message.role == "persona",
            )
            .first()
        )
        if existing:
            JobService.mark_completed(job, {"message_id": message_id})
            return

        council = CouncilService.get_for_user(db, job.user_id)
        if not council:
            JobService.mark_failed(job, "Council not found")
            return

        members = CouncilService.active_members(council)
        if len(members) < council.min_personas:
            JobService.mark_failed(job, "Not enough active personas")
            return

        try:
            # Create snapshots
            snapshots = [PersonaService.create_snapshot(db, m.persona) for m in members]

            # Build thread context (3-layer memory)
            thread_context = MemoryService.build_thread_context(
                db,
                conversation=conversation,
                settings=settings,
            )

            # Run council engine
            engine = CouncilEngine(provider=provider)
            persona_messages, synthesis_msg = engine.execute(
                db,
                conversation=conversation,
                user_message=user_message,
                snapshots=snapshots,
                thread_context=thread_context,
            )

            # Update rolling summary
            MemoryService.update_rolling_summary(
                db,
                conversation=conversation,
                provider=provider,
                settings=settings,
            )

            conversation.updated_at = user_message.created_at
            db.add(conversation)

            JobService.mark_completed(job, {"message_id": message_id})
            EventService.record(
                db,
                user_id=job.user_id,
                job_id=job.id,
                event_type="council_query_completed",
                payload={"conversation_id": conversation.id, "message_id": message_id},
            )
            if user_message.turn_number == 1:
                successful_persona_count = sum(
                    1 for message in persona_messages if message.status == "completed"
                )
                if successful_persona_count > 0:
                    EventService.record(
                        db,
                        user_id=job.user_id,
                        job_id=job.id,
                        event_type="first_response_completed",
                        payload={
                            "conversation_id": conversation.id,
                            "message_id": message_id,
                            "successful_persona_count": successful_persona_count,
                        },
                    )
                if synthesis_msg is not None:
                    EventService.record(
                        db,
                        user_id=job.user_id,
                        job_id=job.id,
                        event_type="synthesis_completed",
                        payload={
                            "conversation_id": conversation.id,
                            "message_id": message_id,
                            "synthesis_message_id": synthesis_msg.id,
                        },
                    )
        except Exception as error:
            logger.exception("Council query failed for conversation %s", conversation_id)
            JobService.mark_failed(job, str(error))
            EventService.record(
                db,
                user_id=job.user_id,
                job_id=job.id,
                event_type="council_query_failed",
                payload={"conversation_id": conversation_id, "error": str(error)},
            )
            raise
        db.flush()

    @staticmethod
    def serialize_conversation(conversation: Conversation) -> dict:
        """Serialize a conversation with grouped turns."""
        turns: dict[int, dict] = {}

        for message in sorted(conversation.messages, key=lambda m: (m.turn_number, m.created_at)):
            turn_num = message.turn_number
            if turn_num not in turns:
                turns[turn_num] = {
                    "turn_number": turn_num,
                    "user_message": None,
                    "persona_responses": [],
                    "synthesis": None,
                }

            if message.role == "user":
                turns[turn_num]["user_message"] = {
                    "id": message.id,
                    "content": message.content,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                }
            elif message.role == "persona":
                snapshot = message.persona_snapshot
                persona_name = "Unknown"
                if snapshot and snapshot.snapshot_json:
                    persona_name = snapshot.snapshot_json.get("display_name", "Unknown")

                turns[turn_num]["persona_responses"].append({
                    "id": message.id,
                    "persona_name": persona_name,
                    "content": message.content,
                    "answer_mode": (message.internal_json or {}).get("answer_mode"),
                    "confidence": (message.internal_json or {}).get("confidence"),
                    "stance": (message.internal_json or {}).get("stance"),
                    "latency_ms": message.latency_ms,
                    "status": message.status,
                })
            elif message.role == "synthesis":
                internal = message.internal_json or {}
                turns[turn_num]["synthesis"] = {
                    "id": message.id,
                    "agreements": internal.get("agreements", []),
                    "disagreements": internal.get("disagreements", []),
                    "next_step": internal.get("next_step"),
                    "combined_recommendation": internal.get("combined_recommendation", message.content),
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                }

        return {
            "id": conversation.id,
            "title": conversation.title,
            "turns": [turns[k] for k in sorted(turns.keys())],
        }
