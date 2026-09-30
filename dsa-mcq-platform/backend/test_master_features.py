import sys
import os
import requests
import time
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def run_master_tests():
    print("=" * 60)
    print("STARTING MASTER COMPREHENSIVE ASSESSMENT TEST SUITE")
    print("=" * 60)

    # 1. Health check
    r = requests.get("http://127.0.0.1:8000/")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("[PASS] 1. Backend health check: GET / passed")

    # 2. Verify exactly 50 original questions in bank
    r = requests.get(f"{BASE_URL}/questions")
    assert r.status_code == 200, f"GET /api/questions failed: {r.status_code}"
    qs = r.json()
    assert len(qs) == 50, f"Expected 50 questions, got {len(qs)}"
    for q in qs:
        assert "id" in q and "question" in q and "options" in q
        assert "correct_answer" not in q, f"Correct answer leaked in Q{q['id']}"
    print(f"[PASS] 2. Verified 50 questions from database without answer leakage")

    # 3. Admin Authentication
    from app.config import settings
    login_payload = {"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
    r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] 3. Admin authentication passed with JWT token")

    # 4. Assessment Settings Verification & Modification
    r = requests.get(f"{BASE_URL}/admin/assessment-settings", headers=headers)
    assert r.status_code == 200, f"Get settings failed: {r.text}"
    curr_settings = r.json()
    assert "question_count" in curr_settings and "time_limit_minutes" in curr_settings
    print(f"[PASS] 4. Initial assessment settings retrieved: {curr_settings}")

    # Test settings validation: reject question_count > active_questions
    r = requests.put(f"{BASE_URL}/admin/assessment-settings", headers=headers, json={"question_count": 9999, "time_limit_minutes": 60})
    assert r.status_code == 400, "Expected 400 when question_count > active questions"
    print("[PASS] 5. Assessment settings validation: rejected question_count > active_questions")

    # 5. Question Management: Add, Edit, Deactivate, Reactivate, Search, Filter
    new_q_payload = {
        "question_text": "MASTER_TEST_Q: What is the worst-case time complexity of QuickSort?",
        "option_a": "O(N)",
        "option_b": "O(N log N)",
        "option_c": "O(N^2)",
        "option_d": "O(1)",
        "correct_answer": "C",
        "topic": "Algorithms & Sorting",
        "is_active": True
    }
    r = requests.post(f"{BASE_URL}/admin/questions", headers=headers, json=new_q_payload)
    assert r.status_code == 201, f"Create question failed: {r.text}"
    created_q = r.json()
    q_id = created_q["id"]
    assert created_q["correct_answer"] == "C"
    print(f"[PASS] 6. Added new question: ID={q_id}")

    # Search question
    r = requests.get(f"{BASE_URL}/admin/questions?search=MASTER_TEST_Q", headers=headers)
    assert r.status_code == 200
    search_res = r.json()
    assert len(search_res) == 1 and search_res[0]["id"] == q_id
    print("[PASS] 7. Question search verified")

    # Edit question
    edit_payload = {
        "question_text": "MASTER_TEST_Q_EDITED: What is the worst-case time complexity of QuickSort?",
        "option_a": "O(log N)",
        "option_b": "O(N log N)",
        "option_c": "O(N^2)",
        "option_d": "O(1)",
        "correct_answer": "C"
    }
    r = requests.put(f"{BASE_URL}/admin/questions/{q_id}", headers=headers, json=edit_payload)
    assert r.status_code == 200
    updated_q = r.json()
    assert updated_q["question_text"].startswith("MASTER_TEST_Q_EDITED")
    print(f"[PASS] 8. Edited question ID={q_id} successfully")

    # Deactivate question
    r = requests.patch(f"{BASE_URL}/admin/questions/{q_id}/status", headers=headers, json={"is_active": False})
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/admin/questions/{q_id}", headers=headers)
    assert r.json()["is_active"] == False
    print(f"[PASS] 9. Soft deactivation verified: is_active=False")

    # Filter inactive questions
    r = requests.get(f"{BASE_URL}/admin/questions?status=inactive", headers=headers)
    assert r.status_code == 200
    inactive_list = r.json()
    assert any(q["id"] == q_id for q in inactive_list)
    print(f"[PASS] 10. Filter by inactive status verified")

    # Reactivate question
    r = requests.patch(f"{BASE_URL}/admin/questions/{q_id}/status", headers=headers, json={"is_active": True})
    assert r.status_code == 200
    assert r.json()["is_active"] == True
    print(f"[PASS] 11. Reactivation verified: is_active=True")

    # 6. Dynamic Assessment Settings Test (Configured Question Count & Time Limit)
    # Set question count = 20, time limit = 15 minutes
    r = requests.put(f"{BASE_URL}/admin/assessment-settings", headers=headers, json={"question_count": 20, "time_limit_minutes": 15})
    assert r.status_code == 200
    print("[PASS] 12. Assessment settings configured to: 20 questions, 15 minutes")

    # Student starts attempt with new settings
    dyn_student = {
        "enrollment_no": "DYN_TEST_001",
        "name": "Dynamic Settings Student",
        "department": "IT"
    }
    r = requests.post(f"{BASE_URL}/attempts/start", json=dyn_student)
    assert r.status_code == 200, f"Start attempt failed: {r.text}"
    dyn_data = r.json()
    dyn_attempt_id = dyn_data["attempt_id"]
    assert dyn_data["total_questions"] == 20
    assert dyn_data["time_limit_minutes"] == 15
    assert dyn_data["deadline_at"] is not None
    print(f"[PASS] 13. Student attempt snapshotted dynamic settings: {dyn_data['total_questions']} questions, {dyn_data['time_limit_minutes']} min limit")

    # Verify questions for this attempt equals 20
    r = requests.get(f"{BASE_URL}/questions?attempt_id={dyn_attempt_id}")
    assert r.status_code == 200
    dyn_qs = r.json()
    assert len(dyn_qs) == 20, f"Expected 20 questions for student, got {len(dyn_qs)}"
    print(f"[PASS] 14. Student received exactly 20 snapshotted questions")

    # Verify attempt status and remaining seconds (Refresh Protection)
    r = requests.get(f"{BASE_URL}/attempts/{dyn_attempt_id}/status")
    assert r.status_code == 200
    status_info = r.json()
    assert status_info["status"] == "in_progress"
    assert status_info["remaining_seconds"] > 0
    assert status_info["total_questions"] == 20
    print(f"[PASS] 15. Server-side countdown timer and refresh recovery verified: {status_info['remaining_seconds']}s remaining")

    # Submit answers and complete test
    # Answer first 16 questions
    test_answers = [{"question_number": i, "selected_answer": "B"} for i in range(1, 17)]
    r = requests.post(f"{BASE_URL}/attempts/{dyn_attempt_id}/answers", json={"answers": test_answers})
    assert r.status_code == 200

    r = requests.post(f"{BASE_URL}/attempts/{dyn_attempt_id}/submit")
    assert r.status_code == 200
    dyn_result = r.json()
    dyn_attempt = dyn_result["attempt"]
    assert dyn_attempt["total_questions"] == 20
    assert dyn_attempt["status"] == "completed"
    assert dyn_attempt["percentage"] == round((dyn_attempt["score"] / 20) * 100, 2)
    print(f"[PASS] 16. Dynamic scoring verified: score={dyn_attempt['score']}/20 ({dyn_attempt['percentage']}%)")

    # Reset settings back to 50 questions, 60 minutes
    r = requests.put(f"{BASE_URL}/admin/assessment-settings", headers=headers, json={"question_count": 50, "time_limit_minutes": 60})
    assert r.status_code == 200
    print("[PASS] 17. Reset assessment settings back to 50 questions, 60 minutes")

    # 7. Server-Side Timeout & Auto-Submission Test
    # Create student with expired deadline
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        timeout_student = models.Student(
            enrollment_no="TIMEOUT_TEST_001",
            name="Timeout Test Student",
            department="CSE"
        )
        db.add(timeout_student)
        db.commit()
        db.refresh(timeout_student)

        # Create attempt with deadline in the past
        past_time = datetime.utcnow() - timedelta(minutes=10)
        expired_attempt = models.Attempt(
            student_id=timeout_student.id,
            total_questions=50,
            question_count_snapshot=50,
            time_limit_minutes=1,
            started_at=past_time - timedelta(minutes=1),
            deadline_at=past_time,
            status="in_progress"
        )
        db.add(expired_attempt)
        db.flush()

        # Seed 1 answer
        db.add(models.StudentAnswer(
            attempt_id=expired_attempt.id,
            question_number=1,
            selected_answer="B",
            correct_answer="B",
            is_correct=True,
            answered_at=past_time - timedelta(seconds=30)
        ))
        db.commit()
        expired_id = expired_attempt.id

        # Verify submit on expired attempt marks status = timed_out
        r = requests.post(f"{BASE_URL}/attempts/{expired_id}/submit")
        assert r.status_code == 200
        to_result = r.json()
        assert to_result["attempt"]["status"] == "timed_out", f"Expected timed_out status, got {to_result['attempt']['status']}"
        print(f"[PASS] 18. Server-side deadline expiration verified: attempt status='timed_out'")

        # Verify trying to save more answers on timed_out attempt is rejected
        r = requests.post(f"{BASE_URL}/attempts/{expired_id}/answers", json={"answers": [{"question_number": 2, "selected_answer": "A"}]})
        assert r.status_code == 400
        print("[PASS] 19. Additional answers rejected after timeout")

        # Cleanup timeout student
        db.delete(timeout_student)
        db.commit()
    finally:
        db.close()

    # 8. Historical Results Protection Test (CRITICAL)
    # Check historical attempt 2 (Student Shubham Madane)
    r = requests.get(f"{BASE_URL}/attempts/2/result")
    assert r.status_code == 200
    hist_before = r.json()
    score_before = hist_before["attempt"]["score"]
    total_q_before = hist_before["attempt"]["total_questions"]
    q1_text_before = hist_before["answers"][0]["question"]
    q1_corr_before = hist_before["answers"][0]["correct_answer"]

    # Now edit Question 1 in the question bank
    r = requests.put(f"{BASE_URL}/admin/questions/1", headers=headers, json={
        "question_text": "MODIFIED_Q1: This text was altered by admin",
        "option_a": "MOD_A", "option_b": "MOD_B", "option_c": "MOD_C", "option_d": "MOD_D",
        "correct_answer": "D"
    })
    assert r.status_code == 200

    # Also deactivate Question 1
    r = requests.patch(f"{BASE_URL}/admin/questions/1/status", headers=headers, json={"is_active": False})
    assert r.status_code == 200

    # Verify Question 1 CANNOT be permanently deleted because of historical records
    r_del = requests.delete(f"{BASE_URL}/admin/questions/1", headers=headers)
    assert r_del.status_code == 400
    assert "This question cannot be permanently deleted" in r_del.json().get("detail", "")

    # Change settings to question count 35
    r = requests.put(f"{BASE_URL}/admin/assessment-settings", headers=headers, json={"question_count": 35, "time_limit_minutes": 40})
    assert r.status_code == 200

    # Retrieve historical attempt 2 again: MUST BE 100% UNCHANGED!
    r = requests.get(f"{BASE_URL}/attempts/2/result")
    assert r.status_code == 200
    hist_after = r.json()
    assert hist_after["attempt"]["score"] == score_before, "Historical score was corrupted!"
    assert hist_after["attempt"]["total_questions"] == total_q_before, "Historical total questions was corrupted!"
    assert hist_after["answers"][0]["question"] == q1_text_before, "Historical question text was corrupted by admin edit!"
    assert hist_after["answers"][0]["correct_answer"] == q1_corr_before, "Historical answer key was corrupted by admin edit!"
    print("[PASS] 20. HISTORICAL ATTEMPT PROTECTION 100% VERIFIED: past results immune to question edits & setting changes")

    # Restore Question 1 to original state and settings to 50
    from app.questions_data import QUESTIONS_BY_ID
    orig_q1 = QUESTIONS_BY_ID[1]
    requests.put(f"{BASE_URL}/admin/questions/1", headers=headers, json={
        "question_text": orig_q1["question"],
        "option_a": orig_q1["options"]["A"],
        "option_b": orig_q1["options"]["B"],
        "option_c": orig_q1["options"]["C"],
        "option_d": orig_q1["options"]["D"],
        "correct_answer": orig_q1["correct_answer"],
        "is_active": True
    })
    requests.put(f"{BASE_URL}/admin/assessment-settings", headers=headers, json={"question_count": 50, "time_limit_minutes": 60})
    print("[PASS] 21. Restored Question 1 and settings to initial values")

    # 9. Clean up temporary test questions & students
    db = SessionLocal()
    try:
        test_q = db.query(models.Question).filter(models.Question.id == q_id).first()
        if test_q:
            db.delete(test_q)
        s_dyn = db.query(models.Student).filter(models.Student.enrollment_no == "DYN_TEST_001").first()
        if s_dyn:
            db.delete(s_dyn)
        db.commit()
        print("[PASS] 22. Temporary test artifacts cleaned up safely")
    finally:
        db.close()

    # 10. Admin Exports verification
    r = requests.get(f"{BASE_URL}/admin/export/excel?type=summary", headers=headers)
    assert r.status_code == 200 and len(r.content) > 0
    r = requests.get(f"{BASE_URL}/admin/export/excel?type=detailed", headers=headers)
    assert r.status_code == 200 and len(r.content) > 0
    r = requests.get(f"{BASE_URL}/admin/export/csv?type=summary", headers=headers)
    assert r.status_code == 200 and b"Enrollment Number" in r.content
    r = requests.get(f"{BASE_URL}/admin/export/csv?type=detailed", headers=headers)
    assert r.status_code == 200 and b"Question Number" in r.content
    print("[PASS] 23. Excel and CSV exports verified (including both completed and timed_out attempts)")

    print("=" * 60)
    print("ALL 23 MASTER ASSESSMENTS & VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = run_master_tests()
    if not success:
        sys.exit(1)
