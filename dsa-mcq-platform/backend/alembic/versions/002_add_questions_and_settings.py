"""add_questions_and_settings

Revision ID: 002_add_questions_and_settings
Revises: 001_initial_tables
Create Date: 2026-09-30 05:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
import json
import os
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '002_add_questions_and_settings'
down_revision = '001_initial_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('option_a', sa.Text(), nullable=False),
        sa.Column('option_b', sa.Text(), nullable=False),
        sa.Column('option_c', sa.Text(), nullable=False),
        sa.Column('option_d', sa.Text(), nullable=False),
        sa.Column('correct_answer', sa.String(length=1), nullable=False),
        sa.Column('topic', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
    op.create_index(op.f('ix_questions_is_active'), 'questions', ['is_active'], unique=False)

    # 2. Create assessment_settings table
    op.create_table(
        'assessment_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_count', sa.Integer(), server_default='50', nullable=False),
        sa.Column('time_limit_minutes', sa.Integer(), server_default='60', nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessment_settings_id'), 'assessment_settings', ['id'], unique=False)

    # 3. Add columns to attempts table
    op.add_column('attempts', sa.Column('deadline_at', sa.DateTime(), nullable=True))
    op.add_column('attempts', sa.Column('completed_at', sa.DateTime(), nullable=True))
    op.add_column('attempts', sa.Column('time_limit_minutes', sa.Integer(), server_default='60', nullable=True))
    op.add_column('attempts', sa.Column('question_count_snapshot', sa.Integer(), server_default='50', nullable=True))

    # 4. Add columns to student_answers table
    op.add_column('student_answers', sa.Column('question_id', sa.Integer(), nullable=True))
    op.add_column('student_answers', sa.Column('question_text', sa.Text(), nullable=True))
    op.add_column('student_answers', sa.Column('option_a', sa.Text(), nullable=True))
    op.add_column('student_answers', sa.Column('option_b', sa.Text(), nullable=True))
    op.add_column('student_answers', sa.Column('option_c', sa.Text(), nullable=True))
    op.add_column('student_answers', sa.Column('option_d', sa.Text(), nullable=True))
    op.create_foreign_key(
        'fk_student_answers_question_id',
        'student_answers', 'questions',
        ['question_id'], ['id'],
        ondelete='SET NULL'
    )

    # 5. Seed initial assessment settings
    settings_table = table(
        'assessment_settings',
        column('id', sa.Integer),
        column('question_count', sa.Integer),
        column('time_limit_minutes', sa.Integer),
        column('updated_at', sa.DateTime)
    )
    op.bulk_insert(settings_table, [
        {
            'id': 1,
            'question_count': 50,
            'time_limit_minutes': 60,
            'updated_at': datetime.utcnow()
        }
    ])

    # 6. Seed fixed 50 DSA questions from dsa_questions.json
    candidate_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'dsa_questions.json'),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'dsa_questions.json'),
        os.path.join(os.getcwd(), 'dsa_questions.json'),
        os.path.join(os.getcwd(), 'dsa-mcq-platform', 'backend', 'dsa_questions.json'),
    ]
    json_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            json_path = p
            break

    questions_data = []
    if json_path:
        with open(json_path, 'r', encoding='utf-8') as f:
            raw_questions = json.load(f)

        now = datetime.utcnow()
        for q in raw_questions:
            opts = q.get('options', {})
            questions_data.append({
                'id': q['id'],
                'question_text': q['question'],
                'option_a': opts.get('A', ''),
                'option_b': opts.get('B', ''),
                'option_c': opts.get('C', ''),
                'option_d': opts.get('D', ''),
                'correct_answer': q['correct_answer'],
                'topic': 'Data Structures & Algorithms',
                'is_active': True,
                'created_at': now,
                'updated_at': now
            })

        questions_table = table(
            'questions',
            column('id', sa.Integer),
            column('question_text', sa.Text),
            column('option_a', sa.Text),
            column('option_b', sa.Text),
            column('option_c', sa.Text),
            column('option_d', sa.Text),
            column('correct_answer', sa.String),
            column('topic', sa.String),
            column('is_active', sa.Boolean),
            column('created_at', sa.DateTime),
            column('updated_at', sa.DateTime)
        )
        if questions_data:
            op.bulk_insert(questions_table, questions_data)

            # Update PostgreSQL sequence for questions.id if postgres dialect
            conn = op.get_bind()
            if conn.dialect.name == 'postgresql':
                conn.execute(sa.text("SELECT setval(pg_get_serial_sequence('questions', 'id'), COALESCE(MAX(id), 1)) FROM questions;"))
                conn.execute(sa.text("SELECT setval(pg_get_serial_sequence('assessment_settings', 'id'), COALESCE(MAX(id), 1)) FROM assessment_settings;"))

    # 7. Backfill existing attempts and student_answers
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE attempts 
        SET completed_at = submitted_at,
            time_limit_minutes = 60,
            question_count_snapshot = COALESCE(total_questions, 50)
        WHERE question_count_snapshot IS NULL OR time_limit_minutes IS NULL;
    """))

    # Backfill student_answers snapshot from questions table where question_number matches
    conn.execute(sa.text("""
        UPDATE student_answers sa
        SET question_id = q.id,
            question_text = q.question_text,
            option_a = q.option_a,
            option_b = q.option_b,
            option_c = q.option_c,
            option_d = q.option_d
        FROM questions q
        WHERE sa.question_number = q.id AND sa.question_text IS NULL;
    """))


def downgrade() -> None:
    op.drop_constraint('fk_student_answers_question_id', 'student_answers', type_='foreignkey')
    op.drop_column('student_answers', 'option_d')
    op.drop_column('student_answers', 'option_c')
    op.drop_column('student_answers', 'option_b')
    op.drop_column('student_answers', 'option_a')
    op.drop_column('student_answers', 'question_text')
    op.drop_column('student_answers', 'question_id')

    op.drop_column('attempts', 'question_count_snapshot')
    op.drop_column('attempts', 'time_limit_minutes')
    op.drop_column('attempts', 'completed_at')
    op.drop_column('attempts', 'deadline_at')

    op.drop_index(op.f('ix_assessment_settings_id'), table_name='assessment_settings')
    op.drop_table('assessment_settings')

    op.drop_index(op.f('ix_questions_is_active'), table_name='questions')
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
