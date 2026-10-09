import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from app.main import app
from app.config import settings
from app.database import engine, get_db
from app import models
from app.auth import verify_password

client = TestClient(app)


# =========================================================================
# 1. MIGRATION SAFETY AND SCHEMA VERIFICATION
# =========================================================================

def test_01_migration_schema_and_columns():
    """Verify that alembic migration 004 created admin_users table with proper columns, indexes, and FKs."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "admin_users" in tables, "Table admin_users must exist in database"

    columns = {c["name"]: c for c in inspector.get_columns("admin_users")}
    expected_columns = [
        "id", "username", "hashed_password", "full_name", "email",
        "role", "department_id", "is_active", "created_at", "updated_at"
    ]
    for col_name in expected_columns:
        assert col_name in columns, f"Column {col_name} must exist in admin_users"
    
    # Check nullability
    assert columns["username"]["nullable"] is False
    assert columns["hashed_password"]["nullable"] is False
    assert columns["full_name"]["nullable"] is False

    # Check indexes
    indexes = {idx["name"]: idx for idx in inspector.get_indexes("admin_users")}
    assert any("username" in idx["column_names"] and idx["unique"] for idx in indexes.values()), "Username must have unique index"

    # Check Foreign Keys
    fks = inspector.get_foreign_keys("admin_users")
    assert any(fk["referred_table"] == "departments" and fk["referred_columns"] == ["id"] for fk in fks), "admin_users.department_id must reference departments.id"


def test_02_database_record_preservation_counts():
    """Verify historical data preservation: student attempts, answers, questions, subjects."""
    with engine.connect() as conn:
        q_count = conn.execute(text("SELECT count(*) FROM questions")).scalar()
        st_count = conn.execute(text("SELECT count(*) FROM students")).scalar()
        att_count = conn.execute(text("SELECT count(*) FROM attempts")).scalar()
        ans_count = conn.execute(text("SELECT count(*) FROM student_answers")).scalar()
        subj_count = conn.execute(text("SELECT count(*) FROM subjects")).scalar()

        # Check baseline preservation
        assert q_count >= 50, f"Expected at least 50 questions, found {q_count}"
        assert st_count >= 38, f"Expected at least 38 original students, found {st_count}"
        assert att_count >= 6, f"Expected at least 6 attempts, found {att_count}"
        assert ans_count >= 300, f"Expected at least 300 student answers, found {ans_count}"
        assert subj_count >= 1, f"Expected at least 1 subject, found {subj_count}"


# =========================================================================
# 2. AUTHENTICATION & CREDENTIAL SECURITY
# =========================================================================

def test_03_super_admin_login_and_token():
    """Verify Super Admin authentication via environment credentials and token claims."""
    res = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    })
    assert res.status_code == 200, f"Super admin login failed: {res.text}"
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    user = data["user"]
    assert user["role"] == "super_admin"
    assert user["username"] == settings.ADMIN_USERNAME

    # Security check: Password / hash never leaked
    assert "password" not in user
    assert "hashed_password" not in user
    assert "password" not in data
    assert "hashed_password" not in data

    # Test /api/auth/me
    token = data["access_token"]
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["role"] == "super_admin"
    assert "password" not in me_data
    assert "hashed_password" not in me_data


def test_04_create_and_authenticate_two_department_hods():
    """Create two HODs for CSE (Dept 15) and IT (Dept 21) and verify login and password hashing."""
    # 1. Login Super Admin to create HOD accounts
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_token = admin_login["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    ts = int(datetime.utcnow().timestamp())
    hod_cse_uname = f"hod_cse_{ts}"
    hod_it_uname = f"hod_it_{ts}"

    # Create HOD CSE (dept 15)
    cse_create = client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_cse_uname,
        "password": "SecurePasswordCSE123!",
        "full_name": "Dr. CSE Department Head",
        "email": f"hod_cse_{ts}@geca.ac.in",
        "role": "hod",
        "department_id": 15
    })
    assert cse_create.status_code == 201, f"Create HOD CSE failed: {cse_create.text}"
    cse_user = cse_create.json()
    assert cse_user["department_id"] == 15
    assert "password" not in cse_user
    assert "hashed_password" not in cse_user

    # Create HOD IT (dept 21)
    it_create = client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_it_uname,
        "password": "SecurePasswordIT123!",
        "full_name": "Dr. IT Department Head",
        "email": f"hod_it_{ts}@geca.ac.in",
        "role": "hod",
        "department_id": 21
    })
    assert it_create.status_code == 201, f"Create HOD IT failed: {it_create.text}"
    it_user = it_create.json()
    assert it_user["department_id"] == 21
    assert "password" not in it_user
    assert "hashed_password" not in it_user

    # Verify password is not plaintext in DB
    with engine.connect() as conn:
        row = conn.execute(text("SELECT hashed_password FROM admin_users WHERE username = :u"), {"u": hod_cse_uname}).fetchone()
        assert row is not None
        assert row[0] != "SecurePasswordCSE123!"
        assert verify_password("SecurePasswordCSE123!", row[0]) is True

    # 2. Login as HOD CSE
    login_cse = client.post("/api/auth/login", json={
        "username": hod_cse_uname,
        "password": "SecurePasswordCSE123!"
    })
    assert login_cse.status_code == 200
    cse_token_data = login_cse.json()
    assert cse_token_data["user"]["role"] == "hod"
    assert cse_token_data["user"]["department_id"] == 15

    # 3. Login as HOD IT
    login_it = client.post("/api/auth/login", json={
        "username": hod_it_uname,
        "password": "SecurePasswordIT123!"
    })
    assert login_it.status_code == 200
    it_token_data = login_it.json()
    assert it_token_data["user"]["role"] == "hod"
    assert it_token_data["user"]["department_id"] == 21

    # 4. Verify /api/auth/me for HODs
    me_cse = client.get("/api/auth/me", headers={"Authorization": f"Bearer {cse_token_data['access_token']}"}).json()
    assert me_cse["department_id"] == 15
    assert me_cse["role"] == "hod"

    me_it = client.get("/api/auth/me", headers={"Authorization": f"Bearer {it_token_data['access_token']}"}).json()
    assert me_it["department_id"] == 21
    assert me_it["role"] == "hod"


def test_05_student_login_and_exam_preservation():
    """Verify existing student login and assessment endpoints continue working properly."""
    # 1. Test existing original student login (original students have enrollment_no as password)
    with engine.connect() as conn:
        row = conn.execute(text("SELECT enrollment_no FROM students WHERE enrollment_no LIKE 'CSE%' AND is_active = true ORDER BY id ASC LIMIT 1")).fetchone()
        assert row is not None
        orig_enrollment = row[0]

    res = client.post("/api/student/login", json={
        "enrollment_no": orig_enrollment,
        "password": orig_enrollment
    })
    assert res.status_code == 200, f"Original student login failed: {res.text}"
    st_data = res.json()
    assert "access_token" in st_data
    assert "student" in st_data
    assert st_data["student"]["enrollment_no"] == orig_enrollment
    orig_token = st_data["access_token"]

    # Student exams list
    exams_res = client.get("/api/student/exams", headers={"Authorization": f"Bearer {orig_token}"})
    assert exams_res.status_code == 200


# =========================================================================
# 3. DEPARTMENT-LEVEL AUTHORIZATION & ISOLATION
# =========================================================================

def test_06_department_isolation_subjects():
    """Test that HOD IT cannot modify or delete CSE subjects, and vice versa."""
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    ts = int(datetime.utcnow().timestamp())
    hod_cse_uname = f"hod_cse_subj_{ts}"
    hod_it_uname = f"hod_it_subj_{ts}"

    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_cse_uname,
        "password": "Pass123!HodCSE",
        "full_name": "HOD CSE",
        "role": "hod",
        "department_id": 15
    })
    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_it_uname,
        "password": "Pass123!HodIT",
        "full_name": "HOD IT",
        "role": "hod",
        "department_id": 21
    })

    token_cse = client.post("/api/auth/login", json={"username": hod_cse_uname, "password": "Pass123!HodCSE"}).json()["access_token"]
    headers_cse = {"Authorization": f"Bearer {token_cse}"}

    token_it = client.post("/api/auth/login", json={"username": hod_it_uname, "password": "Pass123!HodIT"}).json()["access_token"]
    headers_it = {"Authorization": f"Bearer {token_it}"}

    # 1. HOD CSE creates a subject for CSE (Dept 15) -> SUCCESS
    sub_cse_res = client.post("/api/subjects", headers=headers_cse, json={
        "name": f"CSE Advanced Operating Systems {ts}",
        "code": f"CSE_OS_{ts}",
        "department_id": 15,
        "is_active": True
    })
    assert sub_cse_res.status_code == 201
    cse_subj_id = sub_cse_res.json()["id"]

    # 2. HOD IT attempts to create a subject assigned to CSE (Dept 15) -> 403 FORBIDDEN
    cross_create = client.post("/api/subjects", headers=headers_it, json={
        "name": f"IT Hacker Subject {ts}",
        "code": f"HACK_SUBJ_{ts}",
        "department_id": 15,
        "is_active": True
    })
    assert cross_create.status_code == 403, f"Expected 403, got {cross_create.status_code}"

    # 3. HOD IT attempts to edit CSE subject -> 403 FORBIDDEN
    cross_edit = client.put(f"/api/subjects/{cse_subj_id}", headers=headers_it, json={
        "name": "Tampered CSE Subject"
    })
    assert cross_edit.status_code == 403, f"Expected 403, got {cross_edit.status_code}"

    # 4. HOD IT attempts to toggle status of CSE subject -> 403 FORBIDDEN
    cross_status = client.patch(f"/api/subjects/{cse_subj_id}/status", headers=headers_it, json={
        "is_active": False
    })
    assert cross_status.status_code == 403, f"Expected 403, got {cross_status.status_code}"

    # 5. HOD IT attempts to delete CSE subject -> 403 FORBIDDEN
    cross_delete = client.delete(f"/api/subjects/{cse_subj_id}", headers=headers_it)
    assert cross_delete.status_code == 403, f"Expected 403, got {cross_delete.status_code}"

    # 6. HOD CSE can successfully edit their own subject -> 200
    own_edit = client.put(f"/api/subjects/{cse_subj_id}", headers=headers_cse, json={
        "name": f"CSE Operating Systems Updated {ts}"
    })
    assert own_edit.status_code == 200

    # Clean up created subject
    client.delete(f"/api/subjects/{cse_subj_id}", headers=headers_cse)


def test_07_department_isolation_students():
    """Test that HOD IT cannot create, update, or tamper with CSE students."""
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    ts = int(datetime.utcnow().timestamp())
    hod_cse_uname = f"hod_cse_st_{ts}"
    hod_it_uname = f"hod_it_st_{ts}"

    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_cse_uname,
        "password": "Pass123!HodCSE",
        "full_name": "HOD CSE",
        "role": "hod",
        "department_id": 15
    })
    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_it_uname,
        "password": "Pass123!HodIT",
        "full_name": "HOD IT",
        "role": "hod",
        "department_id": 21
    })

    token_cse = client.post("/api/auth/login", json={"username": hod_cse_uname, "password": "Pass123!HodCSE"}).json()["access_token"]
    headers_cse = {"Authorization": f"Bearer {token_cse}"}

    token_it = client.post("/api/auth/login", json={"username": hod_it_uname, "password": "Pass123!HodIT"}).json()["access_token"]
    headers_it = {"Authorization": f"Bearer {token_it}"}

    # 1. HOD CSE creates student in CSE (Dept 15) -> SUCCESS
    st_res = client.post("/api/admin/students", headers=headers_cse, json={
        "enrollment_no": f"BT26F15F_{ts}",
        "name": "CSE Student Test",
        "department": "Computer Science & Engineering",
        "password": "password123"
    })
    assert st_res.status_code == 201, st_res.text
    cse_student = st_res.json()
    cse_student_id = cse_student["id"]

    # 2. HOD IT attempts to create a student directly in CSE -> 403 FORBIDDEN
    cross_st_create = client.post("/api/admin/students", headers=headers_it, json={
        "enrollment_no": f"BT26F21_HACK_{ts}",
        "name": "Hacked CSE Student",
        "department": "Computer Science & Engineering",
        "password": "password123"
    })
    assert cross_st_create.status_code == 403, f"Expected 403, got {cross_st_create.status_code}"

    # 3. HOD IT attempts to update CSE student's profile -> 403 FORBIDDEN
    cross_st_update = client.put(f"/api/admin/students/{cse_student_id}", headers=headers_it, json={
        "name": "Tampered Name"
    })
    assert cross_st_update.status_code == 403, f"Expected 403, got {cross_st_update.status_code}"

    # 4. HOD IT attempts to toggle status of CSE student -> 403 FORBIDDEN
    cross_st_status = client.patch(f"/api/admin/students/{cse_student_id}/status", headers=headers_it, json={
        "is_active": False
    })
    assert cross_st_status.status_code == 403, f"Expected 403, got {cross_st_status.status_code}"

    # 5. HOD IT queries student list -> cannot see the CSE student
    it_students_res = client.get("/api/admin/students/list", headers=headers_it)
    assert it_students_res.status_code == 200
    it_student_ids = [s["id"] for s in it_students_res.json()]
    assert cse_student_id not in it_student_ids, "HOD IT must not see CSE students in /api/admin/students/list"


def test_08_department_isolation_exams():
    """Test that HOD IT cannot modify, assign, or delete exams belonging to CSE."""
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    ts = int(datetime.utcnow().timestamp())
    hod_cse_uname = f"hod_cse_exam_{ts}"
    hod_it_uname = f"hod_it_exam_{ts}"

    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_cse_uname,
        "password": "Pass123!HodCSE",
        "full_name": "HOD CSE",
        "role": "hod",
        "department_id": 15
    })
    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_it_uname,
        "password": "Pass123!HodIT",
        "full_name": "HOD IT",
        "role": "hod",
        "department_id": 21
    })

    token_cse = client.post("/api/auth/login", json={"username": hod_cse_uname, "password": "Pass123!HodCSE"}).json()["access_token"]
    headers_cse = {"Authorization": f"Bearer {token_cse}"}

    token_it = client.post("/api/auth/login", json={"username": hod_it_uname, "password": "Pass123!HodIT"}).json()["access_token"]
    headers_it = {"Authorization": f"Bearer {token_it}"}

    # 1. HOD CSE creates exam under CSE (Dept 15)
    exam_res = client.post("/api/admin/exams", headers=headers_cse, json={
        "title": f"CSE Algorithms Midterm {ts}",
        "department_id": 15,
        "duration_minutes": 45,
        "total_questions": 10,
        "selection_mode": "random",
        "status": "draft"
    })
    assert exam_res.status_code == 201, exam_res.text
    cse_exam_id = exam_res.json()["id"]

    # 2. HOD IT attempts to create exam assigned to CSE (Dept 15) -> 403 FORBIDDEN
    cross_exam_create = client.post("/api/admin/exams", headers=headers_it, json={
        "title": f"IT Exam In CSE {ts}",
        "department_id": 15,
        "duration_minutes": 45
    })
    assert cross_exam_create.status_code == 403

    # 3. HOD IT attempts to update CSE exam -> 403 FORBIDDEN
    cross_exam_update = client.put(f"/api/admin/exams/{cse_exam_id}", headers=headers_it, json={
        "title": "Hacked Exam Title"
    })
    assert cross_exam_update.status_code == 403

    # 4. HOD IT attempts to assign students to CSE exam -> 403 FORBIDDEN
    cross_exam_assign = client.post(f"/api/admin/exams/{cse_exam_id}/assign", headers=headers_it, json={
        "student_ids": [1]
    })
    assert cross_exam_assign.status_code == 403

    # 5. HOD IT attempts to delete CSE exam -> 403 FORBIDDEN
    cross_exam_delete = client.delete(f"/api/admin/exams/{cse_exam_id}", headers=headers_it)
    assert cross_exam_delete.status_code == 403

    # Clean up exam by HOD CSE
    client.delete(f"/api/admin/exams/{cse_exam_id}", headers=headers_cse)


def test_09_department_isolation_questions():
    """Test that HOD IT cannot modify, deactivate, or delete CSE questions."""
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    ts = int(datetime.utcnow().timestamp())
    hod_cse_uname = f"hod_cse_q_{ts}"
    hod_it_uname = f"hod_it_q_{ts}"

    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_cse_uname,
        "password": "Pass123!HodCSE",
        "full_name": "HOD CSE",
        "role": "hod",
        "department_id": 15
    })
    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_it_uname,
        "password": "Pass123!HodIT",
        "full_name": "HOD IT",
        "role": "hod",
        "department_id": 21
    })

    token_cse = client.post("/api/auth/login", json={"username": hod_cse_uname, "password": "Pass123!HodCSE"}).json()["access_token"]
    headers_cse = {"Authorization": f"Bearer {token_cse}"}

    token_it = client.post("/api/auth/login", json={"username": hod_it_uname, "password": "Pass123!HodIT"}).json()["access_token"]
    headers_it = {"Authorization": f"Bearer {token_it}"}

    # 1. HOD CSE creates a question under CSE (Dept 15)
    q_res = client.post("/api/admin/questions", headers=headers_cse, json={
        "question_text": f"What is the complexity of DFS? {ts}",
        "option_a": "O(V+E)",
        "option_b": "O(V^2)",
        "option_c": "O(1)",
        "option_d": "O(log V)",
        "correct_answer": "A",
        "department_id": 15,
        "difficulty": "Easy"
    })
    assert q_res.status_code == 201, q_res.text
    cse_q_id = q_res.json()["id"]

    # 2. HOD IT attempts to create a question under CSE (Dept 15) -> 403 FORBIDDEN
    cross_q_create = client.post("/api/admin/questions", headers=headers_it, json={
        "question_text": "What is Python?",
        "option_a": "Lang", "option_b": "Snake", "option_c": "Both", "option_d": "None",
        "correct_answer": "A",
        "department_id": 15
    })
    assert cross_q_create.status_code == 403

    # 3. HOD IT attempts to update CSE question -> 403 FORBIDDEN
    cross_q_update = client.put(f"/api/admin/questions/{cse_q_id}", headers=headers_it, json={
        "question_text": "Tampered Question Text"
    })
    assert cross_q_update.status_code == 403

    # 4. HOD IT attempts to toggle status of CSE question -> 403 FORBIDDEN
    cross_q_status = client.patch(f"/api/admin/questions/{cse_q_id}/status", headers=headers_it, json={
        "is_active": False
    })
    assert cross_q_status.status_code == 403

    # 5. HOD IT attempts to deactivate CSE question -> 403 FORBIDDEN
    cross_q_deact = client.post(f"/api/admin/questions/{cse_q_id}/deactivate", headers=headers_it)
    assert cross_q_deact.status_code == 403

    # 6. HOD IT attempts to delete CSE question -> 403 FORBIDDEN
    cross_q_del = client.delete(f"/api/admin/questions/{cse_q_id}", headers=headers_it)
    assert cross_q_del.status_code == 403

    # Clean up question by HOD CSE
    client.delete(f"/api/admin/questions/{cse_q_id}", headers=headers_cse)


def test_10_department_isolation_exports():
    """Test that CSV / Excel export respects HOD department boundary."""
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    ts = int(datetime.utcnow().timestamp())
    hod_it_uname = f"hod_it_export_{ts}"

    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_it_uname,
        "password": "Pass123!HodIT",
        "full_name": "HOD IT",
        "role": "hod",
        "department_id": 21
    })

    token_it = client.post("/api/auth/login", json={"username": hod_it_uname, "password": "Pass123!HodIT"}).json()["access_token"]
    headers_it = {"Authorization": f"Bearer {token_it}"}

    # Export CSV as HOD IT
    csv_res = client.get("/api/admin/export/csv", headers=headers_it)
    assert csv_res.status_code == 200
    csv_content = csv_res.content.decode("utf-8")
    
    # Check that CSV does NOT contain Computer Science & Engineering students
    assert "Computer Science & Engineering" not in csv_content, "HOD IT export must not contain CSE students"


def test_11_super_admin_exclusive_endpoints():
    """Verify that only Super Admin can access admin user management and institutional settings."""
    admin_login = client.post("/api/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    ts = int(datetime.utcnow().timestamp())
    hod_uname = f"hod_sec_chk_{ts}"
    client.post("/api/admin/users", headers=admin_headers, json={
        "username": hod_uname,
        "password": "Pass123!HodSec",
        "full_name": "HOD Security Test",
        "role": "hod",
        "department_id": 15
    })

    token_hod = client.post("/api/auth/login", json={"username": hod_uname, "password": "Pass123!HodSec"}).json()["access_token"]
    headers_hod = {"Authorization": f"Bearer {token_hod}"}

    # 1. HOD tries to list all admin users -> 403 FORBIDDEN
    res_users = client.get("/api/admin/users", headers=headers_hod)
    assert res_users.status_code == 403, f"Expected 403, got {res_users.status_code}"

    # 2. HOD tries to create an admin user -> 403 FORBIDDEN
    res_create_user = client.post("/api/admin/users", headers=headers_hod, json={
        "username": f"bad_admin_{ts}",
        "password": "password",
        "full_name": "Unauthorized User",
        "role": "super_admin"
    })
    assert res_create_user.status_code == 403, f"Expected 403, got {res_create_user.status_code}"

    # 3. HOD tries to create a department -> 403 FORBIDDEN
    res_create_dept = client.post("/api/departments", headers=headers_hod, json={
        "name": f"Hacked Department {ts}",
        "code": f"HACK_{ts}"
    })
    assert res_create_dept.status_code == 403, f"Expected 403, got {res_create_dept.status_code}"

    # 4. HOD tries to change institutional assessment settings -> 403 FORBIDDEN
    res_settings = client.put("/api/admin/assessment-settings", headers=headers_hod, json={
        "question_count": 20,
        "time_limit_minutes": 30
    })
    assert res_settings.status_code == 403, f"Expected 403, got {res_settings.status_code}"
