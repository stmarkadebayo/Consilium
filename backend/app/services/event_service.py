from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.job import Event


class EventService:
    @staticmethod
    def record(
        db: Session,
        *,
        user_id: Optional[str] = None,
        job_id: Optional[str] = None,
        event_type: str,
        payload: dict | None = None,
    ) -> Event:
        event = Event(
            user_id=user_id,
            job_id=job_id,
            event_type=event_type,
            payload_json=payload or {},
        )
        db.add(event)
        db.flush()
        return event
