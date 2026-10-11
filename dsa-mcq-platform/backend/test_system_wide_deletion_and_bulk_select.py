import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import json

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

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_isolated_db():
    """Re-create a fresh isolated schema in memory for every test run."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


def test_01_admin_users_permanent_and_bulk_deletion():
    """Verify permanent delete and bulk delete of admin accounts with safeguards."""
    db = TestingSessionLocal()
    # Create test admins
    u1 = models.AdminUser(username="test_faculty1", full_name="Faculty One", email="fac1@test.com", hashed_password=hash_password("pass"), role="faculty", is_active=True)
    u2 = models.AdminUser(username="test_faculty2", full_name="Faculty Two", email="fac2@test.com", hashed_password=hash_password("pass"), role="faculty", is_active=True)
    db.add_all([u1, u2])
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    u1_id, u2_id = u1.id, u2.id
    db.close()

    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    # 1. Single permanent delete of u1
    del_res = client.delete(f"/api/admin/users/{u1_id}?permanent=true", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["user_id"] == u1_id

    # 2. Bulk delete of u2
    bulk_res = client.post("/api/admin/users/bulk-delete", json={"ids": [u2_id]}, headers=headers)
    assert bulk_res.status_code == 200
    assert bulk_res.json()["deleted_count"] == 1

    # 3. Safeguard: cannot delete root admin
    db2 = TestingSessionLocal()
    root = db2.query(models.AdminUser).filter(models.AdminUser.username == settings.ADMIN_USERNAME).first()
    if not root:
        root = models.AdminUser(username=settings.ADMIN_USERNAME, full_name="Super Admin", email="root_special@test.com", hashed_password="pass", role="super_admin", is_active=True)
        db2.add(root)
        db2.commit()
        db2.refresh(root)
    root_id = root.id
    db2.close()

    safe_res = client.delete(f"/api/admin/users/{root_id}", headers=headers)
    assert safe_res.status_code == 400


def test_02_department_deletion_and_dependency_blocking():
    """Verify departments can be permanently deleted when empty, but blocked when dependencies exist."""
    db = TestingSessionLocal()
    d_empty = models.Department(name="Empty Dept", code="EMP", is_active=True)
    d_busy = models.Department(name="Busy Dept", code="BUSY", is_active=True)
    db.add_all([d_empty, d_busy])
    db.commit()
    db.refresh(d_empty)
    db.refresh(d_busy)

    # Attach subject to d_busy
    subj = models.Subject(name="Physics", code="PHY101", department_id=d_busy.id, is_active=True)
    db.add(subj)
    db.commit()
    empty_id, busy_id = d_empty.id, d_busy.id
    db.close()

    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    # Busy dept is blocked
    check_res = client.get(f"/api/departments/{busy_id}/dependencies", headers=headers)
    assert check_res.status_code == 200
    assert check_res.json()["can_delete"] is False

    del_busy = client.delete(f"/api/departments/{busy_id}", headers=headers)
    assert del_busy.status_code == 400

    # Empty dept deletes successfully
    del_empty = client.delete(f"/api/departments/{empty_id}", headers=headers)
    assert del_empty.status_code == 200


def test_03_questions_dependency_blocking_and_bulk_delete():
    """Verify questions with student answers cannot be deleted, while unused questions delete cleanly."""
    db = TestingSessionLocal()
    dept = models.Department(name="CSE", code="CSE", is_active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    q_free1 = models.Question(question_text="Free Q1?", option_a="A", option_b="B", option_c="C", option_d="D", correct_answer="A", department_id=dept.id, is_active=True)
    q_free2 = models.Question(question_text="Free Q2?", option_a="A", option_b="B", option_c="C", option_d="D", correct_answer="B", department_id=dept.id, is_active=True)
    q_used = models.Question(question_text="Used Q?", option_a="A", option_b="B", option_c="C", option_d="D", correct_answer="C", department_id=dept.id, is_active=True)
    db.add_all([q_free1, q_free2, q_used])
    db.commit()
    db.refresh(q_free1)
    db.refresh(q_free2)
    db.refresh(q_used)

    st = models.Student(enrollment_no="ST001", name="Alice", department=dept.name, department_id=dept.id, is_active=True)
    db.add(st)
    db.commit()
    db.refresh(st)

    att = models.Attempt(student_id=st.id, total_questions=1, score=1, percentage=100.0, started_at=datetime.utcnow(), status="completed")
    db.add(att)
    db.commit()
    db.refresh(att)

    sa = models.StudentAnswer(attempt_id=att.id, question_number=1, question_id=q_used.id, selected_answer="C", correct_answer="C", marks=1, is_correct=True)
    db.add(sa)
    db.commit()

    f1_id, f2_id, used_id = q_free1.id, q_free2.id, q_used.id
    db.close()

    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    # Dependency check on used question
    dep_res = client.get(f"/api/admin/questions/{used_id}/dependencies", headers=headers)
    assert dep_res.status_code == 200
    assert dep_res.json()["can_delete"] is False

    # Single delete of used question fails with 400
    del_used = client.delete(f"/api/admin/questions/{used_id}", headers=headers)
    assert del_used.status_code == 400

    # Bulk delete with free questions succeeds atomically
    bulk_res = client.post("/api/admin/questions/bulk-delete", json={"ids": [f1_id, f2_id]}, headers=headers)
    assert bulk_res.status_code == 200
    assert bulk_res.json()["deleted_count"] == 2


def test_04_exam_attempt_protection_and_bulk_delete():
    """Verify exams with attempts cannot be permanently deleted (must archive), while exams without attempts delete."""
    db = TestingSessionLocal()
    dept = models.Department(name="ECE", code="ECE", is_active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    ex_empty = models.Exam(title="Empty Exam", code="EX01", department_id=dept.id, duration_minutes=30, total_questions=10, total_marks=10, passing_percentage=40, selection_mode="random", is_active=True)
    ex_attempted = models.Exam(title="Attempted Exam", code="EX02", department_id=dept.id, duration_minutes=30, total_questions=10, total_marks=10, passing_percentage=40, selection_mode="random", is_active=True)
    db.add_all([ex_empty, ex_attempted])
    db.commit()
    db.refresh(ex_empty)
    db.refresh(ex_attempted)

    st = models.Student(enrollment_no="ST002", name="Bob", department=dept.name, department_id=dept.id, is_active=True)
    db.add(st)
    db.commit()
    db.refresh(st)

    att = models.Attempt(student_id=st.id, exam_id=ex_attempted.id, total_questions=10, score=8, percentage=80.0, started_at=datetime.utcnow(), status="completed")
    db.add(att)
    db.commit()

    empty_id, attempted_id = ex_empty.id, ex_attempted.id
    db.close()

    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    # Dependency check for attempted exam
    dep_res = client.get(f"/api/admin/exams/{attempted_id}/dependencies", headers=headers)
    assert dep_res.status_code == 200
    assert dep_res.json()["can_delete"] is False

    # Deleting attempted exam is blocked
    del_att = client.delete(f"/api/admin/exams/{attempted_id}", headers=headers)
    assert del_att.status_code == 400

    # Archive alternative works
    arc_res = client.post(f"/api/admin/exams/{attempted_id}/archive", headers=headers)
    assert arc_res.status_code == 200
    assert arc_res.json()["archived"] is True

    # Empty exam deletes cleanly
    del_emp = client.delete(f"/api/admin/exams/{empty_id}", headers=headers)
    assert del_emp.status_code == 200


def test_05_student_protection_of_examination_history():
    """Verify students with completed attempts require force=True for permanent deletion."""
    db = TestingSessionLocal()
    dept = models.Department(name="Civil", code="CE", is_active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    st_with_history = models.Student(enrollment_no="ST003", name="Charlie", department=dept.name, department_id=dept.id, is_active=True)
    st_fresh = models.Student(enrollment_no="ST004", name="Dana", department=dept.name, department_id=dept.id, is_active=True)
    db.add_all([st_with_history, st_fresh])
    db.commit()
    db.refresh(st_with_history)
    db.refresh(st_fresh)

    att = models.Attempt(student_id=st_with_history.id, total_questions=10, score=9, percentage=90.0, started_at=datetime.utcnow(), completed_at=datetime.utcnow(), status="completed")
    db.add(att)
    db.commit()

    hist_id, fresh_id = st_with_history.id, st_fresh.id
    db.close()

    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    # Fresh student deletes without force
    del_fresh = client.delete(f"/api/admin/students/{fresh_id}", headers=headers)
    assert del_fresh.status_code == 200

    # Student with completed history blocked without force
    del_hist_block = client.delete(f"/api/admin/students/{hist_id}", headers=headers)
    assert del_hist_block.status_code == 400

    # Student with completed history deleted with force=True
    del_hist_force = client.delete(f"/api/admin/students/{hist_id}?force=true", headers=headers)
    assert del_hist_force.status_code == 200


def test_06_attempts_single_and_bulk_deletion():
    """Verify attempts, their answers, and security logs delete cleanly and atomically."""
    db = TestingSessionLocal()
    dept = models.Department(name="Mech", code="ME", is_active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    st = models.Student(enrollment_no="ST005", name="Eve", department=dept.name, department_id=dept.id, is_active=True)
    db.add(st)
    db.commit()
    db.refresh(st)

    att1 = models.Attempt(student_id=st.id, total_questions=5, score=3, percentage=60.0, started_at=datetime.utcnow(), status="completed")
    att2 = models.Attempt(student_id=st.id, total_questions=5, score=4, percentage=80.0, started_at=datetime.utcnow(), status="completed")
    db.add_all([att1, att2])
    db.commit()
    db.refresh(att1)
    db.refresh(att2)

    # Add security log to att1
    slog = models.ExamSecurityLog(attempt_id=att1.id, student_id=st.id, event_type="tab_switch", details="Switched tab", occurred_at=datetime.utcnow())
    db.add(slog)
    db.commit()

    att1_id, att2_id = att1.id, att2.id
    db.close()

    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    # Dependency check
    dep_res = client.get(f"/api/admin/attempts/{att1_id}/dependencies", headers=headers)
    assert dep_res.status_code == 200
    assert dep_res.json()["can_delete"] is True

    # Bulk delete att1 and att2
    bulk_res = client.post("/api/admin/attempts/bulk-delete", json={"ids": [att1_id, att2_id]}, headers=headers)
    assert bulk_res.status_code == 200
    assert bulk_res.json()["deleted_count"] == 2

    # Verify database has 0 attempts left
    db2 = TestingSessionLocal()
    assert db2.query(models.Attempt).count() == 0
    assert db2.query(models.ExamSecurityLog).count() == 0
    db2.close()


def test_07_hod_cross_department_isolation():
    """Verify HODs cannot delete or bulk-delete resources belonging to other departments."""
    db = TestingSessionLocal()
    dept_cs = models.Department(name="CS", code="CS", is_active=True)
    dept_ee = models.Department(name="EE", code="EE", is_active=True)
    db.add_all([dept_cs, dept_ee])
    db.commit()
    db.refresh(dept_cs)
    db.refresh(dept_ee)

    st_ee = models.Student(enrollment_no="STEE1", name="Frank", department=dept_ee.name, department_id=dept_ee.id, is_active=True)
    db.add(st_ee)
    db.commit()
    db.refresh(st_ee)

    dept_cs_id = dept_cs.id
    dept_cs_name = dept_cs.name
    st_ee_id = st_ee.id

    hod_user = models.AdminUser(
        username="hod_cs_user",
        full_name="HOD Computer Science",
        email="hod_cs@test.com",
        hashed_password=hash_password("pass"),
        role="hod",
        department_id=dept_cs_id,
        is_active=True
    )
    db.add(hod_user)
    db.commit()
    db.close()

    # Create HOD token for CS department
    hod_cs_token = create_access_token({
        "sub": "hod_cs_user",
        "role": "hod",
        "department_id": dept_cs_id,
        "department_name": dept_cs_name
    })
    headers = {"Authorization": f"Bearer {hod_cs_token}"}

    # HOD CS tries to delete EE student -> 403 Forbidden
    res = client.delete(f"/api/admin/students/{st_ee_id}", headers=headers)
    assert res.status_code == 403


def test_08_system_backup_creation_and_verification():
    """Verify creating a verified database backup, listing it, and verifying SHA256 integrity."""
    super_token = create_access_token({"sub": settings.ADMIN_USERNAME, "role": "super_admin"})
    headers = {"Authorization": f"Bearer {super_token}"}

    create_res = client.post("/api/admin/backup/create", headers=headers)
    assert create_res.status_code == 200
    data = create_res.json()
    assert data["status"] == "success"
    filename = data["backup"]["filename"]
    sha256 = data["backup"]["sha256"]

    # List backups
    list_res = client.get("/api/admin/backup/list", headers=headers)
    assert list_res.status_code == 200
    filenames = [b["filename"] for b in list_res.json()]
    assert filename in filenames

    # Verify backup
    ver_res = client.post("/api/admin/backup/verify", json={"filename": filename}, headers=headers)
    assert ver_res.status_code == 200
    assert ver_res.json()["calculated_sha256"] == sha256
