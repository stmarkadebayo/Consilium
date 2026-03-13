import pytest
from pydantic import ValidationError

from app.schemas.conversation import MessageCreate
from app.schemas.persona import PersonaCreate


def test_message_create_requires_content():
    with pytest.raises(ValidationError):
        MessageCreate(content="")


def test_persona_create_validates_confidence_bounds():
    with pytest.raises(ValidationError):
        PersonaCreate(
            display_name="Advisor",
            persona_type="custom",
            domain_confidence={"strategy": 1.2},
        )


def test_persona_create_accepts_valid_payload():
    schema = PersonaCreate(
        display_name="Advisor",
        persona_type="custom",
        worldview=["clarity"],
        domain_confidence={"strategy": 0.7},
    )
    assert schema.display_name == "Advisor"
