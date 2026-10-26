import json
import math
import os
import threading
import time
import random
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pytest
from sqlalchemy import func

from app import models
from test_exam_flow import seed_exam, headers


@pytest.mark.postgres
def test_80_students_over_real_http(live_client, database):
    exam, students, code, _ = seed_exam(live_client, database, students=80, count=50, questions=100)
    stages = defaultdict(list)
    lock = threading.Lock()
    start_barrier = threading.Barrier(80)
    submit_barrier = threading.Barrier(80)
    started = time.perf_counter()
    transient_retries = []

    def request(stage, method, path, **kwargs):
        before = time.perf_counter()
        import httpx
        for retry in range(4):
            try:
                response = live_client.request(method, path, **kwargs)
                retryable = response.status_code in (502, 503, 504) and stage not in ("login",)
                if not retryable or retry == 3:
                    break
            except httpx.TransportError:
                if retry == 3 or stage == "login":
                    raise
            with lock:
                transient_retries.append(stage)
            time.sleep(min(4, .4 * 2 ** retry) + random.random() * .2)
        with lock:
            stages[stage].append(time.perf_counter() - before)
        assert response.status_code == 200, f"{stage}: {response.status_code} {response.text}"
        return response.json()

    def sitting(index, student_id):
        login = request("login", "POST", "/api/student/login", json={"enrollment_no": f"TEST{index:04}", "password": "StudentTestPassword!"})
        auth = {"Authorization": "Bearer " + login["access_token"]}
        request("dashboard", "GET", "/api/student/exams", headers=auth)
        start_barrier.wait(timeout=45)
        attempt = request("start", "POST", f"/api/student/exams/{exam['id']}/start", headers=auth, json={"session_code": code})["attempt_id"]
        questions = request("questions", "GET", f"/api/questions?attempt_id={attempt}", headers=auth)
        assert len(questions) == 50 and all("correct_answer" not in row for row in questions)
        for offset in range(0, 50, 10):
            response = request("autosave", "POST", f"/api/attempts/{attempt}/answers", headers=auth, json={"answers": [{"question_number": n, "selected_answer": "A"} for n in range(offset + 1, offset + 11)]})
            assert response["updated_count"] == 10
        snapshot = request("status", "GET", f"/api/attempts/{attempt}/status", headers=auth)
        assert len(snapshot["answers"]) == 50 and all(value == "A" for value in snapshot["answers"].values())
        submit_barrier.wait(timeout=45)
        result = request("submit", "POST", f"/api/attempts/{attempt}/submit", headers=auth, json={"answers": [{"question_number": n, "selected_answer": "A"} for n in range(1, 51)]})
        assert result["attempt"]["status"] == "completed"
        assert result["attempt"]["score"] == result["maximum_score"] == 100
        assert result["answers"] == []
        return attempt

    def guarded_sitting(index, student):
        try:
            return sitting(index, student)
        except Exception:
            start_barrier.abort()
            submit_barrier.abort()
            raise

    attempts, errors = [], []
    with ThreadPoolExecutor(max_workers=80) as pool:
        futures = [pool.submit(guarded_sitting, index, student) for index, student in enumerate(students)]
        for future in as_completed(futures, timeout=300):
            try:
                attempts.append(future.result())
            except Exception as error:
                errors.append(error)
    substantive = [repr(error) for error in errors if not isinstance(error, threading.BrokenBarrierError)]
    assert not errors, substantive or [repr(error) for error in errors]
    assert len(set(attempts)) == 80
    with database() as db:
        assert db.query(models.Attempt).count() == 80
        assert db.query(models.StudentAnswer).count() == 4000
        assert db.query(models.Attempt).filter(models.Attempt.score != 100).count() == 0
    hosted = database.kw["bind"].url.host.endswith(".pooler.supabase.com")
    report = {"students": 80, "questions_per_student": 50, "transport": "real HTTP, one local Uvicorn worker, " + ("Supabase PostgreSQL transaction pooler" if hosted else "local PostgreSQL"),
              "database_connection_limit_per_worker": 10, "requests": sum(map(len, stages.values())) + len(transient_retries),
              "transient_retries": len(transient_retries),
              "elapsed_seconds": round(time.perf_counter() - started, 3), "failed_requests": 0,
              "stages": {name: {"count": len(values), "p95_ms": round(sorted(values)[math.ceil(len(values) * .95) - 1] * 1000, 2), "max_ms": round(max(values) * 1000, 2)} for name, values in stages.items()}}
    print("\n80-STUDENT LOAD TEST " + json.dumps(report, sort_keys=True))
    if os.getenv("LOAD_TEST_REPORT"):
        Path(os.environ["LOAD_TEST_REPORT"]).write_text(json.dumps(report, indent=2) + "\n")


@pytest.mark.postgres
def test_duplicate_starts_and_concurrent_submission(live_client, database):
    exam, students, code, _ = seed_exam(live_client, database)
    auth = headers(students[0])
    barrier = threading.Barrier(12)
    def start(_):
        barrier.wait(timeout=15)
        response = live_client.post(f"/api/student/exams/{exam['id']}/start", json={"session_code": code}, headers=auth)
        assert response.status_code == 200, response.text
        return response.json()["attempt_id"]
    with ThreadPoolExecutor(max_workers=12) as pool:
        attempt_ids = list(pool.map(start, range(12)))
    assert len(set(attempt_ids)) == 1
    attempt = attempt_ids[0]
    barrier = threading.Barrier(12)
    def submit(_):
        barrier.wait(timeout=15)
        response = live_client.post(f"/api/attempts/{attempt}/submit", json={"answers": [{"question_number": i, "selected_answer": "A"} for i in (1, 2, 3)]}, headers=auth)
        assert response.status_code == 200, response.text
        assert response.json()["attempt"]["score"] == 6
    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(submit, range(12)))
    with database() as db:
        assert db.query(func.count(models.Attempt.id)).scalar() == 1
        assert db.query(func.count(models.StudentAnswer.id)).scalar() == 3
