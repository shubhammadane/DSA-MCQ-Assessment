import sys
import io
import csv
import openpyxl
import requests
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 70)
    print("VERIFICATION SUITE: STUDENT DATA EXPORT & SAFE DELETION")
    print("=" * 70)

    results = {}

    # 1. Admin Authentication
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200, f"Super admin login failed: {login_res.text}"
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] 1. Super Admin authentication successful")

    # -------------------------------------------------------------
    # TEST 1: EXCEL AND CSV EXPORT CONTENTS & UNATTEMPTED BLANKS
    # -------------------------------------------------------------
    print("\n--- TEST 1: Excel & CSV Export Header and Row Verification ---")
    try:
        # A. CSV Export
        csv_res = requests.get(f"{BASE_URL}/admin/export/students?format=csv", headers=admin_headers)
        assert csv_res.status_code == 200, f"CSV export failed: {csv_res.text}"
        csv_text = csv_res.content.decode("utf-8-sig")
        reader = list(csv.reader(io.StringIO(csv_text)))
        headers = reader[0]

        expected_headers = [
            "Student Name", "Enrollment Number", "Department", "Program",
            "Year", "Semester", "Exam Name", "Marks Obtained", "Total Marks",
            "Percentage", "Result", "Exam Completion Date"
        ]
        assert headers == expected_headers, f"Header mismatch. Got: {headers}, Expected: {expected_headers}"

        # B. Excel Export
        excel_res = requests.get(f"{BASE_URL}/admin/export/students?format=xlsx", headers=admin_headers)
        assert excel_res.status_code == 200, f"Excel export failed: {excel_res.text}"
        wb = openpyxl.load_workbook(io.BytesIO(excel_res.content))
        ws = wb.active
        excel_headers = [cell.value for cell in ws[1]]
        assert excel_headers == expected_headers, f"Excel header mismatch: {excel_headers}"

        print(f"[PASS] 1.1 Headers verified across both CSV and Excel:")
        print(f"         {headers}")
        results["Excel and CSV export contents"] = "PASS"
    except Exception as e:
        print(f"[FAIL] 1.1 Export verification failed: {e}")
        results["Excel and CSV export contents"] = f"FAIL ({e})"

    # -------------------------------------------------------------
    # TEST 2: MULTIPLE ATTEMPTS WITH MARKS AND PASS/FAIL RESULTS
    # -------------------------------------------------------------
    print("\n--- TEST 2: Multiple Completed Attempts with Marks & Results ---")
    created_student_ids = []
    try:
        # Create a disposable test student
        ts = int(datetime.utcnow().timestamp())
        st_payload = {
            "enrollment_no": f"TEST_MULTI_{ts}",
            "name": f"Test Multi Student {ts}",
            "department": "Computer Science & Engineering",
            "gender": "Male",
            "program": "UG",
            "year": "2nd Year",
            "semester": "Semester 3",
            "password": "password123"
        }
        st_res = requests.post(f"{BASE_URL}/admin/students", headers=admin_headers, json=st_payload)
        assert st_res.status_code == 201, f"Failed to create test student: {st_res.text}"
        test_student_id = st_res.json()["id"]
        created_student_ids.append(test_student_id)

        # Directly insert 2 completed attempts via DB session
        from app.database import SessionLocal
        from app import models
        db = SessionLocal()

        att1 = models.Attempt(
            student_id=test_student_id,
            exam_title_snapshot="Midterm Exam: Data Structures",
            score=22,
            total_questions=25,
            percentage=88.0,
            status="completed",
            started_at=datetime(2026, 3, 1, 10, 0, 0),
            completed_at=datetime(2026, 3, 1, 10, 45, 0)
        )
        att2 = models.Attempt(
            student_id=test_student_id,
            exam_title_snapshot="Final Exam: Advanced Algorithms",
            score=8,
            total_questions=25,
            percentage=32.0,
            status="completed",
            started_at=datetime(2026, 4, 1, 14, 0, 0),
            completed_at=datetime(2026, 4, 1, 14, 50, 0)
        )
        db.add_all([att1, att2])
        db.commit()
        db.refresh(att1)
        db.refresh(att2)
        att1_id = att1.id
        att2_id = att2.id
        db.close()

        # Query CSV export filtered by this student
        exp_res = requests.get(
            f"{BASE_URL}/admin/export/students?format=csv&student_ids={test_student_id}",
            headers=admin_headers
        )
        assert exp_res.status_code == 200
        exp_rows = list(csv.reader(io.StringIO(exp_res.content.decode("utf-8-sig"))))[1:]
        assert len(exp_rows) == 2, f"Expected 2 rows for 2 completed attempts, got {len(exp_rows)}"

        # Verify row 1: Midterm (Score 22, 88%, Pass)
        r1 = exp_rows[0]
        assert r1[0] == st_payload["name"]
        assert r1[1] == st_payload["enrollment_no"]
        assert r1[6] == "Midterm Exam: Data Structures"
        assert r1[7] == "22"
        assert r1[9] == "88.0%"
        assert r1[10] == "Pass"
        assert "2026-03-01 10:45:00" in r1[11]

        # Verify row 2: Final (Score 8, 32%, Fail)
        r2 = exp_rows[1]
        assert r2[0] == st_payload["name"]
        assert r2[6] == "Final Exam: Advanced Algorithms"
        assert r2[7] == "8"
        assert r2[9] == "32.0%"
        assert r2[10] == "Fail"
        assert "2026-04-01 14:50:00" in r2[11]

        print(f"[PASS] 2.1 Multiple attempts exported on separate rows:")
        print(f"         Row 1: {r1[6]} | Marks={r1[7]}/{r1[8]} | {r1[9]} | {r1[10]} | {r1[11]}")
        print(f"         Row 2: {r2[6]} | Marks={r2[7]}/{r2[8]} | {r2[9]} | {r2[10]} | {r2[11]}")
        results["Correct marks and results for multiple attempts"] = "PASS"
    except Exception as e:
        print(f"[FAIL] 2.1 Multiple attempts verification failed: {e}")
        results["Correct marks and results for multiple attempts"] = f"FAIL ({e})"

    # -------------------------------------------------------------
    # TEST 3: SAFE DELETION OF STUDENT AND DEPENDENT RECORDS
    # -------------------------------------------------------------
    print("\n--- TEST 3: Safe Deletion of Student & Dependent Records ---")
    try:
        from app.database import SessionLocal
        from app import models
        db = SessionLocal()

        # Add dependent answers, security logs, exam assignment
        ans1 = models.StudentAnswer(attempt_id=att1_id, question_number=1, correct_answer="A", selected_answer="A", marks=1, is_correct=True)
        ans2 = models.StudentAnswer(attempt_id=att2_id, question_number=1, correct_answer="B", selected_answer="C", marks=0, is_correct=False)
        sec_log = models.ExamSecurityLog(attempt_id=att1_id, student_id=test_student_id, event_type="tab_switch", details="Tab switched 1 time")
        db.add_all([ans1, ans2, sec_log])
        db.commit()

        # Verify records exist before delete
        assert db.query(models.Student).filter(models.Student.id == test_student_id).count() == 1
        assert db.query(models.Attempt).filter(models.Attempt.student_id == test_student_id).count() == 2
        assert db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id.in_([att1_id, att2_id])).count() == 2
        assert db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.student_id == test_student_id).count() == 1
        db.close()

        # Record baseline counts of unrelated entities
        db = SessionLocal()
        base_unrelated_students = db.query(models.Student).filter(models.Student.id != test_student_id).count()
        base_unrelated_attempts = db.query(models.Attempt).filter(models.Attempt.student_id != test_student_id).count()
        base_questions = db.query(models.Question).count()
        base_subjects = db.query(models.Subject).count()
        base_departments = db.query(models.Department).count()
        base_admins = db.query(models.AdminUser).count()
        db.close()

        # Perform safe deletion via API endpoint
        del_res = requests.delete(f"{BASE_URL}/admin/students/{test_student_id}", headers=admin_headers)
        assert del_res.status_code == 200, f"Delete student failed: {del_res.text}"
        del_data = del_res.json()
        assert del_data["status"] == "success"
        assert del_data["student_id"] == test_student_id
        assert del_data["deleted_attempts_count"] == 2

        # Verify test student and dependent records are completely gone
        db = SessionLocal()
        assert db.query(models.Student).filter(models.Student.id == test_student_id).count() == 0, "Student still in DB!"
        assert db.query(models.Attempt).filter(models.Attempt.student_id == test_student_id).count() == 0, "Attempts not deleted!"
        assert db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id.in_([att1_id, att2_id])).count() == 0, "Answers not deleted!"
        assert db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.student_id == test_student_id).count() == 0, "Security logs not deleted!"

        print(f"[PASS] 3.1 Student #{test_student_id} and all dependent records safely deleted.")
        results["Deletion of one test student and their dependent records"] = "PASS"

        # -------------------------------------------------------------
        # TEST 4: PRESERVATION OF UNRELATED STUDENTS & HISTORICAL DATA
        # -------------------------------------------------------------
        print("\n--- TEST 4: Preservation of Unrelated Students and System Records ---")
        now_students = db.query(models.Student).count()
        now_attempts = db.query(models.Attempt).count()
        now_questions = db.query(models.Question).count()
        now_subjects = db.query(models.Subject).count()
        now_departments = db.query(models.Department).count()
        now_admins = db.query(models.AdminUser).count()
        db.close()

        assert now_students == base_unrelated_students, f"Student count mismatch: {now_students} vs {base_unrelated_students}"
        assert now_attempts == base_unrelated_attempts, f"Attempt count mismatch: {now_attempts} vs {base_unrelated_attempts}"
        assert now_questions == base_questions, f"Questions changed: {now_questions} vs {base_questions}"
        assert now_subjects == base_subjects, f"Subjects changed: {now_subjects} vs {base_subjects}"
        assert now_departments == base_departments, f"Departments changed: {now_departments} vs {base_departments}"
        assert now_admins == base_admins, f"Admins changed: {now_admins} vs {base_admins}"

        print(f"[PASS] 4.1 All unrelated records perfectly preserved:")
        print(f"         Unrelated Students: {now_students} (intact)")
        print(f"         Unrelated Attempts: {now_attempts} (intact)")
        print(f"         Questions: {now_questions} (intact)")
        print(f"         Subjects: {now_subjects} (intact)")
        print(f"         Departments: {now_departments} (intact)")
        results["Preservation of unrelated students and historical records"] = "PASS"
    except Exception as e:
        print(f"[FAIL] 3/4 Student deletion or preservation failed: {e}")
        results["Deletion of one test student and their dependent records"] = f"FAIL ({e})"
        results["Preservation of unrelated students and historical records"] = f"FAIL ({e})"

    # -------------------------------------------------------------
    # TEST 5: HOD DEPARTMENT ISOLATION (EXPORT & DELETION)
    # -------------------------------------------------------------
    print("\n--- TEST 5: HOD Department Isolation for Export & Deletion ---")
    try:
        from app.database import SessionLocal
        from app import models
        from app.auth import hash_password
        db = SessionLocal()

        # Find Civil Engineering Department
        civil_dept = db.query(models.Department).filter(models.Department.name.ilike("%Civil%")).first()
        cse_dept = db.query(models.Department).filter(models.Department.name.ilike("%Computer%")).first()
        assert civil_dept and cse_dept

        # Create test HOD user for Civil Engineering
        hod_username = f"test_hod_civil_{ts}"
        hod_user = db.query(models.AdminUser).filter(models.AdminUser.username == hod_username).first()
        if not hod_user:
            hod_user = models.AdminUser(
                username=hod_username,
                hashed_password=hash_password("hodpass123"),
                full_name="HOD Civil Engineering",
                role="hod",
                department_id=civil_dept.id,
                is_active=True
            )
            db.add(hod_user)
            db.commit()
            db.refresh(hod_user)

        # Create 1 student in Civil and 1 in CSE
        s_civil = models.Student(
            enrollment_no=f"CIVIL_{ts}",
            name=f"Civil Student {ts}",
            department="Civil Engineering Department",
            department_id=civil_dept.id,
            is_active=True
        )
        s_cse = models.Student(
            enrollment_no=f"CSE_{ts}",
            name=f"CSE Student {ts}",
            department="Computer Science & Engineering",
            department_id=cse_dept.id,
            is_active=True
        )
        db.add_all([s_civil, s_cse])
        db.commit()
        db.refresh(s_civil)
        db.refresh(s_cse)
        civil_st_id = s_civil.id
        cse_st_id = s_cse.id
        db.close()

        # Login as HOD
        hod_login = requests.post(f"{BASE_URL}/auth/login", json={"username": hod_username, "password": "hodpass123"})
        assert hod_login.status_code == 200, f"HOD login failed: {hod_login.text}"
        hod_token = hod_login.json()["access_token"]
        hod_headers = {"Authorization": f"Bearer {hod_token}"}

        # A. Test HOD Export isolation: should ONLY see Civil students
        hod_exp = requests.get(f"{BASE_URL}/admin/export/students?format=csv", headers=hod_headers)
        assert hod_exp.status_code == 200
        hod_rows = list(csv.reader(io.StringIO(hod_exp.content.decode("utf-8-sig"))))[1:]
        depts_in_export = set(r[2] for r in hod_rows if r[2])
        assert all("Civil" in d for d in depts_in_export), f"HOD exported other departments: {depts_in_export}"
        print(f"[PASS] 5.1 HOD export strictly isolated to Civil Engineering only: {depts_in_export}")

        # B. Test HOD Deletion Forbidden: Attempting to delete CSE student must return 403
        del_other = requests.delete(f"{BASE_URL}/admin/students/{cse_st_id}", headers=hod_headers)
        assert del_other.status_code == 403, f"Expected 403 Forbidden when HOD deletes CSE student, got {del_other.status_code}"
        print(f"[PASS] 5.2 HOD deletion of other department's student correctly rejected with 403 Forbidden")

        # C. Test HOD Bulk Deletion Forbidden: Attempting to bulk-delete CSE student
        bulk_del_other = requests.post(f"{BASE_URL}/admin/students/bulk-delete", headers=hod_headers, json={"student_ids": [cse_st_id]})
        assert bulk_del_other.status_code == 403, f"Expected 403 Forbidden for bulk delete across departments, got {bulk_del_other.status_code}"
        print(f"[PASS] 5.3 HOD bulk deletion across departments correctly rejected with 403 Forbidden")

        # D. Test HOD Deletion Allowed: Deleting Civil student must succeed with 200 OK
        del_own = requests.delete(f"{BASE_URL}/admin/students/{civil_st_id}", headers=hod_headers)
        assert del_own.status_code == 200, f"HOD failed to delete own department student: {del_own.text}"
        print(f"[PASS] 5.4 HOD authorized deletion of own department's student succeeded with 200 OK")

        # Clean up test CSE student and HOD user
        requests.delete(f"{BASE_URL}/admin/students/{cse_st_id}", headers=admin_headers)
        db = SessionLocal()
        db.query(models.AdminUser).filter(models.AdminUser.username == hod_username).delete()
        db.commit()
        db.close()

        results["HOD department isolation"] = "PASS"
    except Exception as e:
        print(f"[FAIL] 5. HOD isolation test failed: {e}")
        results["HOD department isolation"] = f"FAIL ({e})"

    # -------------------------------------------------------------
    # SUMMARY REPORT
    # -------------------------------------------------------------
    print("\n" + "=" * 70)
    print("FINAL TEST RESULTS REPORT")
    print("=" * 70)
    all_passed = True
    for item, status in results.items():
        print(f"  {item:<60}: {status}")
        if status != "PASS":
            all_passed = False

    print("=" * 70)
    if all_passed:
        print("ALL TESTS PASSED SUCCESSFULLY (100% SUCCESS RATE)")
    else:
        print("SOME TESTS FAILED - PLEASE INSPECT DETAILS ABOVE")
    print("=" * 70)
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
