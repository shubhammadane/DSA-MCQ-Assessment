import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text, create_engine
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.database import Base
from migrate_local_data import copy_local_data


@pytest.mark.postgres
def test_migrations_preserve_records_and_enable_table_privacy(database, monkeypatch):
    engine = database.kw["bind"]
    # The fixture owns a randomly named, disposable schema, never public.
    Base.metadata.drop_all(engine)
    monkeypatch.setattr(settings, "MIGRATION_DATABASE_URL", engine.url.render_as_string(hide_password=False))
    config = Config("alembic.ini")
    command.upgrade(config, "006_shared_login_throttling")
    with database() as db:
        student = models.Student(enrollment_no="MIGRATION1", name="Migration Student", department="Computing")
        exam = models.Exam(title="Preserved examination")
        db.add_all([student, exam])
        db.flush()
        attempt = models.Attempt(student_id=student.id, exam_id=exam.id, score=2, status="completed")
        db.add(attempt)
        db.flush()
        db.add(models.StudentAnswer(attempt_id=attempt.id, question_number=1, correct_answer="A", selected_answer="A", marks=2, is_correct=True))
        db.commit()
        attempt_id = attempt.id
    command.upgrade(config, "head")
    constraints = inspect(engine).get_unique_constraints("attempts")
    assert "uq_attempt_student_exam" in {item["name"] for item in constraints}
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = current_schema()::regnamespace AND relkind='r'"))
        privacy = dict(rows.all())
        assert all(privacy.values()), privacy
    command.downgrade(config, "006_shared_login_throttling")
    command.upgrade(config, "head")
    with database() as db:
        assert db.get(models.Attempt, attempt_id).score == 2
        assert db.query(models.StudentAnswer).one().selected_answer == "A"


@pytest.mark.postgres
def test_local_data_copy_remaps_foreign_keys_and_refuses_existing_user_data(database, tmp_path):
    source_url = f"sqlite:///{tmp_path / 'local.db'}"
    source = create_engine(source_url)
    Base.metadata.create_all(source)
    with Session(source) as db:
        department = models.Department(id=1, name="Computing")
        db.add(department)
        db.flush()
        subject = models.Subject(id=1, name="DSA", code="DSA", department_id=1)
        student = models.Student(id=1, name="Preserved Student", enrollment_no="COPY1", department="Computing", department_id=1)
        question = models.Question(id=1, question_text="Preserved question", option_a="A", option_b="B", option_c="C", option_d="D", correct_answer="A", department_id=1, subject_id=1)
        db.add_all([subject, student])
        db.flush()
        db.add(question)
        db.commit()
    with database() as db:
        db.add(models.Department(id=900, name="Computing"))
        db.commit()
    target_url = database.kw["bind"].url.render_as_string(hide_password=False)
    counts = copy_local_data(source_url, target_url)
    assert counts["students"] == counts["questions"] == counts["subjects"] == 1
    with database() as db:
        assert db.query(models.Student).one().department_id == 900
        assert db.query(models.Subject).one().department_id == 900
        assert db.query(models.Question).one().subject_id == db.query(models.Subject).one().id
    with pytest.raises(ValueError, match="already contains user records"):
        copy_local_data(source_url, target_url)
    with database() as db:
        assert db.query(models.Student).count() == 1
    source.dispose()
