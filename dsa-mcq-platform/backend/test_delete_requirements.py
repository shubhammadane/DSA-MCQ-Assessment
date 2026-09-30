import sys
import requests
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 60)
    print("STARTING TEST SUITE FOR DELETE QUESTION & INTEGRITY")
    print("=" * 60)

    # 1. Health Check
    r = requests.get("http://127.0.0.1:8000/")
    assert r.status_code == 200
    print("[PASS] 1. Backend online: GET /")

    # 2. Admin Login
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] 2. Admin authenticated with JWT")

    # Baseline counts
    all_qs = requests.get(f"{BASE_URL}/admin/questions", headers=headers).json()
    base_total = len(all_qs)
    base_active = len([q for q in all_qs if q["is_active"]])
    base_inactive = len([q for q in all_qs if not q["is_active"]])
    print(f"[INFO] Baseline counts: Total={base_total}, Active={base_active}, Inactive={base_inactive}")

    # TEST CASE A: Delete a question that has NEVER been used -> Permanently removed
    print("\n--- TEST CASE A: Delete unused question ---")
    create_payload = {
        "question_text": "UNUSED_TEST_Q: What is the time complexity of binary search?",
        "option_a": "O(log N)",
        "option_b": "O(N)",
        "option_c": "O(N^2)",
        "option_d": "O(1)",
        "correct_answer": "A",
        "topic": "Algorithms",
        "is_active": True
    }
    create_res = requests.post(f"{BASE_URL}/admin/questions", headers=headers, json=create_payload)
    assert create_res.status_code == 201, f"Failed to create test question: {create_res.text}"
    new_q_id = create_res.json()["id"]
    print(f"[INFO] Created new unused question ID={new_q_id}")

    # Verify counts increased
    qs_after_add = requests.get(f"{BASE_URL}/admin/questions", headers=headers).json()
    assert len(qs_after_add) == base_total + 1
    assert len([q for q in qs_after_add if q["is_active"]]) == base_active + 1

    # Permanently delete this question
    del_res = requests.delete(f"{BASE_URL}/admin/questions/{new_q_id}", headers=headers)
    assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
    assert del_res.json()["id"] == new_q_id
    print(f"[PASS] A. Unused question ID={new_q_id} deleted with 200 OK")

    # Confirm it is 100% permanently removed
    get_res = requests.get(f"{BASE_URL}/admin/questions/{new_q_id}", headers=headers)
    assert get_res.status_code == 404, "Deleted question was still returned!"
    qs_after_del = requests.get(f"{BASE_URL}/admin/questions", headers=headers).json()
    assert len(qs_after_del) == base_total
    assert not any(q["id"] == new_q_id for q in qs_after_del)
    print(f"[PASS] A. Verified question ID={new_q_id} is permanently removed from DB")

    # TEST CASE B: Delete question referenced by existing student attempt -> Safely blocked
    print("\n--- TEST CASE B: Block deletion of referenced question ---")
    # Question 1 is part of initial 50 and referenced by existing attempts
    del_ref_res = requests.delete(f"{BASE_URL}/admin/questions/1", headers=headers)
    assert del_ref_res.status_code == 400, f"Expected 400 for referenced question, got: {del_ref_res.status_code}"
    error_detail = del_ref_res.json().get("detail", "")
    assert "This question cannot be permanently deleted because it is referenced by existing assessment records. Deactivate it instead." in error_detail
    print(f"[PASS] B. Deletion safely blocked: '{error_detail}'")

    # Verify Question 1 is STILL in database
    q1_res = requests.get(f"{BASE_URL}/admin/questions/1", headers=headers)
    assert q1_res.status_code == 200
    assert q1_res.json()["id"] == 1
    print("[PASS] B. Question 1 remains intact in database")

    # TEST CASE C: Deactivate a question
    print("\n--- TEST CASE C: Deactivate question ---")
    deact_res = requests.patch(f"{BASE_URL}/admin/questions/50/status", headers=headers, json={"is_active": False})
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] == False
    
    # Verify counts
    qs_after_deact = requests.get(f"{BASE_URL}/admin/questions", headers=headers).json()
    active_now = len([q for q in qs_after_deact if q["is_active"]])
    inactive_now = len([q for q in qs_after_deact if not q["is_active"]])
    assert active_now == base_active - 1
    assert inactive_now == base_inactive + 1
    print(f"[PASS] C. Deactivation verified: Active={active_now}, Inactive={inactive_now}")

    # TEST CASE D: Reactivate a question
    print("\n--- TEST CASE D: Reactivate question ---")
    react_res = requests.patch(f"{BASE_URL}/admin/questions/50/status", headers=headers, json={"is_active": True})
    assert react_res.status_code == 200
    assert react_res.json()["is_active"] == True
    
    # Verify counts restored
    qs_after_react = requests.get(f"{BASE_URL}/admin/questions", headers=headers).json()
    active_restored = len([q for q in qs_after_react if q["is_active"]])
    inactive_restored = len([q for q in qs_after_react if not q["is_active"]])
    assert active_restored == base_active
    assert inactive_restored == base_inactive
    print(f"[PASS] D. Reactivation verified: Active restored to {active_restored}")

    # TEST CASE G: Verify student history protection
    print("\n--- TEST CASE G: Verify historical student results integrity ---")
    # Check attempt 2 or first attempt in database
    attempts_res = requests.get(f"{BASE_URL}/admin/students", headers=headers)
    assert attempts_res.status_code == 200
    students_list = attempts_res.json()
    assert len(students_list) > 0
    first_attempt_id = students_list[0]["attempt_id"]
    if first_attempt_id:
        res_check = requests.get(f"{BASE_URL}/attempts/{first_attempt_id}/result")
        assert res_check.status_code == 200
        result_data = res_check.json()
        assert "attempt" in result_data and "answers" in result_data
        print(f"[PASS] G. Historical student result for attempt #{first_attempt_id} intact with {len(result_data['answers'])} answers")

    print("\n" + "=" * 60)
    print("ALL DELETE & INTEGRITY TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
