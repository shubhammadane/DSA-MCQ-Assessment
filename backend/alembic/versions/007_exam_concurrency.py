"""Protect one-attempt exams and index the assessment request paths.

Revision ID: 007_exam_concurrency
Revises: 006_shared_login_throttling
"""
from alembic import op
import sqlalchemy as sa

revision = "007_exam_concurrency"
down_revision = "006_shared_login_throttling"
branch_labels = None
depends_on = None

INDEXES = (
    ("questions", "ix_questions_subject_active", ["subject_id", "is_active"]),
    ("questions", "ix_questions_department_active", ["department_id", "is_active"]),
    ("exam_students", "ix_exam_students_student_exam", ["student_id", "exam_id"]),
    ("attempts", "ix_attempts_exam_status", ["exam_id", "status"]),
    ("attempts", "ix_attempts_status_deadline", ["status", "deadline_at"]),
    ("exam_security_logs", "ix_security_logs_attempt_time", ["attempt_id", "occurred_at"]),
    ("login_failures", "ix_login_failures_key_time", ["key_hash", "attempted_at"]),
)


def upgrade():
    connection = op.get_bind()
    # Preserve historical records: require manual review rather than deleting duplicates.
    for table, columns, condition in (
        ("attempts", "student_id, exam_id", "WHERE exam_id IS NOT NULL"),
        ("student_answers", "attempt_id, question_number", ""),
    ):
        duplicate = connection.execute(sa.text(
            f"SELECT {columns} FROM {table} {condition} GROUP BY {columns} HAVING COUNT(*) > 1 LIMIT 1"
        )).first()
        if duplicate:
            raise RuntimeError(f"Duplicate assessment records in {table}: {tuple(duplicate)}. Review these records before migrating; no records were removed.")
    with op.batch_alter_table("attempts") as batch:
        batch.create_unique_constraint("uq_attempt_student_exam", ["student_id", "exam_id"])
    with op.batch_alter_table("student_answers") as batch:
        batch.create_unique_constraint("uq_answer_attempt_question", ["attempt_id", "question_number"])
    for table, name, columns in INDEXES:
        op.create_index(name, table, columns)


def downgrade():
    for table, name, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
    with op.batch_alter_table("student_answers") as batch:
        batch.drop_constraint("uq_answer_attempt_question", type_="unique")
    with op.batch_alter_table("attempts") as batch:
        batch.drop_constraint("uq_attempt_student_exam", type_="unique")
