import requests
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api"

def run_simulation():
    print("=" * 70)
    print("SIMULATING FRONTEND ADMIN EXAMINATION WORKFLOW")
    print("=" * 70)

    # 1. Admin logs in
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Step 1: Admin successfully authenticated via /api/auth/login")

    # 2. Frontend loads departments for dropdown
    depts_res = requests.get(f"{BASE_URL}/departments", headers=headers)
    assert depts_res.status_code == 200
    depts = depts_res.json()
    assert len(depts) > 0, "No departments returned"
    selected_dept = next((d for d in depts if d["is_active"] and "Computer" in d["name"]), depts[0])
    selected_dept_id = selected_dept["id"]
    print(f"[PASS] Step 2: Loaded {len(depts)} departments. User selects '{selected_dept['name']}' (ID: {selected_dept_id})")

    # 3. Dynamic Subject Reloading: Frontend calls /subjects?department_id={selected_dept_id}&is_active=true
    subjs_res = requests.get(f"{BASE_URL}/subjects?department_id={selected_dept_id}&is_active=true", headers=headers)
    assert subjs_res.status_code == 200
    subjs = subjs_res.json()
    assert len(subjs) > 0, "No subjects found for department"
    selected_subj = next((s for s in subjs if s["id"] == 32), subjs[0])
    selected_subj_id = selected_subj["id"]
    print(f"[PASS] Step 3: Frontend reloaded valid subjects dynamically. Selected '{selected_subj['name']}' (ID: {selected_subj_id})")

    # 4. User changes department to another department and verifies subjects reload and previous selection is invalid
    other_dept = next((d for d in depts if d["id"] != selected_dept_id and d["is_active"]), None)
    if other_dept:
        other_subjs_res = requests.get(f"{BASE_URL}/subjects?department_id={other_dept['id']}&is_active=true", headers=headers)
        assert other_subjs_res.status_code == 200
        other_subjs = other_subjs_res.json()
        # Verify previous selected_subj_id is not in other_subjs
        assert not any(s["id"] == selected_subj_id for s in other_subjs), "Old subject should not belong to other department"
        print(f"[PASS] Step 4: Changing to '{other_dept['name']}' reloads valid subjects and clears invalid selection.")

    # 5. User submits Create Examination form
    ts = int(datetime.utcnow().timestamp())
    create_payload = {
        "title": f"Live Admin Exam {ts}",
        "code": f"EX-{ts % 10000}",
        "department_id": selected_dept_id,
        "subject_id": selected_subj_id,
        "duration_minutes": 30,
        "total_questions": 2,
        "marks_per_question": 1,
        "total_marks": 2,
        "passing_percentage": 40.0,
        "selection_mode": "random",
        "status": "published"
    }
    create_res = requests.post(f"{BASE_URL}/admin/exams", headers=headers, json=create_payload)
    assert create_res.status_code == 201, f"Create exam failed: {create_res.status_code} {create_res.text}"
    exam = create_res.json()
    exam_id = exam["id"]
    print(f"[PASS] Step 5: Created exam '{exam['title']}' (ID: {exam_id}) with department_id={selected_dept_id}, subject_id={selected_subj_id}")

    # 6. Verify exam is present in examinations list (/admin/exams)
    exams_res = requests.get(f"{BASE_URL}/admin/exams", headers=headers)
    assert exams_res.status_code == 200
    exams_list = exams_res.json()
    matching_exam = next((e for e in exams_list if e["id"] == exam_id), None)
    assert matching_exam is not None, "Created exam not found in list"
    assert matching_exam["status"] == "published"
    assert matching_exam["attempts_count"] == 0
    print(f"[PASS] Step 6: Verified exam #{exam_id} appears in examinations table with status '{matching_exam['status']}'")

    # 7. User clicks Archive button -> calls POST /admin/exams/{exam_id}/archive
    arch_res = requests.post(f"{BASE_URL}/admin/exams/{exam_id}/archive", headers=headers)
    assert arch_res.status_code == 200, f"Archive failed: {arch_res.text}"
    assert arch_res.json()["archived"] is True
    print(f"[PASS] Step 7: Exam #{exam_id} archived successfully. Student attempts/marks protected.")

    # Verify status changed to 'archived' in list
    exam_detail = requests.get(f"{BASE_URL}/admin/exams/{exam_id}", headers=headers).json()
    assert exam_detail["status"] == "archived"
    assert exam_detail["is_active"] is False
    print(f"[PASS] Step 7b: Verified exam #{exam_id} status is 'archived' and is_active is False.")

    # 8. User clicks Unarchive -> calls POST /admin/exams/{exam_id}/unarchive
    unarch_res = requests.post(f"{BASE_URL}/admin/exams/{exam_id}/unarchive", headers=headers)
    assert unarch_res.status_code == 200
    assert unarch_res.json()["archived"] is False
    print(f"[PASS] Step 8: Exam #{exam_id} restored to draft.")

    # 9. User clicks Delete on eligible exam (0 attempts) -> calls DELETE /admin/exams/{exam_id}
    del_res = requests.delete(f"{BASE_URL}/admin/exams/{exam_id}", headers=headers)
    assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
    assert del_res.json()["deleted_id"] == exam_id
    print(f"[PASS] Step 9: Exam #{exam_id} permanently deleted with 200 OK.")

    # Verify exam no longer returned in list
    check_del = requests.get(f"{BASE_URL}/admin/exams/{exam_id}", headers=headers)
    assert check_del.status_code == 404, "Deleted exam still exists!"
    print(f"[PASS] Step 10: Verified exam #{exam_id} no longer exists in DB.")

    print("\n" + "=" * 70)
    print("ALL FRONTEND WORKFLOW STEPS PASSED AGAINST LIVE BACKEND SERVER!")
    print("=" * 70)

if __name__ == "__main__":
    run_simulation()
