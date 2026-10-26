from datetime import datetime, timedelta

import pytest
from sqlalchemy import event

from app import models
from app.auth import create_access_token, hash_password


def seed_exam(client, database, *, count=3, mode="random", students=2, questions=3):
    with database() as db:
        department = models.Department(name="Computing", code="CSE")
        db.add(department)
        db.flush()
        subject = models.Subject(name="Data Structures", code="DSA", department_id=department.id)
        db.add(subject)
        db.flush()
        bank = [models.Question(question_text=f"Question {i}", option_a="Correct", option_b="Wrong B", option_c="Wrong C", option_d="Wrong D", correct_answer="A", department_id=department.id, subject_id=subject.id, marks=7) for i in range(questions)]
        db.add_all(bank)
        # Hash once; login still verifies the real password for every user.
        password_hash = hash_password("StudentTestPassword!")
        people = [models.Student(enrollment_no=f"TEST{i:04}", name=f"Student {i}", department="Computing", department_id=department.id, password_hash=password_hash) for i in range(students)]
        db.add_all(people)
        db.commit()
        student_ids = [person.id for person in people]
        question_ids = [question.id for question in bank]
        body = dict(title="Concurrent DSA assessment", department_id=department.id, subject_id=subject.id,
                    total_questions=count, duration_minutes=60, marks_per_question=2, status="published", selection_mode=mode)
        if mode == "manual":
            body["selected_question_ids"] = question_ids[:count]
    response = client.post("/api/admin/exams", json=body)
    assert response.status_code == 201, response.text
    exam = response.json()
    assigned = client.post(f"/api/admin/exams/{exam['id']}/assign", json={"student_ids": student_ids})
    assert assigned.status_code == 200, assigned.text
    response = client.post(f"/api/admin/exams/{exam['id']}/session-code")
    assert response.status_code == 200, response.text
    return exam, student_ids, response.json()["session_code"], question_ids


def headers(student_id):
    return {"Authorization": "Bearer " + create_access_token({"sub": str(student_id), "role": "student"})}


def start(client, exam, student, code):
    response = client.post(f"/api/student/exams/{exam['id']}/start", json={"session_code": code}, headers=headers(student))
    assert response.status_code == 200, response.text
    return response.json()["attempt_id"]


@pytest.mark.parametrize("mode", ["random", "manual"])
def test_complete_exam_saves_snapshots_and_final_answers(client, database, mode):
    exam, students, code, _ = seed_exam(client, database, mode=mode)
    attempt = start(client, exam, students[0], code)
    assert start(client, exam, students[0], code) == attempt
    auth = headers(students[0])
    assert client.get(f"/api/attempts/{attempt}/result", headers=auth).status_code == 409
    assert client.post(f"/api/attempts/{attempt}/answers", json={"question_number": 1, "selected_answer": "A"}, headers=auth).status_code == 422
    saved = client.post(f"/api/attempts/{attempt}/answers", json={"answers": [{"question_number": 1, "selected_answer": "B"}]}, headers=auth)
    assert saved.status_code == 200
    assert client.get(f"/api/attempts/{attempt}/status", headers=auth).json()["answers"]["1"] == "B"
    response = client.post(f"/api/attempts/{attempt}/submit", json={"answers": [{"question_number": i, "selected_answer": "A"} for i in (1, 2, 3)]}, headers=auth)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["attempt"]["score"] == 6  # exam marks, not question bank's 7 marks
    assert result["maximum_score"] == exam["total_marks"] == 6
    assert result["attempt"]["percentage"] == 100
    assert result["answers"] == [] and result["review_available"] is False
    assert client.post(f"/api/attempts/{attempt}/submit", headers=auth).json()["attempt"]["score"] == 6
    assert client.post(f"/api/attempts/{attempt}/answers", json={"answers": []}, headers=auth).status_code == 400
    assert client.post(f"/api/student/exams/{exam['id']}/start", json={"session_code": code}, headers=auth).status_code == 400
    client.patch(f"/api/admin/exams/{exam['id']}/status?status_name=closed", json={"is_active": True})
    review = client.get(f"/api/attempts/{attempt}/result", headers=auth).json()
    assert review["review_available"] and len(review["answers"]) == 3


def test_exam_editing_assignments_and_status(client, database):
    exam, students, _, question_ids = seed_exam(client, database, mode="manual")
    response = client.get(f"/api/admin/exams/{exam['id']}")
    assert response.json()["selected_question_ids"] == question_ids
    updated = client.put(f"/api/admin/exams/{exam['id']}", json={"title": "Updated exam", "code": "DSA-2", "total_questions": 3, "start_date": None, "end_date": None})
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Updated exam" and updated.json()["code"] == "DSA-2"
    response = client.post(f"/api/admin/exams/{exam['id']}/assign", json={"student_ids": students[:1], "replace": True})
    assert response.json()["total_assigned"] == 1
    assert client.get("/api/student/exams", headers=headers(students[1])).json() == []
    assert client.patch(f"/api/admin/exams/{exam['id']}/status?status_name=bogus", json={"is_active": True}).status_code == 400
    assert len(client.get("/api/admin/exams?status=published").json()) == 1


def test_authorization_rotation_and_timeout(client, database):
    exam, students, code, _ = seed_exam(client, database)
    old_code = code
    code = client.post(f"/api/admin/exams/{exam['id']}/session-code").json()["session_code"]
    assert client.post(f"/api/student/exams/{exam['id']}/start", json={"session_code": old_code}, headers=headers(students[0])).status_code == 403
    attempt = start(client, exam, students[0], code)
    for suffix in ("status", "result"):
        assert client.get(f"/api/attempts/{attempt}/{suffix}", headers=headers(students[1])).status_code == 404
    assert client.put(f"/api/admin/exams/{exam['id']}", json={"duration_minutes": 90}).status_code == 409
    assert client.post(f"/api/admin/exams/{exam['id']}/assign", json={"student_ids": [], "replace": True}).status_code == 409
    with database() as db:
        row = db.get(models.Attempt, attempt)
        row.deadline_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    response = client.post(f"/api/attempts/{attempt}/submit", json={"answers": [{"question_number": 1, "selected_answer": "A"}]}, headers=headers(students[0]))
    assert response.json()["attempt"]["status"] == "timed_out"
    assert response.json()["attempt"]["score"] == 0


def test_batch_validation_is_atomic(client, database):
    exam, students, code, _ = seed_exam(client, database)
    attempt = start(client, exam, students[0], code)
    response = client.post(f"/api/attempts/{attempt}/answers", headers=headers(students[0]), json={"answers": [{"question_number": 1, "selected_answer": "A"}, {"question_number": 99, "selected_answer": "A"}]})
    assert response.status_code == 400
    assert client.get(f"/api/attempts/{attempt}/status", headers=headers(students[0])).json()["answers"]["1"] is None


def test_exam_list_uses_constant_queries(client, database):
    seed_exam(client, database)
    statements = []
    engine = database.kw["bind"]
    def record(*args):
        statements.append(args[2])
    event.listen(engine, "before_cursor_execute", record)
    try:
        assert client.get("/api/admin/exams").status_code == 200
    finally:
        event.remove(engine, "before_cursor_execute", record)
    assert len(statements) == 1
