import sys
import os
import requests
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=== Starting End-to-End Test Suite ===")

    # 1. Health check
    try:
        r = requests.get("http://localhost:8000/")
        assert r.status_code == 200, f"Root endpoint failed: {r.status_code}"
        print("[PASS] Backend is online: GET / passed")
    except Exception as e:
        print(f"[FAIL] Backend connection failed: {e}")
        return False

    # 2. Verify exactly 50 fixed questions
    r = requests.get(f"{BASE_URL}/questions")
    assert r.status_code == 200, f"GET /api/questions failed: {r.status_code}"
    questions = r.json()
    assert len(questions) == 50, f"Expected 50 questions, got {len(questions)}"
    for q in questions:
        assert "id" in q and "question" in q and "options" in q
        assert len(q["options"]) == 4, f"Question {q['id']} does not have 4 options"
        assert "correct_answer" not in q, f"Sanitization failed: correct_answer leaked in Q{q['id']}"
    print(f"[PASS] Fixed 50 questions verified without answer leakage: {len(questions)} questions")

    # 3. Register / Start attempt for test student
    test_student = {
        "enrollment_no": "AUTO_TEST_001",
        "name": "Automated Test Student",
        "department": "CSE"
    }

    # Start attempt
    r = requests.post(f"{BASE_URL}/attempts/start", json=test_student)
    assert r.status_code == 200, f"Start attempt failed: {r.text}"
    start_data = r.json()
    attempt_id = start_data["attempt_id"]
    student_id = start_data["student"]["id"]
    print(f"[PASS] Student and Attempt created: student_id={student_id}, attempt_id={attempt_id}")

    # 4. Save answers incrementally (Batch answer request)
    # Let's answer 30 correctly and 20 incorrectly or unselected
    # First get ground truth from questions_data in backend for test scoring verification
    from app.questions_data import QUESTIONS_BY_ID
    answers = []
    expected_correct = 30
    for q_id in range(1, 51):
        corr = QUESTIONS_BY_ID[q_id]["correct_answer"]
        if q_id <= 30:
            selected = corr
        elif q_id <= 45:
            # Pick a wrong option
            opts = ["A", "B", "C", "D"]
            opts.remove(corr)
            selected = opts[0]
        else:
            selected = None # Unanswered
        answers.append({"question_number": q_id, "selected_answer": selected})

    r = requests.post(f"{BASE_URL}/attempts/{attempt_id}/answers", json={"answers": answers})
    assert r.status_code == 200, f"Save answers failed: {r.text}"
    print("[PASS] Incremental answers saved to PostgreSQL successfully")

    # 5. Submit test
    r = requests.post(f"{BASE_URL}/attempts/{attempt_id}/submit")
    assert r.status_code == 200, f"Submit test failed: {r.text}"
    result = r.json()
    attempt_info = result["attempt"]
    assert attempt_info["total_questions"] == 50
    assert attempt_info["score"] == 30, f"Expected score 30, got {attempt_info['score']}"
    assert attempt_info["correct_answers"] == 30
    assert attempt_info["wrong_answers"] == 20
    assert attempt_info["percentage"] == 60.0
    assert attempt_info["status"] == "completed"
    assert len(result["answers"]) == 50
    print("[PASS] Test submitted & score calculated correctly: Score=30/50 (60.0%), Correct=30, Wrong=20")

    # 6. Verify duplicate attempt prevention
    r = requests.post(f"{BASE_URL}/attempts/start", json=test_student)
    assert r.status_code == 400, f"Expected 400 for duplicate attempt, got {r.status_code}"
    assert "already completed" in r.text.lower(), f"Unexpected error message: {r.text}"
    print("[PASS] Duplicate attempt check passed: student cannot re-attempt")

    # 7. Admin Login
    from app.config import settings
    login_payload = {
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin authentication passed with JWT token")

    # 8. Admin Dashboard Stats
    r = requests.get(f"{BASE_URL}/admin/dashboard", headers=headers)
    assert r.status_code == 200, f"Admin dashboard failed: {r.text}"
    stats = r.json()
    assert stats["total_students"] >= 1
    assert stats["completed_tests"] >= 1
    print(f"[PASS] Admin Dashboard stats verified: {stats}")

    # 9. Admin Student List and Search
    r = requests.get(f"{BASE_URL}/admin/students?search=AUTO_TEST_001", headers=headers)
    assert r.status_code == 200, f"Admin students list failed: {r.text}"
    students_list = r.json()
    assert len(students_list) == 1
    assert students_list[0]["enrollment_no"] == "AUTO_TEST_001"
    print("[PASS] Admin Students search and listing verified")

    # 10. Admin Student Details
    r = requests.get(f"{BASE_URL}/admin/students/{student_id}", headers=headers)
    assert r.status_code == 200, f"Admin student details failed: {r.text}"
    details = r.json()
    assert len(details["answers"]) == 50
    print("[PASS] Admin Student detailed question-by-question review verified")

    # 11. Admin Exports (Excel & CSV)
    r = requests.get(f"{BASE_URL}/admin/export/excel?type=summary", headers=headers)
    assert r.status_code == 200 and len(r.content) > 0, "Excel summary export failed"
    r = requests.get(f"{BASE_URL}/admin/export/excel?type=detailed", headers=headers)
    assert r.status_code == 200 and len(r.content) > 0, "Excel detailed export failed"
    r = requests.get(f"{BASE_URL}/admin/export/csv?type=summary", headers=headers)
    assert r.status_code == 200 and b"Enrollment Number" in r.content, "CSV summary export failed"
    r = requests.get(f"{BASE_URL}/admin/export/csv?type=detailed", headers=headers)
    assert r.status_code == 200 and b"Question Number" in r.content, "CSV detailed export failed"
    print("[PASS] Admin Excel and CSV exports verified (both summary and detailed)")

    # 12. Cleanup test student
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        s = db.query(models.Student).filter(models.Student.enrollment_no == "AUTO_TEST_001").first()
        if s:
            db.delete(s)
            db.commit()
            print("[PASS] Temporary test data cleaned up safely from PostgreSQL")
    finally:
        db.close()

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
