"""set council minimum personas to two

Revision ID: 0005_council_min_two
Revises: 0004_job_queue_indexes
Create Date: 2026-03-28 12:00:00
"""

from alembic import op


revision = "0005_council_min_two"
down_revision = "0004_job_queue_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE councils SET min_personas = 2 WHERE min_personas <> 2")


def downgrade() -> None:
    op.execute("UPDATE councils SET min_personas = 3 WHERE min_personas = 2")
