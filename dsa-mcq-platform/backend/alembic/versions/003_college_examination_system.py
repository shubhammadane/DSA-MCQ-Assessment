"""college_examination_system

Revision ID: 003_college_examination_system
Revises: 002_add_questions_and_settings
Create Date: 2026-10-05 09:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '003_college_examination_system'
down_revision = '002_add_questions_and_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. departments table
    if 'departments' not in existing_tables:
        op.create_table(
            'departments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('code', sa.String(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_departments_id'), 'departments', ['id'], unique=False)
        op.create_index(op.f('ix_departments_name'), 'departments', ['name'], unique=True)
        op.create_index(op.f('ix_departments_is_active'), 'departments', ['is_active'], unique=False)

    # 2. programs table
    if 'programs' not in existing_tables:
        op.create_table(
            'programs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('code', sa.String(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_programs_id'), 'programs', ['id'], unique=False)
        op.create_index(op.f('ix_programs_name'), 'programs', ['name'], unique=True)

    # 3. academic_years table
    if 'academic_years' not in existing_tables:
        op.create_table(
            'academic_years',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('program_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('year_number', sa.Integer(), nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_academic_years_id'), 'academic_years', ['id'], unique=False)

    # 4. semesters table
    if 'semesters' not in existing_tables:
        op.create_table(
            'semesters',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('program_id', sa.Integer(), nullable=False),
            sa.Column('academic_year_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('semester_number', sa.Integer(), nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_semesters_id'), 'semesters', ['id'], unique=False)

    # 5. subjects table (must be manually created by admin, no predefined subjects)
    if 'subjects' not in existing_tables:
        op.create_table(
            'subjects',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('code', sa.String(), nullable=False),
            sa.Column('department_id', sa.Integer(), nullable=False),
            sa.Column('program_id', sa.Integer(), nullable=True),
            sa.Column('academic_year_id', sa.Integer(), nullable=True),
            sa.Column('semester_id', sa.Integer(), nullable=True),
            sa.Column('department_name', sa.String(), nullable=True),
            sa.Column('program_name', sa.String(), nullable=True),
            sa.Column('year_name', sa.String(), nullable=True),
            sa.Column('semester_name', sa.String(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
            sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
            sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ),
            sa.ForeignKeyConstraint(['semester_id'], ['semesters.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_subjects_id'), 'subjects', ['id'], unique=False)
        op.create_index(op.f('ix_subjects_name'), 'subjects', ['name'], unique=False)
        op.create_index(op.f('ix_subjects_code'), 'subjects', ['code'], unique=False)
        op.create_index(op.f('ix_subjects_is_active'), 'subjects', ['is_active'], unique=False)

    # 6. Add columns to students table
    student_cols = [c['name'] for c in inspector.get_columns('students')]
    if 'gender' not in student_cols:
        op.add_column('students', sa.Column('gender', sa.String(), nullable=True))
    if 'department_id' not in student_cols:
        op.add_column('students', sa.Column('department_id', sa.Integer(), nullable=True))
    if 'program' not in student_cols:
        op.add_column('students', sa.Column('program', sa.String(), nullable=True))
    if 'year' not in student_cols:
        op.add_column('students', sa.Column('year', sa.String(), nullable=True))
    if 'semester' not in student_cols:
        op.add_column('students', sa.Column('semester', sa.String(), nullable=True))
    if 'password_hash' not in student_cols:
        op.add_column('students', sa.Column('password_hash', sa.String(), nullable=True))
    if 'is_active' not in student_cols:
        op.add_column('students', sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False))
        op.create_index(op.f('ix_students_is_active'), 'students', ['is_active'], unique=False)
    if 'updated_at' not in student_cols:
        op.add_column('students', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # 7. Add columns to questions table
    question_cols = [c['name'] for c in inspector.get_columns('questions')]
    if 'department_id' not in question_cols:
        op.add_column('questions', sa.Column('department_id', sa.Integer(), nullable=True))
    if 'program_id' not in question_cols:
        op.add_column('questions', sa.Column('program_id', sa.Integer(), nullable=True))
    if 'academic_year_id' not in question_cols:
        op.add_column('questions', sa.Column('academic_year_id', sa.Integer(), nullable=True))
    if 'semester_id' not in question_cols:
        op.add_column('questions', sa.Column('semester_id', sa.Integer(), nullable=True))
    if 'subject_id' not in question_cols:
        op.add_column('questions', sa.Column('subject_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_questions_subject_id', 'questions', 'subjects', ['subject_id'], ['id'], ondelete='SET NULL')
    if 'department_name' not in question_cols:
        op.add_column('questions', sa.Column('department_name', sa.String(), nullable=True))
    if 'program_name' not in question_cols:
        op.add_column('questions', sa.Column('program_name', sa.String(), nullable=True))
    if 'year_name' not in question_cols:
        op.add_column('questions', sa.Column('year_name', sa.String(), nullable=True))
    if 'semester_name' not in question_cols:
        op.add_column('questions', sa.Column('semester_name', sa.String(), nullable=True))
    if 'subject_name' not in question_cols:
        op.add_column('questions', sa.Column('subject_name', sa.String(), nullable=True))
    if 'difficulty' not in question_cols:
        op.add_column('questions', sa.Column('difficulty', sa.String(), server_default='Medium', nullable=True))
    if 'marks' not in question_cols:
        op.add_column('questions', sa.Column('marks', sa.Integer(), server_default='1', nullable=False))

    # 8. exams table
    if 'exams' not in existing_tables:
        op.create_table(
            'exams',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(), nullable=False),
            sa.Column('code', sa.String(), nullable=True),
            sa.Column('department_id', sa.Integer(), nullable=True),
            sa.Column('program_id', sa.Integer(), nullable=True),
            sa.Column('academic_year_id', sa.Integer(), nullable=True),
            sa.Column('semester_id', sa.Integer(), nullable=True),
            sa.Column('subject_id', sa.Integer(), nullable=True),
            sa.Column('department_name', sa.String(), nullable=True),
            sa.Column('program_name', sa.String(), nullable=True),
            sa.Column('year_name', sa.String(), nullable=True),
            sa.Column('semester_name', sa.String(), nullable=True),
            sa.Column('subject_name', sa.String(), nullable=True),
            sa.Column('start_date', sa.String(), nullable=True),
            sa.Column('start_time', sa.String(), nullable=True),
            sa.Column('end_date', sa.String(), nullable=True),
            sa.Column('end_time', sa.String(), nullable=True),
            sa.Column('duration_minutes', sa.Integer(), server_default='60', nullable=False),
            sa.Column('total_questions', sa.Integer(), server_default='25', nullable=False),
            sa.Column('marks_per_question', sa.Integer(), server_default='1', nullable=False),
            sa.Column('total_marks', sa.Integer(), server_default='25', nullable=False),
            sa.Column('passing_percentage', sa.Float(), server_default='40.0', nullable=False),
            sa.Column('selection_mode', sa.String(), server_default='random', nullable=False),
            sa.Column('status', sa.String(), server_default='draft', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
            sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
            sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ),
            sa.ForeignKeyConstraint(['semester_id'], ['semesters.id'], ),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exams_id'), 'exams', ['id'], unique=False)
        op.create_index(op.f('ix_exams_is_active'), 'exams', ['is_active'], unique=False)

    # 9. exam_questions table
    if 'exam_questions' not in existing_tables:
        op.create_table(
            'exam_questions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('exam_id', sa.Integer(), nullable=False),
            sa.Column('question_id', sa.Integer(), nullable=False),
            sa.Column('order_index', sa.Integer(), server_default='0', nullable=False),
            sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('exam_id', 'question_id', name='uq_exam_question')
        )
        op.create_index(op.f('ix_exam_questions_id'), 'exam_questions', ['id'], unique=False)

    # 10. exam_students table (student-specific exam authorization)
    if 'exam_students' not in existing_tables:
        op.create_table(
            'exam_students',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('exam_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('assigned_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('exam_id', 'student_id', name='uq_exam_student')
        )
        op.create_index(op.f('ix_exam_students_id'), 'exam_students', ['id'], unique=False)

    # 11. Add columns to attempts table
    attempt_cols = [c['name'] for c in inspector.get_columns('attempts')]
    if 'exam_id' not in attempt_cols:
        op.add_column('attempts', sa.Column('exam_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_attempts_exam_id', 'attempts', 'exams', ['exam_id'], ['id'], ondelete='SET NULL')
    if 'exam_title_snapshot' not in attempt_cols:
        op.add_column('attempts', sa.Column('exam_title_snapshot', sa.String(), nullable=True))
    if 'subject_name_snapshot' not in attempt_cols:
        op.add_column('attempts', sa.Column('subject_name_snapshot', sa.String(), nullable=True))
    if 'tab_switch_count' not in attempt_cols:
        op.add_column('attempts', sa.Column('tab_switch_count', sa.Integer(), server_default='0', nullable=True))
    if 'fullscreen_exit_count' not in attempt_cols:
        op.add_column('attempts', sa.Column('fullscreen_exit_count', sa.Integer(), server_default='0', nullable=True))
    if 'copy_count' not in attempt_cols:
        op.add_column('attempts', sa.Column('copy_count', sa.Integer(), server_default='0', nullable=True))
    if 'paste_count' not in attempt_cols:
        op.add_column('attempts', sa.Column('paste_count', sa.Integer(), server_default='0', nullable=True))

    # 12. Add marks to student_answers if not exists
    sa_cols = [c['name'] for c in inspector.get_columns('student_answers')]
    if 'marks' not in sa_cols:
        op.add_column('student_answers', sa.Column('marks', sa.Integer(), server_default='1', nullable=False))

    # 13. exam_security_logs table
    if 'exam_security_logs' not in existing_tables:
        op.create_table(
            'exam_security_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('attempt_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('event_type', sa.String(), nullable=False),
            sa.Column('details', sa.String(), nullable=True),
            sa.Column('occurred_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['attempt_id'], ['attempts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exam_security_logs_id'), 'exam_security_logs', ['id'], unique=False)

    # 14. Seed mandatory 10 Departments
    dept_names = [
        "Civil Engineering Department",
        "Electrical Engineering Department",
        "Mechanical Engineering Department",
        "Electronics & Telecommunication",
        "Computer Science & Engineering",
        "Information Technology",
        "Master in Computer Application",
        "Applied Mechanics Department",
        "Applied Mathematics",
        "Science"
    ]
    dept_table = table(
        'departments',
        column('id', sa.Integer),
        column('name', sa.String),
        column('code', sa.String),
        column('is_active', sa.Boolean),
        column('created_at', sa.DateTime)
    )
    now = datetime.utcnow()
    existing_depts = [r[0] for r in conn.execute(sa.text("SELECT name FROM departments;")).fetchall()]
    dept_inserts = []
    for idx, d_name in enumerate(dept_names, start=1):
        if d_name not in existing_depts:
            dept_inserts.append({
                'name': d_name,
                'code': d_name[:6].upper().replace(" ", ""),
                'is_active': True,
                'created_at': now
            })
    if dept_inserts:
        op.bulk_insert(dept_table, dept_inserts)

    # 15. Seed Programs (UG, M.Tech)
    prog_table = table(
        'programs',
        column('id', sa.Integer),
        column('name', sa.String),
        column('code', sa.String),
        column('is_active', sa.Boolean),
        column('created_at', sa.DateTime)
    )
    existing_progs = [r[0] for r in conn.execute(sa.text("SELECT name FROM programs;")).fetchall()]
    prog_map = {}
    if "UG" not in existing_progs:
        op.bulk_insert(prog_table, [
            {'name': 'UG', 'code': 'UG', 'is_active': True, 'created_at': now},
            {'name': 'M.Tech', 'code': 'M.Tech', 'is_active': True, 'created_at': now}
        ])
    for r in conn.execute(sa.text("SELECT id, name FROM programs;")).fetchall():
        prog_map[r[1]] = r[0]

    # 16. Seed Academic Years
    # UG: 1st Year, 2nd Year, 3rd Year, Final Year
    # M.Tech: M.Tech 1st Year, M.Tech 2nd Year
    ay_table = table(
        'academic_years',
        column('id', sa.Integer),
        column('program_id', sa.Integer),
        column('name', sa.String),
        column('year_number', sa.Integer),
        column('is_active', sa.Boolean)
    )
    existing_ays = [r[0] for r in conn.execute(sa.text("SELECT name FROM academic_years;")).fetchall()]
    ay_inserts = []
    if "UG" in prog_map:
        ug_years = [("1st Year", 1), ("2nd Year", 2), ("3rd Year", 3), ("Final Year", 4)]
        for y_name, y_num in ug_years:
            if y_name not in existing_ays:
                ay_inserts.append({'program_id': prog_map["UG"], 'name': y_name, 'year_number': y_num, 'is_active': True})
    if "M.Tech" in prog_map:
        mtech_years = [("M.Tech 1st Year", 1), ("M.Tech 2nd Year", 2)]
        for y_name, y_num in mtech_years:
            if y_name not in existing_ays:
                ay_inserts.append({'program_id': prog_map["M.Tech"], 'name': y_name, 'year_number': y_num, 'is_active': True})
    if ay_inserts:
        op.bulk_insert(ay_table, ay_inserts)

    # 17. Seed Semesters
    ay_map = {}
    for r in conn.execute(sa.text("SELECT id, name, program_id FROM academic_years;")).fetchall():
        ay_map[r[1]] = (r[0], r[2])

    sem_table = table(
        'semesters',
        column('id', sa.Integer),
        column('program_id', sa.Integer),
        column('academic_year_id', sa.Integer),
        column('name', sa.String),
        column('semester_number', sa.Integer),
        column('is_active', sa.Boolean)
    )
    existing_sems = [r[0] for r in conn.execute(sa.text("SELECT name FROM semesters;")).fetchall()]
    sem_inserts = []
    ug_sems = [
        ("1st Year", "Semester 1", 1), ("1st Year", "Semester 2", 2),
        ("2nd Year", "Semester 3", 3), ("2nd Year", "Semester 4", 4),
        ("3rd Year", "Semester 5", 5), ("3rd Year", "Semester 6", 6),
        ("Final Year", "Semester 7", 7), ("Final Year", "Semester 8", 8)
    ]
    for y_name, s_name, s_num in ug_sems:
        if y_name in ay_map and s_name not in existing_sems:
            ay_id, p_id = ay_map[y_name]
            sem_inserts.append({
                'program_id': p_id,
                'academic_year_id': ay_id,
                'name': s_name,
                'semester_number': s_num,
                'is_active': True
            })

    mtech_sems = [
        ("M.Tech 1st Year", "Semester 1", 1), ("M.Tech 1st Year", "Semester 2", 2),
        ("M.Tech 2nd Year", "Semester 3", 3), ("M.Tech 2nd Year", "Semester 4", 4)
    ]
    # To disambiguate M.Tech semester names in DB, label or track by program_id
    for y_name, s_name, s_num in mtech_sems:
        full_sem_name = f"M.Tech {s_name}"
        if y_name in ay_map and full_sem_name not in existing_sems:
            ay_id, p_id = ay_map[y_name]
            sem_inserts.append({
                'program_id': p_id,
                'academic_year_id': ay_id,
                'name': full_sem_name,
                'semester_number': s_num,
                'is_active': True
            })
    if sem_inserts:
        op.bulk_insert(sem_table, sem_inserts)

    # 18. Backfill existing students with active status and default secure password hash if missing
    default_hash = "$pbkdf2-sha256$29000$FoKQ0rp3TskZ47xXCsGYcw$upi0daIbvwI5njqkMZxeh1JL7XaSFul9YnUz2rTxpdM"  # 'student123'
    conn.execute(sa.text(f"""
        UPDATE students
        SET password_hash = COALESCE(password_hash, '{default_hash}'),
            is_active = COALESCE(is_active, TRUE),
            program = COALESCE(program, 'UG'),
            year = COALESCE(year, '1st Year'),
            semester = COALESCE(semester, 'Semester 1')
        WHERE password_hash IS NULL OR is_active IS NULL;
    """))

    # 19. Backfill existing questions with marks and difficulty
    conn.execute(sa.text("""
        UPDATE questions
        SET marks = COALESCE(marks, 1),
            difficulty = COALESCE(difficulty, 'Medium')
        WHERE marks IS NULL OR difficulty IS NULL;
    """))

    # 20. Backfill existing attempts with default cheating counters and snapshots
    conn.execute(sa.text("""
        UPDATE attempts
        SET tab_switch_count = COALESCE(tab_switch_count, 0),
            fullscreen_exit_count = COALESCE(fullscreen_exit_count, 0),
            copy_count = COALESCE(copy_count, 0),
            paste_count = COALESCE(paste_count, 0),
            subject_name_snapshot = COALESCE(subject_name_snapshot, 'Data Structures & Algorithms')
        WHERE tab_switch_count IS NULL OR fullscreen_exit_count IS NULL;
    """))

    # Reset sequences in postgres if dialect is postgresql
    if conn.dialect.name == 'postgresql':
        for tbl in ['departments', 'programs', 'academic_years', 'semesters', 'subjects', 'exams', 'exam_questions', 'exam_students', 'exam_security_logs']:
            try:
                conn.execute(sa.text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE(MAX(id), 1)) FROM {tbl};"))
            except Exception:
                pass


def downgrade() -> None:
    op.drop_table('exam_security_logs')
    op.drop_table('exam_students')
    op.drop_table('exam_questions')
    op.drop_table('exams')
    op.drop_table('subjects')
    op.drop_table('semesters')
    op.drop_table('academic_years')
    op.drop_table('programs')
    op.drop_table('departments')
