from __future__ import annotations

from sqlalchemy.orm import Session

from app.engines.council_reasoning import CouncilReasoningEngine
from app.models.conversation import Conversation, Message, PersonaResponse, Synthesis
from app.models.council import CouncilMember


def execute_council_query(
    db: Session,
    *,
    provider,
    retrieval_service,
    conversation: Conversation,
    message: Message,
    members: list[CouncilMember],
) -> tuple[list[PersonaResponse], Synthesis]:
    engine = CouncilReasoningEngine(provider=provider, retrieval_service=retrieval_service)
    return engine.execute(
        db,
        conversation=conversation,
        message=message,
        members=members,
    )
