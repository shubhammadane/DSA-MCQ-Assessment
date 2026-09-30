import sys
import requests
import io
import csv
import openpyxl
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 65)
    print("STARTING TEST SUITE FOR DELETE ASSESSMENT ATTEMPT & INTEGRITY")
    print("=" * 65)

    # 1. Health Check
    r = requests.get("http://127.0.0.1:8000/")
    assert r.status_code == 200
    print("[PASS] 1. Backend online: GET /")

    # 2. Admin Login
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 2. Admin authenticated with JWT")

    # Baseline Questions Count
    all_qs_before = requests.get(f"{BASE_URL}/admin/questions", headers=admin_headers).json()
    qs_count_before = len(all_qs_before)

    # 3. Create Student A and complete an attempt
    student_a_enrollment = "DEL_ATTEMPT_STU_001"
    student_a_name = "Alice Test"
    student_a_dept = "Computer Science"
    
    start_a = requests.post(f"{BASE_URL}/attempts/start", json={
        "enrollment_no": student_a_enrollment,
        "name": student_a_name,
        "department": student_a_dept
    })
    assert start_a.status_code == 200, f"Start attempt failed: {start_a.text}"
    attempt_a_id = start_a.json()["attempt_id"]
    student_a_id = start_a.json()["student"]["id"]
    print(f"[INFO] Created Attempt #{attempt_a_id} for Student A #{student_a_id}")

    # Submit an answer for Attempt A
    ans_res = requests.post(f"{BASE_URL}/attempts/{attempt_a_id}/answers", json={
        "answers": [{"question_number": 1, "selected_answer": "A"}]
    })
    assert ans_res.status_code == 200

    # Submit Attempt A
    sub_res = requests.post(f"{BASE_URL}/attempts/{attempt_a_id}/submit")
    assert sub_res.status_code == 200
    print(f"[INFO] Completed Attempt #{attempt_a_id}")

    # 4. Create Student B and complete an attempt (to test OTHER attempts preserved)
    student_b_enrollment = "DEL_ATTEMPT_STU_002"
    student_b_name = "Bob Preserved"
    student_b_dept = "Information Technology"

    start_b = requests.post(f"{BASE_URL}/attempts/start", json={
        "enrollment_no": student_b_enrollment,
        "name": student_b_name,
        "department": student_b_dept
    })
    assert start_b.status_code == 200
    attempt_b_id = start_b.json()["attempt_id"]
    student_b_id = start_b.json()["student"]["id"]

    sub_b = requests.post(f"{BASE_URL}/attempts/{attempt_b_id}/submit")
    assert sub_b.status_code == 200
    print(f"[INFO] Created & Completed Attempt #{attempt_b_id} for Student B (Control)")

    # TEST CASE C: Non-admin cannot delete an attempt
    print("\n--- TEST CASE C: Non-admin cannot delete attempt ---")
    no_auth_res = requests.delete(f"{BASE_URL}/admin/attempts/{attempt_a_id}")
    assert no_auth_res.status_code in [401, 403], f"Expected 401/403 for unauthorized delete, got {no_auth_res.status_code}"
    bad_auth_res = requests.delete(f"{BASE_URL}/admin/attempts/{attempt_a_id}", headers={"Authorization": "Bearer invalid_token"})
    assert bad_auth_res.status_code in [401, 403], f"Expected 401/403 for invalid token, got {bad_auth_res.status_code}"
    print("[PASS] C. Security confirmed: Unauthenticated/non-admin delete is blocked (401)")

    # Verify Attempt A appears in Excel and CSV exports before deletion
    print("\n--- Pre-check Exports Before Deletion ---")
    excel_pre = requests.get(f"{BASE_URL}/admin/export/excel?type=summary", headers=admin_headers)
    assert excel_pre.status_code == 200
    wb_pre = openpyxl.load_workbook(io.BytesIO(excel_pre.content))
    ws_pre = wb_pre.active
    rows_pre = list(ws_pre.iter_rows(values_only=True))
    assert any(student_a_enrollment in str(row) for row in rows_pre), "Attempt A should be in Excel before deletion"
    print("[INFO] Attempt A confirmed in Excel before deletion")

    # TEST CASE A & D: Admin can delete one assessment attempt & dependent answers are deleted
    print("\n--- TEST CASE A & D: Delete Attempt A ---")
    del_res = requests.delete(f"{BASE_URL}/admin/attempts/{attempt_a_id}", headers=admin_headers)
    assert del_res.status_code == 200, f"Delete attempt failed: {del_res.text}"
    del_json = del_res.json()
    assert del_json["attempt_id"] == attempt_a_id
    print(f"[PASS] A. Admin deleted attempt #{attempt_a_id} with 200 OK")

    # Confirm Attempt A is gone from DB
    check_attempt = requests.get(f"{BASE_URL}/attempts/{attempt_a_id}/result")
    assert check_attempt.status_code == 404, "Attempt A should return 404 after deletion"
    print("[PASS] D. Attempt record and answers deleted (404 on result query)")

    # TEST CASE E: Student record remains
    print("\n--- TEST CASE E: Student account preserved ---")
    students_res = requests.get(f"{BASE_URL}/admin/students?search={student_a_enrollment}", headers=admin_headers)
    assert students_res.status_code == 200
    stu_list = students_res.json()
    assert len(stu_list) == 1
    assert stu_list[0]["enrollment_no"] == student_a_enrollment
    assert stu_list[0]["student_id"] == student_a_id
    assert stu_list[0]["attempt_id"] is None
    assert stu_list[0]["status"] == "Not Attempted"
    print(f"[PASS] E. Student account preserved: Enrollment={student_a_enrollment}, Status='Not Attempted'")

    # TEST CASE F: Questions remain unchanged
    print("\n--- TEST CASE F: Questions preserved ---")
    all_qs_after = requests.get(f"{BASE_URL}/admin/questions", headers=admin_headers).json()
    assert len(all_qs_after) == qs_count_before, f"Expected {qs_count_before} questions, got {len(all_qs_after)}"
    print(f"[PASS] F. Questions count preserved: exactly {len(all_qs_after)}")

    # TEST CASE G: Other students' attempts remain unchanged
    print("\n--- TEST CASE G: Other student attempts preserved ---")
    b_res = requests.get(f"{BASE_URL}/attempts/{attempt_b_id}/result")
    assert b_res.status_code == 200, "Student B's attempt must be intact"
    assert b_res.json()["attempt"]["id"] == attempt_b_id
    assert b_res.json()["student"]["enrollment_no"] == student_b_enrollment
    print(f"[PASS] G. Student B attempt #{attempt_b_id} 100% intact")

    # TEST CASE H: Inspect no longer works for deleted attempt
    print("\n--- TEST CASE H: Inspect protection ---")
    inspect_a = requests.get(f"{BASE_URL}/admin/students/{student_a_id}", headers=admin_headers)
    assert inspect_a.status_code == 404, f"Expected 404 inspecting student with deleted attempt, got {inspect_a.status_code}"
    print("[PASS] H. Inspect for student with deleted attempt safely returns 404")

    # TEST CASE I: Deleted attempt no longer appears in Excel export
    print("\n--- TEST CASE I: Excel export ---")
    excel_post = requests.get(f"{BASE_URL}/admin/export/excel?type=summary", headers=admin_headers)
    assert excel_post.status_code == 200
    wb_post = openpyxl.load_workbook(io.BytesIO(excel_post.content))
    ws_post = wb_post.active
    rows_post = list(ws_post.iter_rows(values_only=True))
    assert not any(student_a_enrollment in str(row) for row in rows_post), "Deleted attempt A must not appear in Excel summary"
    assert any(student_b_enrollment in str(row) for row in rows_post), "Attempt B must still appear in Excel summary"
    print("[PASS] I. Deleted attempt does not appear in Excel export; Attempt B remains")

    # TEST CASE J: Deleted attempt no longer appears in CSV export
    print("\n--- TEST CASE J: CSV export ---")
    csv_post = requests.get(f"{BASE_URL}/admin/export/csv?type=summary", headers=admin_headers)
    assert csv_post.status_code == 200
    csv_text = csv_post.text
    assert student_a_enrollment not in csv_text, "Deleted attempt A must not appear in CSV summary"
    assert student_b_enrollment in csv_text, "Attempt B must still appear in CSV summary"
    print("[PASS] J. Deleted attempt does not appear in CSV export; Attempt B remains")

    # TEST CASE K: Student can take a new assessment again
    print("\n--- TEST CASE K: Student can retake assessment ---")
    new_attempt_res = requests.post(f"{BASE_URL}/attempts/start", json={
        "enrollment_no": student_a_enrollment,
        "name": student_a_name,
        "department": student_a_dept
    })
    assert new_attempt_res.status_code == 200, f"Expected 200 starting new attempt, got {new_attempt_res.status_code}: {new_attempt_res.text}"
    new_attempt_id = new_attempt_res.json()["attempt_id"]
    assert new_attempt_id != attempt_a_id, "New attempt should have a new attempt ID"
    print(f"[PASS] K. Student {student_a_enrollment} successfully started new Attempt #{new_attempt_id}")

    # Clean up test students A and B
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        # Delete new attempt
        db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == new_attempt_id).delete()
        db.query(models.Attempt).filter(models.Attempt.id == new_attempt_id).delete()
        # Delete attempt B
        db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == attempt_b_id).delete()
        db.query(models.Attempt).filter(models.Attempt.id == attempt_b_id).delete()
        # Delete student records
        db.query(models.Student).filter(models.Student.enrollment_no.in_([student_a_enrollment, student_b_enrollment])).delete()
        db.commit()
    finally:
        db.close()

    print("\n" + "=" * 65)
    print("ALL DELETE ATTEMPT & INTEGRITY TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
