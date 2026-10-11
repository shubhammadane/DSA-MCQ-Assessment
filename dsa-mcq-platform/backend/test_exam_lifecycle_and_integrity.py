import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models
from app.config import settings
from app.auth import hash_password

client = TestClient(app)

def test_exam_lifecycle_department_subject_and_safe_delete():
    print("\n" + "=" * 70)
    print("STARTING TEST: EXAM LIFECYCLE, DYNAMIC DEPT/SUBJECT & SAFE ARCHIVE")
    print("=" * 70)

    db = SessionLocal()
    ts = int(datetime.utcnow().timestamp())

    try:
        # 1. Setup departments & subjects in DB
        dept_cse = db.query(models.Department).filter(models.Department.name.ilike("%Computer%")).first()
        if not dept_cse:
            dept_cse = models.Department(name=f"Computer Science {ts}", code="CSE", is_active=True)
            db.add(dept_cse)
            db.commit()
            db.refresh(dept_cse)

        dept_it = db.query(models.Department).filter(models.Department.name.ilike("%Information%")).first()
        if not dept_it:
            dept_it = models.Department(name=f"Information Technology {ts}", code="IT", is_active=True)
            db.add(dept_it)
            db.commit()
            db.refresh(dept_it)

        # Subject for CSE
        subj_cse = db.query(models.Subject).filter(models.Subject.department_id == dept_cse.id).first()
        if not subj_cse:
            subj_cse = models.Subject(
                name=f"Data Structures {ts}",
                code=f"CS{ts % 1000}",
                department_id=dept_cse.id,
                department_name=dept_cse.name,
                is_active=True
            )
            db.add(subj_cse)
            db.commit()
            db.refresh(subj_cse)

        # Subject for IT
        subj_it = db.query(models.Subject).filter(models.Subject.department_id == dept_it.id).first()
        if not subj_it:
            subj_it = models.Subject(
                name=f"Cloud Computing {ts}",
                code=f"IT{ts % 1000}",
                department_id=dept_it.id,
                department_name=dept_it.name,
                is_active=True
            )
            db.add(subj_it)
            db.commit()
            db.refresh(subj_it)

        # Ensure active questions exist for subj_cse
        q_count = db.query(models.Question).filter(models.Question.subject_id == subj_cse.id, models.Question.is_active == True).count()
        if q_count < 5:
            for i in range(5 - q_count):
                q = models.Question(
                    question_text=f"Question {i+1} for CSE {ts}",
                    option_a="A", option_b="B", option_c="C", option_d="D",
                    correct_answer="A",
                    subject_id=subj_cse.id,
                    subject_name=subj_cse.name,
                    department_id=dept_cse.id,
                    department_name=dept_cse.name,
                    is_active=True
                )
                db.add(q)
            db.commit()

        # Create HOD CSE and HOD IT users
        hod_cse_uname = f"hod_cse_test_{ts}"
        hod_it_uname = f"hod_it_test_{ts}"

        hod_cse_user = models.AdminUser(
            username=hod_cse_uname,
            hashed_password=hash_password("Pass123!"),
            full_name="HOD CSE Test",
            role="hod",
            department_id=dept_cse.id,
            is_active=True
        )
        hod_it_user = models.AdminUser(
            username=hod_it_uname,
            hashed_password=hash_password("Pass123!"),
            full_name="HOD IT Test",
            role="hod",
            department_id=dept_it.id,
            is_active=True
        )
        db.add_all([hod_cse_user, hod_it_user])
        db.commit()

        dept_cse_id = dept_cse.id
        dept_cse_name = dept_cse.name
        dept_it_id = dept_it.id
        dept_it_name = dept_it.name
        subj_cse_id = subj_cse.id
        subj_cse_name = subj_cse.name
        subj_it_id = subj_it.id
        subj_it_name = subj_it.name
    finally:
        db.close()

    # 2. Authenticate Super Admin, HOD CSE, and HOD IT
    admin_login = client.post("/api/auth/login", json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD})
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    token_cse = client.post("/api/auth/login", json={"username": hod_cse_uname, "password": "Pass123!"}).json()["access_token"]
    headers_cse = {"Authorization": f"Bearer {token_cse}"}

    token_it = client.post("/api/auth/login", json={"username": hod_it_uname, "password": "Pass123!"}).json()["access_token"]
    headers_it = {"Authorization": f"Bearer {token_it}"}

    print("[PASS] Authentication for Super Admin, HOD CSE, and HOD IT verified.")

    # 3. Dynamic Subject Verification: Query subjects for CSE
    cse_subjs_res = client.get(f"/api/subjects?department_id={dept_cse_id}&is_active=true", headers=admin_headers)
    assert cse_subjs_res.status_code == 200
    cse_subjs = cse_subjs_res.json()
    assert any(s["id"] == subj_cse_id for s in cse_subjs)
    assert not any(s["id"] == subj_it_id for s in cse_subjs), "Cross-department subject should not be listed!"
    print(f"[PASS] Dynamic subjects for Dept {dept_cse_id} returned {len(cse_subjs)} subject(s) without cross-dept leakage.")

    # 4. REJECT INVALID COMBINATION: CSE department with IT subject
    bad_exam_payload = {
        "title": f"Mismatched Exam {ts}",
        "department_id": dept_cse_id,
        "subject_id": subj_it_id,  # IT subject with CSE department!
        "duration_minutes": 30,
        "total_questions": 5,
        "selection_mode": "random",
        "status": "draft"
    }
    bad_res = client.post("/api/admin/exams", headers=admin_headers, json=bad_exam_payload)
    assert bad_res.status_code == 400, f"Expected 400 for mismatched subject/dept, got {bad_res.status_code}: {bad_res.text}"
    assert "does not belong to the selected department" in bad_res.json()["detail"]
    print(f"[PASS] Invalid dept/subject combination successfully rejected: {bad_res.json()['detail']}")

    # 5. REJECT CROSS-DEPARTMENT CREATION: HOD CSE creates exam in IT department -> 403 Forbidden
    cross_dept_exam = {
        "title": f"Unauthorized IT Exam {ts}",
        "department_id": dept_it_id,
        "subject_id": subj_it_id,
        "duration_minutes": 30,
        "total_questions": 5,
        "selection_mode": "random",
        "status": "draft"
    }
    cross_res = client.post("/api/admin/exams", headers=headers_cse, json=cross_dept_exam)
    assert cross_res.status_code == 403, f"Expected 403, got {cross_res.status_code}"
    print("[PASS] Cross-department exam creation by HOD blocked with HTTP 403.")

    # 6. CREATE VALID EXAM with correct Dept & Subject
    valid_exam_payload = {
        "title": f"Valid CSE Exam {ts}",
        "department_id": dept_cse_id,
        "subject_id": subj_cse_id,
        "duration_minutes": 45,
        "total_questions": 3,
        "marks_per_question": 1,
        "selection_mode": "random",
        "status": "published"
    }
    create_res = client.post("/api/admin/exams", headers=headers_cse, json=valid_exam_payload)
    assert create_res.status_code == 201, f"Create exam failed: {create_res.text}"
    exam_data = create_res.json()
    created_exam_id = exam_data["id"]
    assert exam_data["department_id"] == dept_cse_id
    assert exam_data["subject_id"] == subj_cse_id
    print(f"[PASS] Exam #{created_exam_id} created with verified department_id={dept_cse_id} and subject_id={subj_cse_id}.")

    # 7. PERMISSIONS: HOD IT cannot delete or archive CSE exam -> 403 Forbidden
    unauth_del = client.delete(f"/api/admin/exams/{created_exam_id}", headers=headers_it)
    assert unauth_del.status_code == 403, f"Expected 403 for unauthorized HOD delete, got {unauth_del.status_code}"
    unauth_arch = client.post(f"/api/admin/exams/{created_exam_id}/archive", headers=headers_it)
    assert unauth_arch.status_code == 403, f"Expected 403 for unauthorized HOD archive, got {unauth_arch.status_code}"
    print("[PASS] Unauthorized cross-department HOD delete and archive blocked with HTTP 403.")

    # 8. ARCHIVE & UNARCHIVE ACTION (EXAM WITH 0 ATTEMPTS)
    arch_res = client.post(f"/api/admin/exams/{created_exam_id}/archive", headers=headers_cse)
    assert arch_res.status_code == 200, f"Archive failed: {arch_res.text}"
    assert arch_res.json()["archived"] is True

    # Verify status changed to archived and is_active is False
    chk_exam = client.get(f"/api/admin/exams/{created_exam_id}", headers=headers_cse).json()
    assert chk_exam["status"] == "archived"
    assert chk_exam["is_active"] is False
    print(f"[PASS] Exam #{created_exam_id} successfully archived (status='archived', is_active=False).")

    # Unarchive / restore exam
    unarch_res = client.post(f"/api/admin/exams/{created_exam_id}/unarchive", headers=headers_cse)
    assert unarch_res.status_code == 200
    assert unarch_res.json()["archived"] is False
    chk_restored = client.get(f"/api/admin/exams/{created_exam_id}", headers=headers_cse).json()
    assert chk_restored["status"] == "draft"
    assert chk_restored["is_active"] is True
    print(f"[PASS] Exam #{created_exam_id} successfully restored to draft.")

    # 9. PROTECT COMPLETED ATTEMPTS: Simulate an attempt and verify hard delete is BLOCKED
    db = SessionLocal()
    try:
        # Create a test student in dept_cse
        test_student = models.Student(
            enrollment_no=f"STU_EXAM_TEST_{ts}",
            name="Exam Attempt Protection Student",
            department=dept_cse_name,
            department_id=dept_cse_id,
            is_active=True
        )
        db.add(test_student)
        db.commit()
        db.refresh(test_student)
        test_student_id = test_student.id

        # Create an attempt linked to created_exam_id
        attempt = models.Attempt(
            student_id=test_student_id,
            exam_id=created_exam_id,
            exam_title_snapshot=valid_exam_payload["title"],
            subject_name_snapshot=subj_cse_name,
            total_questions=3,
            score=3,
            percentage=100.0,
            status="completed",
            completed_at=datetime.utcnow()
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        test_attempt_id = attempt.id
    finally:
        db.close()

    # Attempt hard DELETE on exam with recorded attempt -> MUST BE BLOCKED WITH 400!
    blocked_del = client.delete(f"/api/admin/exams/{created_exam_id}", headers=admin_headers)
    assert blocked_del.status_code == 400, f"Expected 400 when deleting exam with attempts, got {blocked_del.status_code}"
    error_msg = blocked_del.json()["detail"]
    assert "recorded attempt" in error_msg and "archive" in error_msg.lower()
    print(f"[PASS] Hard delete safely blocked for exam with attempts: '{error_msg}'")

    # Verify student attempt and marks are completely intact!
    db = SessionLocal()
    try:
        att_db = db.query(models.Attempt).filter(models.Attempt.id == test_attempt_id).first()
        assert att_db is not None, "Attempt was erroneously deleted!"
        assert att_db.score == 3
        assert att_db.percentage == 100.0
        print(f"[PASS] Student score ({att_db.score}) and completion record 100% protected.")
    finally:
        db.close()

    # SAFE ARCHIVE: Archive exam with attempts -> MUST SUCCEED
    archive_with_attempts = client.post(f"/api/admin/exams/{created_exam_id}/archive", headers=headers_cse)
    assert archive_with_attempts.status_code == 200
    assert archive_with_attempts.json()["archived"] is True
    print(f"[PASS] Exam with attempts safely archived. Attempts count: {archive_with_attempts.json()['attempts_count']}")

    # Clean up test attempt and student to preserve dev DB cleanliness
    db = SessionLocal()
    try:
        db.query(models.Attempt).filter(models.Attempt.id == test_attempt_id).delete()
        db.query(models.Student).filter(models.Student.id == test_student_id).delete()
        db.commit()
    finally:
        db.close()

    # 10. SAFE PERMANENT DELETION OF ELIGIBLE EXAM (0 attempts remaining)
    final_del = client.delete(f"/api/admin/exams/{created_exam_id}", headers=headers_cse)
    assert final_del.status_code == 200, f"Final delete failed: {final_del.text}"
    assert final_del.json()["deleted_id"] == created_exam_id

    # Verify exam is gone from DB
    get_del = client.get(f"/api/admin/exams/{created_exam_id}", headers=headers_cse)
    assert get_del.status_code == 404
    print(f"[PASS] Eligible exam #{created_exam_id} permanently deleted after zero remaining attempts.")

    # Clean up test HOD users
    db = SessionLocal()
    try:
        db.query(models.AdminUser).filter(models.AdminUser.username.in_([hod_cse_uname, hod_it_uname])).delete()
        db.commit()
    finally:
        db.close()

    print("\n" + "=" * 70)
    print("ALL EXAM LIFECYCLE, RBAC & SAFE DELETE/ARCHIVE TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    test_exam_lifecycle_department_subject_and_safe_delete()
