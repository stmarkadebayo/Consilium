"""initial backend schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-03-13 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("onboarding_done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("tier", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_external_id", "users", ["external_id"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])

    op.create_table(
        "councils",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("min_personas", sa.Integer(), nullable=False),
        sa.Column("max_personas", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_councils_user_id", "councils", ["user_id"], unique=True)

    op.create_table(
        "personas",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("persona_type", sa.String(length=32), nullable=False),
        sa.Column("identity_summary", sa.String(), nullable=True),
        sa.Column("worldview_json", sa.JSON(), nullable=False),
        sa.Column("communication_style_json", sa.JSON(), nullable=False),
        sa.Column("decision_style_json", sa.JSON(), nullable=False),
        sa.Column("values_json", sa.JSON(), nullable=False),
        sa.Column("blind_spots_json", sa.JSON(), nullable=False),
        sa.Column("domain_confidence_json", sa.JSON(), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False),
        sa.Column("source_quality_score", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_personas_user_id", "personas", ["user_id"])

    op.create_table(
        "persona_drafts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("input_name", sa.String(length=255), nullable=False),
        sa.Column("persona_type", sa.String(length=32), nullable=False),
        sa.Column("custom_brief", sa.String(), nullable=True),
        sa.Column("draft_profile_json", sa.JSON(), nullable=False),
        sa.Column("review_status", sa.String(length=32), nullable=False),
        sa.Column("job_id", sa.String(length=36), sa.ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_persona_drafts_user_id", "persona_drafts", ["user_id"])

    op.create_table(
        "persona_snapshots",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("persona_id", sa.String(length=36), sa.ForeignKey("personas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_persona_snapshots_persona_id", "persona_snapshots", ["persona_id"])

    op.create_table(
        "persona_sources",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("persona_id", sa.String(length=36), sa.ForeignKey("personas.id", ondelete="CASCADE"), nullable=True),
        sa.Column("draft_id", sa.String(length=36), sa.ForeignKey("persona_drafts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("publisher", sa.String(length=255), nullable=True),
        sa.Column("quality_score", sa.Float(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes_json", sa.JSON(), nullable=False),
    )
    op.create_index("ix_persona_sources_persona_id", "persona_sources", ["persona_id"])
    op.create_index("ix_persona_sources_draft_id", "persona_sources", ["draft_id"])

    op.create_table(
        "council_members",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("council_id", sa.String(length=36), sa.ForeignKey("councils.id", ondelete="CASCADE"), nullable=False),
        sa.Column("persona_id", sa.String(length=36), sa.ForeignKey("personas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("council_id", "persona_id", name="uq_council_persona"),
    )
    op.create_index("ix_council_members_council_id", "council_members", ["council_id"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("council_id", sa.String(length=36), sa.ForeignKey("councils.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])
    op.create_index("ix_conversations_council_id", "conversations", ["council_id"])

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("conversation_id", sa.String(length=36), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("turn_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    op.create_table(
        "persona_responses",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("conversation_id", sa.String(length=36), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", sa.String(length=36), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("persona_snapshot_id", sa.String(length=36), sa.ForeignKey("persona_snapshots.id"), nullable=False),
        sa.Column("response_type", sa.String(length=32), nullable=False),
        sa.Column("verdict", sa.Text(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("recommended_action", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("raw_output_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_persona_responses_conversation_id", "persona_responses", ["conversation_id"])
    op.create_index("ix_persona_responses_message_id", "persona_responses", ["message_id"])

    op.create_table(
        "syntheses",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("conversation_id", sa.String(length=36), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message_id", sa.String(length=36), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agreements", sa.JSON(), nullable=False),
        sa.Column("disagreements", sa.JSON(), nullable=False),
        sa.Column("next_step", sa.Text(), nullable=True),
        sa.Column("combined_recommendation", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("raw_output_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("message_id", name="uq_syntheses_message"),
    )
    op.create_index("ix_syntheses_conversation_id", "syntheses", ["conversation_id"])

    op.create_table(
        "events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.String(length=36), sa.ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_events_user_id", "events", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_events_user_id", table_name="events")
    op.drop_table("events")
    op.drop_index("ix_syntheses_conversation_id", table_name="syntheses")
    op.drop_table("syntheses")
    op.drop_index("ix_persona_responses_message_id", table_name="persona_responses")
    op.drop_index("ix_persona_responses_conversation_id", table_name="persona_responses")
    op.drop_table("persona_responses")
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_conversations_council_id", table_name="conversations")
    op.drop_index("ix_conversations_user_id", table_name="conversations")
    op.drop_table("conversations")
    op.drop_index("ix_council_members_council_id", table_name="council_members")
    op.drop_table("council_members")
    op.drop_index("ix_persona_sources_draft_id", table_name="persona_sources")
    op.drop_index("ix_persona_sources_persona_id", table_name="persona_sources")
    op.drop_table("persona_sources")
    op.drop_index("ix_persona_snapshots_persona_id", table_name="persona_snapshots")
    op.drop_table("persona_snapshots")
    op.drop_index("ix_persona_drafts_user_id", table_name="persona_drafts")
    op.drop_table("persona_drafts")
    op.drop_index("ix_personas_user_id", table_name="personas")
    op.drop_table("personas")
    op.drop_index("ix_councils_user_id", table_name="councils")
    op.drop_table("councils")
    op.drop_index("ix_jobs_user_id", table_name="jobs")
    op.drop_table("jobs")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_external_id", table_name="users")
    op.drop_table("users")
