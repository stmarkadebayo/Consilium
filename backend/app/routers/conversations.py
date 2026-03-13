from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationListRead,
    ConversationRead,
    ConversationSummaryRead,
    MessageCreate,
    TurnSubmissionRead,
)
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationSummaryRead, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationSummaryRead:
    conversation = ConversationService.create_conversation(db, user=current_user, title=payload.title)
    db.commit()
    db.refresh(conversation)
    return ConversationSummaryRead(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=0,
    )


@router.get("", response_model=ConversationListRead)
def list_conversations(
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationListRead:
    conversations, next_cursor = ConversationService.list_conversations(
        db,
        user_id=current_user.id,
        cursor=cursor,
        limit=limit,
    )
    return ConversationListRead(conversations=conversations, next_cursor=next_cursor)


@router.get("/{conversation_id}", response_model=ConversationRead)
def get_conversation(conversation_id: str, db=Depends(get_db), current_user: User = Depends(get_current_user)) -> ConversationRead:
    conversation = ConversationService.get_conversation(db, conversation_id=conversation_id, user_id=current_user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return ConversationRead(**ConversationService.serialize_conversation(conversation))


@router.post("/{conversation_id}/messages", response_model=TurnSubmissionRead, status_code=status.HTTP_202_ACCEPTED)
def submit_message(
    conversation_id: str,
    payload: MessageCreate,
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TurnSubmissionRead:
    conversation = ConversationService.get_conversation(db, conversation_id=conversation_id, user_id=current_user.id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    try:
        message, job_id = ConversationService.submit_message(
            db,
            user=current_user,
            conversation=conversation,
            content=payload.content,
        )
        db.commit()
        request.app.state.job_runner.notify()
        return TurnSubmissionRead(message_id=message.id, job_id=job_id)
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
