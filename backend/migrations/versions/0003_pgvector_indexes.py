"""add pgvector indexes

Revision ID: 0003_pgvector_indexes
Revises: 0002_persona_source_chunks
Create Date: 2026-03-13 15:15:00
"""

from alembic import op


revision = "0003_pgvector_indexes"
down_revision = "0002_persona_source_chunks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_persona_source_chunks_embedding_hnsw
        ON persona_source_chunks
        USING hnsw (embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS ix_persona_source_chunks_embedding_hnsw")

