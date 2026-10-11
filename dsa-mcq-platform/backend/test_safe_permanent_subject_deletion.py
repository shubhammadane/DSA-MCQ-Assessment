import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app import models
from app.auth import create_access_token, hash_password
from app.config import settings

# ---------------------------------------------------------------------------
# Setup Isolated In-Memory SQLite Test Database (Zero impact on live Postgres)
# ---------------------------------------------------------------------------
SQLITE_TEST_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLITE_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Apply test database override to FastAPI app
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_isolated_db():
    """Re-create a fresh isolated schema in memory for every test run."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def test_01_permanently_delete_new_subject_with_no_dependencies():
    """Test that a Super Admin can permanently delete a subject that has no dependencies."""
    db = TestingSessionLocal()
    dept = models.Department(name="Computer Science & Engineering", code="CSE", is_active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    subj = models.Subject(
        name="Compiler Design",
        code="CS-501",
        department_id=dept.id,
        department_name=dept.name,
        is_active=True
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    subj_id = subj.id
    db.close()

    # Super Admin Auth
    token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Dependency check endpoint returns can_delete = True
    dep_res = client.get(f"/api/subjects/{subj_id}/dependencies", headers=headers)
    assert dep_res.status_code == 200
    dep_data = dep_res.json()
    assert dep_data["can_delete"] is True
    assert dep_data["has_dependencies"] is False
    assert dep_data["question_count"] == 0
    assert dep_data["exam_count"] == 0
    assert dep_data["attempt_count"] == 0

    # 2. Permanent Delete
    del_res = client.delete(f"/api/subjects/{subj_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == subj_id

    # 3. Confirm subject no longer exists
    db2 = TestingSessionLocal()
    found = db2.query(models.Subject).filter(models.Subject.id == subj_id).first()
    assert found is None
    db2.close()


def test_02_deletion_blocked_when_subject_linked_to_questions():
    """Test that subject deletion is safely blocked when referenced by question bank."""
    db = TestingSessionLocal()
    dept = models.Department(name="Information Technology", code="IT", is_active=True)
    db.add(dept)
    db.commit()

    subj = models.Subject(name="Database Systems", code="IT-301", department_id=dept.id, is_active=True)
    db.add(subj)
    db.commit()

    q = models.Question(
        question_text="What is 3NF?",
        option_a="Normal Form",
        option_b="Not Normal",
        option_c="Neither",
        option_d="None",
        correct_answer="A",
        subject_id=subj.id,
        department_id=dept.id,
        is_active=True
    )
    db.add(q)
    db.commit()
    subj_id = subj.id
    q_id = q.id
    db.close()

    token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Dependency check detects question
    dep_res = client.get(f"/api/subjects/{subj_id}/dependencies", headers=headers)
    assert dep_res.status_code == 200
    assert dep_res.json()["can_delete"] is False
    assert dep_res.json()["has_dependencies"] is True
    assert dep_res.json()["question_count"] == 1

    # 2. Deletion request fails with 400 Bad Request
    del_res = client.delete(f"/api/subjects/{subj_id}", headers=headers)
    assert del_res.status_code == 400
    assert "protected academic dependencies" in del_res.json()["detail"]
    assert "1 question(s)" in del_res.json()["detail"]

    # 3. Verify subject and question records are untouched
    db2 = TestingSessionLocal()
    assert db2.query(models.Subject).filter(models.Subject.id == subj_id).first() is not None
    assert db2.query(models.Question).filter(models.Question.id == q_id).first() is not None
    db2.close()


def test_03_deletion_blocked_when_subject_linked_to_exams_and_student_attempts():
    """Test that historical examination marks, attempts, and answers are strictly preserved."""
    db = TestingSessionLocal()
    dept = models.Department(name="Computer Science & Engineering", code="CSE", is_active=True)
    db.add(dept)
    db.commit()

    subj = models.Subject(name="Algorithms", code="CS-202", department_id=dept.id, is_active=True)
    db.add(subj)
    db.commit()

    exam = models.Exam(
        title="Mid-Term Algorithms Exam",
        code="EX-ALGO-2026",
        department_id=dept.id,
        subject_id=subj.id,
        status="published",
        is_active=True
    )
    db.add(exam)
    db.commit()

    student = models.Student(
        enrollment_no="CSE2026001",
        name="Alex Smith",
        department="CSE",
        department_id=dept.id,
        is_active=True
    )
    db.add(student)
    db.commit()

    attempt = models.Attempt(
        student_id=student.id,
        exam_id=exam.id,
        exam_title_snapshot=exam.title,
        subject_name_snapshot=subj.name,
        score=48,
        percentage=96.0,
        correct_answers=48,
        wrong_answers=2,
        status="completed",
        completed_at=datetime.utcnow()
    )
    db.add(attempt)
    db.commit()

    subj_id = subj.id
    exam_id = exam.id
    attempt_id = attempt.id
    student_id = student.id
    db.close()

    token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Dependency check reports examination and student attempt
    dep_res = client.get(f"/api/subjects/{subj_id}/dependencies", headers=headers)
    assert dep_res.status_code == 200
    dep_json = dep_res.json()
    assert dep_json["can_delete"] is False
    assert dep_json["exam_count"] == 1
    assert dep_json["attempt_count"] == 1

    # 2. Deletion is safely rejected
    del_res = client.delete(f"/api/subjects/{subj_id}", headers=headers)
    assert del_res.status_code == 400
    detail = del_res.json()["detail"]
    assert "protected academic dependencies" in detail
    assert "1 examination(s)" in detail
    assert "1 student examination attempt(s)" in detail

    # 3. Verify ALL historical examination data, student record, and marks are preserved intact
    db2 = TestingSessionLocal()
    kept_subj = db2.query(models.Subject).filter(models.Subject.id == subj_id).first()
    kept_exam = db2.query(models.Exam).filter(models.Exam.id == exam_id).first()
    kept_attempt = db2.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    kept_student = db2.query(models.Student).filter(models.Student.id == student_id).first()

    assert kept_subj is not None
    assert kept_exam is not None
    assert kept_attempt is not None
    assert kept_attempt.score == 48
    assert kept_attempt.percentage == 96.0
    assert kept_student is not None
    db2.close()


def test_04_safe_archive_deactivation_alternative():
    """Test that subjects with protected records can be deactivated/archived safely as the recommended alternative."""
    db = TestingSessionLocal()
    dept = models.Department(name="Electronics", code="ECE", is_active=True)
    db.add(dept)
    db.commit()

    subj = models.Subject(name="Signals & Systems", code="EC-301", department_id=dept.id, is_active=True)
    db.add(subj)
    db.commit()

    exam = models.Exam(title="Signals Quiz", department_id=dept.id, subject_id=subj.id, is_active=True)
    db.add(exam)
    db.commit()
    subj_id = subj.id
    db.close()

    token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {token}"}

    # Deactivate subject status
    patch_res = client.patch(f"/api/subjects/{subj_id}/status", headers=headers, json={"is_active": False})
    assert patch_res.status_code == 200
    assert patch_res.json()["is_active"] is False

    # Verify subject in DB is now inactive (archived) without damaging exam records
    db2 = TestingSessionLocal()
    subj_db = db2.query(models.Subject).filter(models.Subject.id == subj_id).first()
    assert subj_db.is_active is False
    assert db2.query(models.Exam).filter(models.Exam.subject_id == subj_id).count() == 1
    db2.close()


def test_05_hod_department_restrictions_and_super_admin_permissions():
    """Verify HOD can only delete subjects within their department, while Super Admin can manage all."""
    db = TestingSessionLocal()
    dept_cse = models.Department(name="Computer Science", code="CSE", is_active=True)
    dept_mech = models.Department(name="Mechanical Engineering", code="MECH", is_active=True)
    db.add_all([dept_cse, dept_mech])
    db.commit()

    # Subjects with no dependencies
    subj_cse = models.Subject(name="Operating Systems", code="CS-301", department_id=dept_cse.id, is_active=True)
    subj_mech = models.Subject(name="Thermodynamics", code="ME-201", department_id=dept_mech.id, is_active=True)
    db.add_all([subj_cse, subj_mech])
    db.commit()

    # Users: HOD CSE and Faculty CSE
    hod_cse_user = models.AdminUser(
        username="hod_cse",
        hashed_password=hash_password("hodpass"),
        full_name="Dr. CSE HOD",
        role="hod",
        department_id=dept_cse.id,
        is_active=True
    )
    faculty_user = models.AdminUser(
        username="prof_faculty",
        hashed_password=hash_password("facpass"),
        full_name="Prof Faculty",
        role="faculty",
        department_id=dept_cse.id,
        is_active=True
    )
    db.add_all([hod_cse_user, faculty_user])
    db.commit()

    cse_subj_id = subj_cse.id
    mech_subj_id = subj_mech.id
    db.close()

    # Tokens
    token_hod_cse = create_access_token({"sub": "hod_cse", "role": "hod"})
    token_faculty = create_access_token({"sub": "prof_faculty", "role": "faculty"})
    token_super = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})

    headers_hod_cse = {"Authorization": f"Bearer {token_hod_cse}"}
    headers_faculty = {"Authorization": f"Bearer {token_faculty}"}
    headers_super = {"Authorization": f"Bearer {token_super}"}

    # 1. Faculty attempt to delete -> 403 Forbidden
    fac_res = client.delete(f"/api/subjects/{cse_subj_id}", headers=headers_faculty)
    assert fac_res.status_code == 403

    # 2. HOD CSE attempts to delete Mech subject (Cross-Department) -> 403 Forbidden
    cross_res = client.delete(f"/api/subjects/{mech_subj_id}", headers=headers_hod_cse)
    assert cross_res.status_code == 403
    assert "Access denied" in cross_res.json()["detail"]

    # 3. HOD CSE deletes their own department subject -> 200 OK
    own_res = client.delete(f"/api/subjects/{cse_subj_id}", headers=headers_hod_cse)
    assert own_res.status_code == 200

    # 4. Super Admin deletes Mech subject -> 200 OK
    super_res = client.delete(f"/api/subjects/{mech_subj_id}", headers=headers_super)
    assert super_res.status_code == 200

    # Verify both deleted
    db2 = TestingSessionLocal()
    assert db2.query(models.Subject).filter(models.Subject.id == cse_subj_id).first() is None
    assert db2.query(models.Subject).filter(models.Subject.id == mech_subj_id).first() is None
    db2.close()


def test_06_deleting_one_subject_does_not_affect_any_other_subject():
    """Verify that deleting a subject strictly isolates its effects and does not tamper with other subjects."""
    db = TestingSessionLocal()
    dept = models.Department(name="Civil Engineering", code="CIVIL", is_active=True)
    db.add(dept)
    db.commit()

    subj_a = models.Subject(name="Fluid Mechanics", code="CE-101", department_id=dept.id, is_active=True)
    subj_b = models.Subject(name="Structural Analysis", code="CE-102", department_id=dept.id, is_active=True)
    db.add_all([subj_a, subj_b])
    db.commit()

    id_a = subj_a.id
    id_b = subj_b.id
    db.close()

    token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {token}"}

    del_res = client.delete(f"/api/subjects/{id_a}", headers=headers)
    assert del_res.status_code == 200

    db2 = TestingSessionLocal()
    assert db2.query(models.Subject).filter(models.Subject.id == id_a).first() is None
    remaining_b = db2.query(models.Subject).filter(models.Subject.id == id_b).first()
    assert remaining_b is not None
    assert remaining_b.name == "Structural Analysis"
    assert remaining_b.code == "CE-102"
    db2.close()
