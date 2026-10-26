"""shared login throttling state

Revision ID: 006_shared_login_throttling
Revises: 005_exam_session_security
Create Date: 2026-10-15
"""

from alembic import op
import sqlalchemy as sa


revision = "006_shared_login_throttling"
down_revision = "005_exam_session_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_failures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("attempted_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_login_failures_key_hash", "login_failures", ["key_hash"])
    op.create_index("ix_login_failures_attempted_at", "login_failures", ["attempted_at"])


def downgrade() -> None:
    op.drop_index("ix_login_failures_attempted_at", table_name="login_failures")
    op.drop_index("ix_login_failures_key_hash", table_name="login_failures")
    op.drop_table("login_failures")
