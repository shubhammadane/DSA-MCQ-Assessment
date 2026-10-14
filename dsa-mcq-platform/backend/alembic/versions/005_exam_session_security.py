"""exam session access codes and result release policy

Revision ID: 005_exam_session_security
Revises: 004_admin_users_and_roles
Create Date: 2026-10-14
"""

from alembic import op
import sqlalchemy as sa


revision = "005_exam_session_security"
down_revision = "004_admin_users_and_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("exams")}
    with op.batch_alter_table("exams") as batch_op:
        if "session_code_hash" not in columns:
            batch_op.add_column(sa.Column("session_code_hash", sa.String(), nullable=True))
        if "session_code_rotated_at" not in columns:
            batch_op.add_column(sa.Column("session_code_rotated_at", sa.DateTime(), nullable=True))
        if "result_release_mode" not in columns:
            batch_op.add_column(
                sa.Column("result_release_mode", sa.String(), server_default="after_close", nullable=False)
            )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("exams")}
    with op.batch_alter_table("exams") as batch_op:
        for name in ("result_release_mode", "session_code_rotated_at", "session_code_hash"):
            if name in columns:
                batch_op.drop_column(name)
