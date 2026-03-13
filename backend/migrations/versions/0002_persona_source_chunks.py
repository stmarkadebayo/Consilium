"""add persona source chunks

Revision ID: 0002_persona_source_chunks
Revises: 0001_initial
Create Date: 2026-03-13 14:20:00
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision = "0002_persona_source_chunks"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "persona_source_chunks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("source_id", sa.String(length=36), sa.ForeignKey("persona_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("persona_id", sa.String(length=36), sa.ForeignKey("personas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column(
            "embedding",
            Vector(768) if bind.dialect.name == "postgresql" else sa.JSON(),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_persona_source_chunks_source_id", "persona_source_chunks", ["source_id"])
    op.create_index("ix_persona_source_chunks_persona_id", "persona_source_chunks", ["persona_id"])


def downgrade() -> None:
    op.drop_index("ix_persona_source_chunks_persona_id", table_name="persona_source_chunks")
    op.drop_index("ix_persona_source_chunks_source_id", table_name="persona_source_chunks")
    op.drop_table("persona_source_chunks")
