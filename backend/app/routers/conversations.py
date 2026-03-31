from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.dependencies import DbDep, UserDep
from app.schemas import (
    ConversationSummaryResponse,
    CreateConversationRequest,
    StartConsultRequest,
    StartConsultResponse,
    SubmitMessageRequest,
    SubmitMessageResponse,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_conversations(user: UserDep, db: DbDep):
    items = ConversationService.list_conversations(db, user_id=user.id)
    return {"conversations": items}


@router.post("")
def create_conversation(body: CreateConversationRequest, user: UserDep, db: DbDep):
    conversation = ConversationService.create_conversation(db, user=user, title=body.title)
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
        "message_count": 0,
    }


@router.post("/consult", response_model=StartConsultResponse)
def start_consult(
    body: StartConsultRequest,
    user: UserDep,
    db: DbDep,
    request: Request,
):
    try:
        conversation, message, job_id = ConversationService.start_consult(
            db,
            user=user,
            content=body.content,
            provider=request.app.state.provider,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return StartConsultResponse(
        conversation_id=conversation.id,
        message_id=message.id,
        job_id=job_id,
    )


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, user: UserDep, db: DbDep):
    conversation = ConversationService.get_conversation(
        db, conversation_id=conversation_id, user_id=user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationService.serialize_conversation(conversation)


@router.post("/{conversation_id}/messages", response_model=SubmitMessageResponse)
def submit_message(
    conversation_id: str,
    body: SubmitMessageRequest,
    user: UserDep,
    db: DbDep,
    request: Request,
):
    conversation = ConversationService.get_conversation(
        db, conversation_id=conversation_id, user_id=user.id
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    try:
        message, job_id = ConversationService.submit_message(
            db, user=user, conversation=conversation, content=body.content, provider=request.app.state.provider
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return SubmitMessageResponse(message_id=message.id, job_id=job_id)
