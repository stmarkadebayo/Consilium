"""add job queue indexes

Revision ID: 0004_job_queue_indexes
Revises: 0003_pgvector_indexes
Create Date: 2026-03-13 15:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_job_queue_indexes"
down_revision = "0003_pgvector_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_jobs_queue_pending",
        "jobs",
        ["status", "job_type", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_jobs_queue_running",
        "jobs",
        ["status", "job_type", "started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_queue_running", table_name="jobs")
    op.drop_index("ix_jobs_queue_pending", table_name="jobs")
