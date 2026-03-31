from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.conversation import Conversation, Message

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


class MemoryService:
    """Three-layer conversation memory from the brief:

    Layer 1: Recent turns — latest N messages kept in immediate context
    Layer 2: Rolling summary — updated after every few turns
    Layer 3: Pinned facts — stable constraints and conclusions
    """

    @staticmethod
    def build_thread_context(
        db: Session,
        *,
        conversation: Conversation,
        settings,
    ) -> str:
        """Assemble the thread context from all 3 memory layers."""
        parts: list[str] = []

        # Layer 3: Pinned facts
        pinned = conversation.pinned_facts or []
        if pinned:
            parts.append("## Pinned Facts")
            for fact in pinned:
                parts.append(f"- {fact}")
            parts.append("")

        # Layer 2: Rolling summary
        if conversation.rolling_summary:
            parts.append("## Conversation Summary")
            parts.append(conversation.rolling_summary)
            parts.append("")

        # Layer 1: Recent turns
        recent_limit = getattr(settings, "memory_recent_turns", 6)
        recent_messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id)
            .order_by(Message.turn_number.desc(), Message.created_at.desc())
            .limit(recent_limit * 5)  # Fetch more to cover all roles per turn
            .all()
        )
        recent_messages.reverse()

        if recent_messages:
            parts.append("## Recent Conversation")
            for msg in recent_messages:
                if msg.role == "user":
                    parts.append(f"User: {msg.content}")
                elif msg.role == "persona":
                    snapshot = msg.persona_snapshot
                    name = "Unknown"
                    if snapshot and snapshot.snapshot_json:
                        name = snapshot.snapshot_json.get("display_name", "Unknown")
                    parts.append(f"{name}: {msg.content}")
                elif msg.role == "synthesis":
                    parts.append(f"Synthesis: {msg.content}")
            parts.append("")

        return "\n".join(parts) if parts else "No previous conversation context."

    @staticmethod
    def update_rolling_summary(
        db: Session,
        *,
        conversation: Conversation,
        provider,
        settings,
    ) -> None:
        """Update the rolling summary after new messages are added."""
        summary_interval = getattr(settings, "memory_summary_interval", 4)

        # Count user messages to decide if we should update
        user_msg_count = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id, Message.role == "user")
            .count()
        )

        if user_msg_count < summary_interval:
            return

        # Only update every N turns
        if user_msg_count % summary_interval != 0:
            return

        try:
            prompt_template = (PROMPTS_DIR / "memory_summary.txt").read_text()

            # Get recent messages since last summary
            recent = (
                db.query(Message)
                .filter(Message.conversation_id == conversation.id)
                .order_by(Message.turn_number.desc(), Message.created_at.desc())
                .limit(summary_interval * 5)
                .all()
            )
            recent.reverse()

            new_messages_text = "\n".join(
                f"[{m.role}] {m.content}" for m in recent if m.content
            )

            prompt = prompt_template.format(
                current_summary=conversation.rolling_summary or "No previous summary.",
                new_messages=new_messages_text,
            )

            updated_summary = provider.generate_text(
                prompt,
                model_key="synthesis",
                purpose="memory_summary",
            )

            conversation.rolling_summary = updated_summary.strip()
            db.add(conversation)
            db.flush()
        except Exception as error:
            logger.warning("Failed to update rolling summary: %s", error)
