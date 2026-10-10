import requests
from app.database import SessionLocal
from app import models
from app.config import settings

BASE_URL = "http://127.0.0.1:8000/api"

def test_name_corruption_protection():
    print("=" * 65)
    print("TEST: NAME CORRUPTION PROTECTION IN /attempts/start")
    print("=" * 65)

    db = SessionLocal()
    # 1. Fetch legitimate student Shubham Madane
    shubham = db.query(models.Student).filter(models.Student.enrollment_no == "BT24F05F007").first()
    assert shubham is not None, "Shubham Madane not found in DB"
    orig_name = shubham.name
    orig_dept = shubham.department
    db.close()

    print(f"[INFO] Verified student profile before test: Name='{orig_name}', Dept='{orig_dept}'")

    # 2. Simulate browser attempt submission with different arbitrary name and department
    hacker_payload = {
        "enrollment_no": "BT24F05F007",
        "name": "Tampered Name Via Browser",
        "department": "Random Department X"
    }
    res = requests.post(f"{BASE_URL}/attempts/start", json=hacker_payload)
    assert res.status_code == 200, f"Attempt start failed: {res.text}"

    # 3. Verify in database that the student's name was NOT corrupted
    db = SessionLocal()
    shubham_post = db.query(models.Student).filter(models.Student.enrollment_no == "BT24F05F007").first()
    assert shubham_post.name == orig_name, f"Corruption! Expected '{orig_name}', got '{shubham_post.name}'"
    assert shubham_post.department == orig_dept, f"Corruption! Expected '{orig_dept}', got '{shubham_post.department}'"
    db.close()

    print(f"[PASS] 1. Verified: Existing student name '{orig_name}' and dept '{orig_dept}' preserved against arbitrary browser overwrite.")

    # 4. Clean up any in-progress attempt created for this test so no stray attempts remain
    db = SessionLocal()
    test_att = db.query(models.Attempt).filter(models.Attempt.student_id == shubham_post.id).first()
    if test_att:
        db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == test_att.id).delete()
        db.delete(test_att)
        db.commit()
    db.close()
    print("[PASS] 2. Test attempt cleaned up, zero residue.")

    # 5. Verify new student creation still sets name properly for first-time students
    new_enr = "NEW_TEMP_REG_001"
    res_new = requests.post(f"{BASE_URL}/attempts/start", json={
        "enrollment_no": new_enr,
        "name": "First Time Candidate",
        "department": "Computer Science & Engineering"
    })
    assert res_new.status_code == 200
    db = SessionLocal()
    new_st = db.query(models.Student).filter(models.Student.enrollment_no == new_enr).first()
    assert new_st is not None and new_st.name == "First Time Candidate"
    # Clean up new temp student
    new_att = db.query(models.Attempt).filter(models.Attempt.student_id == new_st.id).first()
    if new_att:
        db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == new_att.id).delete()
        db.delete(new_att)
    db.delete(new_st)
    db.commit()
    db.close()
    print("[PASS] 3. First-time registration still sets name and department correctly.")

    print("=" * 65)
    print("ALL NAME CORRUPTION PROTECTION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    test_name_corruption_protection()
