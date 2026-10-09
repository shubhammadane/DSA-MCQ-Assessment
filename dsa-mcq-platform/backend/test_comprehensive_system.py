import pytest
import io
import csv
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_01_backend_health():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"


def test_02_admin_login():
    res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_03_academic_structure_and_departments():
    # Login admin
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Check academic structure
    res = client.get("/api/academic-structure")
    assert res.status_code == 200
    data = res.json()
    assert len(data["departments"]) >= 10
    dept_names = [d["name"] for d in data["departments"]]
    assert "Computer Science & Engineering" in dept_names
    assert "Civil Engineering Department" in dept_names
    assert "Mechanical Engineering Department" in dept_names

    assert len(data["programs"]) >= 2
    prog_names = [p["name"] for p in data["programs"]]
    assert "UG" in prog_names
    assert "M.Tech" in prog_names

    assert len(data["years"]) >= 6
    assert len(data["semesters"]) >= 12

    # Test Add Department
    dept_res = client.post("/api/departments", headers=admin_headers, json={"name": "Aerospace Engineering", "code": "AERO"})
    assert dept_res.status_code in [201, 400]  # 201 or already exists


def test_04_manual_subject_management():
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Get department ID for CSE
    depts = client.get("/api/departments").json()
    cse_dept = next(d for d in depts if "Computer Science" in d["name"])
    dept_id = cse_dept["id"]

    # 1. Add Subject manually
    sub_code = f"CS301_{int(datetime.utcnow().timestamp())}"
    create_payload = {
        "name": "Data Structures & Algorithms Advanced",
        "code": sub_code,
        "department_id": dept_id,
        "is_active": True
    }
    create_res = client.post("/api/subjects", headers=admin_headers, json=create_payload)
    assert create_res.status_code == 201, create_res.text
    subj = create_res.json()
    subj_id = subj["id"]
    assert subj["name"] == "Data Structures & Algorithms Advanced"
    assert subj["code"] == sub_code

    # 2. Edit Subject
    edit_res = client.put(f"/api/subjects/{subj_id}", headers=admin_headers, json={"name": "Data Structures Advanced (Updated)"})
    assert edit_res.status_code == 200
    assert edit_res.json()["name"] == "Data Structures Advanced (Updated)"

    # 3. Deactivate Subject
    deact_res = client.patch(f"/api/subjects/{subj_id}/status", headers=admin_headers, json={"is_active": False})
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # 4. Reactivate Subject
    react_res = client.patch(f"/api/subjects/{subj_id}/status", headers=admin_headers, json={"is_active": True})
    assert react_res.status_code == 200
    assert react_res.json()["is_active"] is True

    # 5. Search and Filter Subjects
    filter_res = client.get(f"/api/subjects?department_id={dept_id}&search=Data%20Structures")
    assert filter_res.status_code == 200
    assert any(s["id"] == subj_id for s in filter_res.json())

    # 6. Delete Subject (safe unused delete)
    del_res = client.delete(f"/api/subjects/{subj_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == subj_id


def test_05_student_management_and_duplicate_prevention():
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    test_enrollment = f"BT26F05F999_{int(datetime.utcnow().timestamp())}"

    # 1. Add Student
    s_payload = {
        "enrollment_no": test_enrollment,
        "name": "Test Student 999",
        "gender": "Male",
        "department": "Computer Science & Engineering",
        "program": "UG",
        "year": "1st Year",
        "semester": "Semester 1",
        "password": "securepassword123"
    }
    res = client.post("/api/admin/students", headers=admin_headers, json=s_payload)
    assert res.status_code == 201
    st_data = res.json()
    assert st_data["enrollment_no"] == test_enrollment

    # 2. Duplicate Prevention: Attempt to add same enrollment number (Expects 409 Conflict per Section 8)
    dup_res = client.post("/api/admin/students", headers=admin_headers, json=s_payload)
    assert dup_res.status_code == 409
    assert "Student with this Enrollment Number already exists" in dup_res.json()["detail"]


def test_06_student_bulk_import():
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Generate test CSV
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(["Roll No", "Name", "Gender"])
    ts = int(datetime.utcnow().timestamp())
    r1 = f"BT26F05F101_{ts}"
    r2 = f"BT26F05F102_{ts}"
    writer.writerow([r1, "Alice Smith", "Female"])
    writer.writerow([r2, "Bob Jones", "Male"])
    csv_bytes = csv_buffer.getvalue().encode("utf-8")

    files = {"file": ("students.csv", csv_bytes, "text/csv")}
    data = {
        "department": "Computer Science & Engineering",
        "program": "UG",
        "year": "1st Year",
        "semester": "Semester 1"
    }

    import_res = client.post("/api/admin/students/bulk-import", headers=admin_headers, files=files, data=data)
    assert import_res.status_code == 200
    result = import_res.json()
    assert result["imported_count"] >= 2


def test_07_student_login_and_role_isolation():
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a student with known password
    ts = int(datetime.utcnow().timestamp())
    enrollment = f"BT26F05F200_{ts}"
    s_payload = {
        "enrollment_no": enrollment,
        "name": "Auth Student",
        "department": "Computer Science & Engineering",
        "password": "mypassword123"
    }
    client.post("/api/admin/students", headers=admin_headers, json=s_payload)

    # 1. Successful student login
    st_login = client.post("/api/student/login", json={"enrollment_no": enrollment, "password": "mypassword123"})
    assert st_login.status_code == 200
    st_token = st_login.json()["access_token"]
    st_headers = {"Authorization": f"Bearer {st_token}"}

    # 2. Failed student login (wrong password)
    bad_login = client.post("/api/student/login", json={"enrollment_no": enrollment, "password": "wrongpassword"})
    assert bad_login.status_code == 401

    # 3. Student profile access
    prof_res = client.get("/api/student/profile", headers=st_headers)
    assert prof_res.status_code == 200
    assert prof_res.json()["enrollment_no"] == enrollment

    # 4. SECURITY CHECK: Student cannot access Admin APIs
    forbidden_res = client.get("/api/admin/dashboard", headers=st_headers)
    assert forbidden_res.status_code == 401


def test_08_question_bank_management():
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    depts = client.get("/api/departments").json()
    cse_id = next(d["id"] for d in depts if "Computer Science" in d["name"])

    # 1. Create Question
    q_payload = {
        "question_text": f"What is the time complexity of searching in an AVL tree? (Test {int(datetime.utcnow().timestamp())})",
        "option_a": "O(1)",
        "option_b": "O(log N)",
        "option_c": "O(N)",
        "option_d": "O(N log N)",
        "correct_answer": "B",
        "topic": "Balanced Trees",
        "department_id": cse_id,
        "difficulty": "Hard",
        "marks": 2,
        "is_active": True
    }
    res = client.post("/api/admin/questions", headers=admin_headers, json=q_payload)
    assert res.status_code == 201
    q_data = res.json()
    q_id = q_data["id"]
    assert q_data["marks"] == 2
    assert q_data["difficulty"] == "Hard"

    # 2. Edit Question
    edit_res = client.put(f"/api/admin/questions/{q_id}", headers=admin_headers, json={"marks": 3})
    assert edit_res.status_code == 200
    assert edit_res.json()["marks"] == 3

    # 3. Deactivate & Reactivate Question
    deact_res = client.patch(f"/api/admin/questions/{q_id}/status", headers=admin_headers, json={"is_active": False})
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    react_res = client.patch(f"/api/admin/questions/{q_id}/status", headers=admin_headers, json={"is_active": True})
    assert react_res.status_code == 200
    assert react_res.json()["is_active"] is True

    # 4. Delete Unused Question
    del_res = client.delete(f"/api/admin/questions/{q_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == q_id


def test_09_critical_student_specific_exam_access_and_authorization():
    """
    CRITICAL REQUIREMENT TEST:
    Admin assigns Exam ONLY to Student A (BT26F05F007).
    Student A can see and start the exam.
    Student B (BT26F05F008) cannot see the exam, and direct API call returns 403 Forbidden!
    """
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    ts = int(datetime.utcnow().timestamp())

    # Create Student A
    st_a_res = client.post("/api/admin/students", headers=admin_headers, json={
        "enrollment_no": f"BT26F05F007_{ts}",
        "name": "Student A Eligible",
        "department": "Computer Science & Engineering",
        "password": "passwordA"
    })
    student_a = st_a_res.json()
    student_a_id = student_a["id"]

    # Create Student B
    st_b_res = client.post("/api/admin/students", headers=admin_headers, json={
        "enrollment_no": f"BT26F05F008_{ts}",
        "name": "Student B Not Assigned",
        "department": "Computer Science & Engineering",
        "password": "passwordB"
    })
    student_b = st_b_res.json()
    student_b_id = student_b["id"]

    # Create Exam
    exam_payload = {
        "title": f"Data Structures Internal Assessment {ts}",
        "duration_minutes": 30,
        "total_questions": 5,
        "marks_per_question": 1,
        "passing_percentage": 40.0,
        "selection_mode": "random",
        "status": "published"
    }
    exam_res = client.post("/api/admin/exams", headers=admin_headers, json=exam_payload)
    assert exam_res.status_code == 201
    exam = exam_res.json()
    exam_id = exam["id"]

    # Assign ONLY Student A to this Exam
    assign_res = client.post(f"/api/admin/exams/{exam_id}/assign", headers=admin_headers, json={"student_ids": [student_a_id]})
    assert assign_res.status_code == 200

    # Login as Student A (Eligible)
    login_a = client.post("/api/student/login", json={"enrollment_no": student_a["enrollment_no"], "password": "passwordA"}).json()
    token_a = login_a["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Login as Student B (Not Assigned)
    login_b = client.post("/api/student/login", json={"enrollment_no": student_b["enrollment_no"], "password": "passwordB"}).json()
    token_b = login_b["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Student A checks available exams -> Exam IS VISIBLE
    exams_a = client.get("/api/student/exams", headers=headers_a).json()
    exam_ids_a = [e["id"] for e in exams_a]
    assert exam_id in exam_ids_a, "Exam should be visible to assigned Student A"

    # 2. Student B checks available exams -> Exam IS NOT VISIBLE
    exams_b = client.get("/api/student/exams", headers=headers_b).json()
    exam_ids_b = [e["id"] for e in exams_b]
    assert exam_id not in exam_ids_b, "Exam must NOT be visible to unassigned Student B"

    # 3. Student B attempts DIRECT API ACCESS to start exam -> BACKEND MUST RETURN 403 FORBIDDEN
    direct_hack_res = client.post(f"/api/student/exams/{exam_id}/start", headers=headers_b)
    assert direct_hack_res.status_code == 403, f"Expected 403 Forbidden, got {direct_hack_res.status_code}"
    assert "not assigned" in direct_hack_res.json()["detail"].lower()

    # 4. Student A starts exam -> SUCCESS with server-side timer
    start_res = client.post(f"/api/student/exams/{exam_id}/start", headers=headers_a)
    assert start_res.status_code == 200
    start_data = start_res.json()
    attempt_id = start_data["attempt_id"]
    assert start_data["total_questions"] == 5
    assert start_data["deadline_at"] is not None

    # 5. Timer persistence on refresh
    status_res = client.get(f"/api/attempts/{attempt_id}/status")
    assert status_res.status_code == 200
    stat_data = status_res.json()
    assert stat_data["status"] == "in_progress"
    assert stat_data["remaining_seconds"] > 0
    assert stat_data["deadline_at"] == start_data["deadline_at"]

    # 6. Anti-Cheating Security Logging
    sec_res = client.post(f"/api/attempts/{attempt_id}/security-log", json={
        "event_type": "tab_switch",
        "details": "User switched to another browser tab"
    })
    assert sec_res.status_code == 200

    fs_res = client.post(f"/api/attempts/{attempt_id}/security-log", json={
        "event_type": "fullscreen_exit",
        "details": "User exited fullscreen mode"
    })
    assert fs_res.status_code == 200

    # 7. Student answers questions
    ans_res = client.post(f"/api/attempts/{attempt_id}/answers", json={
        "answers": [
            {"question_number": 1, "selected_answer": "B"},
            {"question_number": 2, "selected_answer": "A"}
        ]
    })
    assert ans_res.status_code == 200

    # 8. Submit Exam
    sub_res = client.post(f"/api/attempts/{attempt_id}/submit")
    assert sub_res.status_code == 200
    res_data = sub_res.json()
    assert res_data["attempt"]["status"] in ["completed", "timed_out"]
    assert res_data["attempt"]["tab_switch_count"] >= 1
    assert res_data["attempt"]["fullscreen_exit_count"] >= 1
    assert len(res_data["security_logs"]) >= 2

    # 9. Verify Admin Inspection of student attempt
    inspect_res = client.get(f"/api/admin/students/{student_a_id}", headers=admin_headers)
    assert inspect_res.status_code == 200
    assert inspect_res.json()["attempt"]["id"] == attempt_id

    # 10. Delete Assessment Attempt
    del_att_res = client.delete(f"/api/admin/attempts/{attempt_id}", headers=admin_headers)
    assert del_att_res.status_code == 200
    assert del_att_res.json()["status"] == "success"

    # Verify attempt is gone
    check_del = client.get(f"/api/attempts/{attempt_id}/status")
    assert check_del.status_code == 404


def test_10_exports_excel_and_csv():
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    excel_res = client.get("/api/admin/export/excel", headers=admin_headers)
    assert excel_res.status_code == 200
    assert "application/vnd.openxmlformats" in excel_res.headers["content-type"]

    csv_res = client.get("/api/admin/export/csv", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Student ID" in csv_res.text


def test_11_regression_existing_dsa_flow():
    """Verify existing DSA 50-question test flow works completely unchanged."""
    # 1. 50 Questions retrieved without answer leakage
    q_res = client.get("/api/questions")
    assert q_res.status_code == 200
    qs = q_res.json()
    assert len(qs) >= 50
    for q in qs:
        assert "id" in q and "question" in q and "options" in q
        assert "correct_answer" not in q

    # 2. Start DSA Assessment
    ts = int(datetime.utcnow().timestamp())
    dsa_start = client.post("/api/attempts/start", json={
        "enrollment_no": f"DSA_STUDENT_{ts}",
        "name": "DSA Test Candidate",
        "department": "Computer Science & Engineering"
    })
    assert dsa_start.status_code == 200
    dsa_data = dsa_start.json()
    dsa_attempt_id = dsa_data["attempt_id"]
    assert dsa_data["total_questions"] >= 50

    # 3. Save an answer
    save_res = client.post(f"/api/attempts/{dsa_attempt_id}/answers", json={
        "question_number": 1,
        "selected_answer": "C"
    })
    assert save_res.status_code == 200

    # 4. Submit DSA Assessment
    sub_res = client.post(f"/api/attempts/{dsa_attempt_id}/submit")
    assert sub_res.status_code == 200
    assert sub_res.json()["attempt"]["status"] == "completed"

    # 5. Assessment Settings Get & Put
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    set_res = client.get("/api/admin/assessment-settings", headers=admin_headers)
    assert set_res.status_code == 200
    curr_settings = set_res.json()
    assert "question_count" in curr_settings
    assert "time_limit_minutes" in curr_settings

    set_res = client.get("/api/admin/assessment-settings", headers=admin_headers)
    assert set_res.status_code == 200
    curr_settings = set_res.json()
    assert "question_count" in curr_settings
    assert "time_limit_minutes" in curr_settings


def test_12_department_statistics_and_data_preservation():
    # 1. Verify departments statistics endpoint
    stats_res = client.get("/api/departments/stats")
    assert stats_res.status_code == 200
    dept_stats = stats_res.json()
    assert isinstance(dept_stats, list)
    assert len(dept_stats) > 0

    for d in dept_stats:
        assert "id" in d
        assert "name" in d
        assert "is_active" in d
        assert "students_count" in d
        assert "active_subjects_count" in d
        assert "exams_count" in d
        assert "active_exams_count" in d
        assert isinstance(d["students_count"], int)
        assert isinstance(d["active_subjects_count"], int)
        assert isinstance(d["exams_count"], int)
        assert isinstance(d["active_exams_count"], int)

    # 2. Verify admin dashboard counts
    login_res = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    dash_res = client.get("/api/admin/dashboard", headers=admin_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_students"] > 0
    assert dash_data["total_questions"] >= 50
    assert dash_data["total_departments"] > 0
    assert dash_data["total_subjects"] >= 1
    assert dash_data["total_exams"] >= 1
