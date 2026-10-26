"""Keep assessment tables private from Supabase's browser Data API.

Revision ID: 008_supabase_table_privacy
Revises: 007_exam_concurrency
"""
from alembic import op

revision = "008_supabase_table_privacy"
down_revision = "007_exam_concurrency"
branch_labels = None
depends_on = None

TABLES = (
    "departments", "programs", "academic_years", "semesters", "subjects",
    "students", "questions", "exams", "exam_questions", "exam_students",
    "assessment_settings", "attempts", "student_answers", "exam_security_logs",
    "admin_users", "login_failures", "alembic_version",
)


def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        # FastAPI connects as the table owner. Anonymous/authenticated Data API
        # roles get no access without policies; authorization stays in FastAPI.
        for name in TABLES:
            op.execute(f'ALTER TABLE "{name}" ENABLE ROW LEVEL SECURITY')


def downgrade():
    if op.get_bind().dialect.name == "postgresql":
        for name in TABLES:
            op.execute(f'ALTER TABLE "{name}" DISABLE ROW LEVEL SECURITY')
