from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import io
import csv
import openpyxl

from app.database import get_db
from app import models, schemas
from app.config import settings
from app.auth import create_access_token, get_current_admin, verify_token
from app.questions_data import FIXED_QUESTIONS, QUESTIONS_BY_ID
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api")

# Helper to get or initialize assessment settings
def get_or_create_settings(db: Session) -> models.AssessmentSetting:
    setting = db.query(models.AssessmentSetting).first()
    if not setting:
        setting = models.AssessmentSetting(
            question_count=50,
            time_limit_minutes=60,
            updated_at=datetime.utcnow()
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting

# 1. Auth Endpoint
@router.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.AdminLogin):
    if credentials.username == settings.ADMIN_USERNAME and credentials.password == settings.ADMIN_PASSWORD:
        access_token = create_access_token(data={"sub": credentials.username})
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect admin username or password"
    )

# 2. Get questions for assessment or general view
@router.get("/questions", response_model=List[schemas.QuestionOut])
def get_questions(attempt_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    # If attempt_id is provided, load the exact question snapshot for that student's attempt
    if attempt_id:
        attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")
        
        student_answers = db.query(models.StudentAnswer).filter(
            models.StudentAnswer.attempt_id == attempt_id
        ).order_by(models.StudentAnswer.question_number.asc()).all()

        sanitized = []
        for sa in student_answers:
            # Use snapshot options if available, else fallback
            opts = {
                "A": sa.option_a or "",
                "B": sa.option_b or "",
                "C": sa.option_c or "",
                "D": sa.option_d or ""
            }
            # Fallback for legacy attempts if options snapshot wasn't present
            if not any(opts.values()) and sa.question_number in QUESTIONS_BY_ID:
                opts = QUESTIONS_BY_ID[sa.question_number].get("options", {})

            q_text = sa.question_text
            if not q_text and sa.question_number in QUESTIONS_BY_ID:
                q_text = QUESTIONS_BY_ID[sa.question_number].get("question", "")

            sanitized.append({
                "id": sa.question_number,
                "question": q_text or f"Question {sa.question_number}",
                "options": opts
            })
        return sanitized

    # If no attempt_id is specified (e.g. initial view before attempt starts):
    # Retrieve current configured number of active questions from DB
    asst_setting = get_or_create_settings(db)
    target_count = asst_setting.question_count

    active_questions = db.query(models.Question).filter(
        models.Question.is_active == True
    ).order_by(models.Question.id.asc()).limit(target_count).all()

    if active_questions:
        sanitized = []
        for q in active_questions:
            sanitized.append({
                "id": q.id,
                "question": q.question_text,
                "options": {
                    "A": q.option_a,
                    "B": q.option_b,
                    "C": q.option_c,
                    "D": q.option_d
                }
            })
        return sanitized

    # Fallback to FIXED_QUESTIONS if table is empty
    sanitized = []
    for q in FIXED_QUESTIONS[:target_count]:
        sanitized.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"]
        })
    return sanitized

# 3. Create or Register Student
@router.post("/students", response_model=schemas.StudentOut)
def create_student(student_data: schemas.StudentCreate, db: Session = Depends(get_db)):
    enrollment = student_data.enrollment_no.strip()
    name = student_data.name.strip()
    dept = student_data.department.strip()

    if not enrollment or not name or not dept:
        raise HTTPException(status_code=400, detail="All fields (Enrollment No, Name, Department) are required.")

    student = db.query(models.Student).filter(models.Student.enrollment_no == enrollment).first()
    if not student:
        student = models.Student(enrollment_no=enrollment, name=name, department=dept)
        db.add(student)
        db.commit()
        db.refresh(student)
    else:
        student.name = name
        student.department = dept
        db.commit()
        db.refresh(student)

    return student

# 4. Start Attempt with Assessment Settings & Snapshot
@router.post("/attempts/start", response_model=schemas.StartAttemptResponse)
def start_attempt(student_data: schemas.StudentCreate, db: Session = Depends(get_db)):
    enrollment = student_data.enrollment_no.strip()
    name = student_data.name.strip()
    dept = student_data.department.strip()

    if not enrollment or not name or not dept:
        raise HTTPException(status_code=400, detail="All fields (Enrollment No, Name, Department) are required.")

    student = db.query(models.Student).filter(models.Student.enrollment_no == enrollment).first()
    if not student:
        student = models.Student(
            enrollment_no=enrollment,
            name=name,
            department=dept
        )
        db.add(student)
        db.commit()
        db.refresh(student)
    else:
        student.name = name
        student.department = dept
        db.commit()
        db.refresh(student)

    # Check for existing completed or timed_out attempt
    completed_attempt = db.query(models.Attempt).filter(
        models.Attempt.student_id == student.id,
        models.Attempt.status.in_(["completed", "timed_out"])
    ).first()

    if completed_attempt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already completed this assessment."
        )

    # Check for in-progress attempt
    in_progress = db.query(models.Attempt).filter(
        models.Attempt.student_id == student.id,
        models.Attempt.status == "in_progress"
    ).first()

    now = datetime.utcnow()

    if in_progress:
        # Check if in-progress attempt deadline has already passed
        if in_progress.deadline_at and now > in_progress.deadline_at:
            # Auto-finalize expired attempt
            finalize_attempt_as_timed_out(in_progress, db)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your assessment time has expired."
            )

        return {
            "attempt_id": in_progress.id,
            "student": student,
            "message": "Resuming existing in-progress test.",
            "deadline_at": in_progress.deadline_at,
            "time_limit_minutes": in_progress.time_limit_minutes or 60,
            "total_questions": in_progress.total_questions or 50
        }

    # NEW ATTEMPT: Fetch current assessment settings
    setting = get_or_create_settings(db)
    target_question_count = setting.question_count
    time_limit_minutes = setting.time_limit_minutes

    # Fetch active questions
    active_questions = db.query(models.Question).filter(
        models.Question.is_active == True
    ).order_by(models.Question.id.asc()).limit(target_question_count).all()

    if len(active_questions) < target_question_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient active questions in bank. Required: {target_question_count}, Available: {len(active_questions)}. Please contact the administrator."
        )

    deadline = now + timedelta(minutes=time_limit_minutes)

    new_attempt = models.Attempt(
        student_id=student.id,
        total_questions=target_question_count,
        question_count_snapshot=target_question_count,
        time_limit_minutes=time_limit_minutes,
        status="in_progress",
        started_at=now,
        deadline_at=deadline
    )
    db.add(new_attempt)
    db.flush()

    # Snapshot questions into student_answers for this attempt to guarantee historical immutability
    for idx, q in enumerate(active_questions, start=1):
        sa = models.StudentAnswer(
            attempt_id=new_attempt.id,
            question_number=idx,
            question_id=q.id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            correct_answer=q.correct_answer,
            selected_answer=None,
            is_correct=False,
            answered_at=now
        )
        db.add(sa)

    db.commit()
    db.refresh(new_attempt)

    return {
        "attempt_id": new_attempt.id,
        "student": student,
        "message": "Test started successfully.",
        "deadline_at": new_attempt.deadline_at,
        "time_limit_minutes": new_attempt.time_limit_minutes,
        "total_questions": new_attempt.total_questions
    }

# Helper to finalize attempt as timed_out
def finalize_attempt_as_timed_out(attempt: models.Attempt, db: Session):
    student_answers = db.query(models.StudentAnswer).filter(
        models.StudentAnswer.attempt_id == attempt.id
    ).all()

    correct_count = 0
    wrong_count = 0

    for sa in student_answers:
        if sa.selected_answer and sa.selected_answer.upper() == sa.correct_answer.upper():
            sa.is_correct = True
            correct_count += 1
        else:
            sa.is_correct = False
            wrong_count += 1

    total_q = attempt.total_questions or len(student_answers) or 50
    pct = round((correct_count / total_q) * 100, 2) if total_q > 0 else 0.0

    attempt.score = correct_count
    attempt.percentage = pct
    attempt.correct_answers = correct_count
    attempt.wrong_answers = wrong_count
    attempt.submitted_at = datetime.utcnow()
    attempt.completed_at = attempt.deadline_at or datetime.utcnow()
    attempt.status = "timed_out"

    db.commit()
    db.refresh(attempt)
    return attempt

# 5. Get Attempt Status (Timer, sync, and refresh recovery)
@router.get("/attempts/{attempt_id}/status", response_model=schemas.AttemptStatusResponse)
def get_attempt_status(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    now = datetime.utcnow()

    # Check for server-side deadline expiration
    if attempt.status == "in_progress" and attempt.deadline_at and now > attempt.deadline_at:
        finalize_attempt_as_timed_out(attempt, db)

    rem_seconds = 0
    if attempt.status == "in_progress" and attempt.deadline_at:
        diff = (attempt.deadline_at - now).total_seconds()
        rem_seconds = max(0, int(diff))

    # Fetch currently recorded answers
    student_answers = db.query(models.StudentAnswer).filter(
        models.StudentAnswer.attempt_id == attempt_id
    ).all()
    answers_map = {sa.question_number: sa.selected_answer for sa in student_answers}

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "started_at": attempt.started_at,
        "deadline_at": attempt.deadline_at,
        "completed_at": attempt.completed_at,
        "time_limit_minutes": attempt.time_limit_minutes or 60,
        "total_questions": attempt.total_questions or 50,
        "remaining_seconds": rem_seconds,
        "current_server_time": now,
        "answers": answers_map
    }

# 6. Save student answers incrementally with deadline protection
@router.post("/attempts/{attempt_id}/answers")
def save_answers(attempt_id: int, request: schemas.BatchAnswersRequest, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    if attempt.status in ["completed", "timed_out"]:
        raise HTTPException(status_code=400, detail="Assessment has already been completed or timed out.")

    now = datetime.utcnow()

    # Check server-side deadline
    if attempt.deadline_at and now > attempt.deadline_at:
        finalize_attempt_as_timed_out(attempt, db)
        raise HTTPException(
            status_code=400,
            detail="Assessment deadline has expired. Your answers up to the deadline have been automatically recorded."
        )

    for ans in request.answers:
        q_num = ans.question_number
        selected = ans.selected_answer.upper().strip() if ans.selected_answer and ans.selected_answer.strip() else None

        existing = db.query(models.StudentAnswer).filter(
            models.StudentAnswer.attempt_id == attempt_id,
            models.StudentAnswer.question_number == q_num
        ).first()

        if existing:
            existing.selected_answer = selected
            existing.is_correct = (selected == existing.correct_answer.upper()) if selected else False
            existing.answered_at = now
        else:
            # If for any reason the row was not pre-seeded, fallback to Question or QUESTIONS_BY_ID
            corr_ans = "A"
            q_text = None
            opt_a, opt_b, opt_c, opt_d = "", "", "", ""

            db_q = db.query(models.Question).filter(models.Question.id == q_num).first()
            if db_q:
                corr_ans = db_q.correct_answer
                q_text = db_q.question_text
                opt_a, opt_b, opt_c, opt_d = db_q.option_a, db_q.option_b, db_q.option_c, db_q.option_d
            elif q_num in QUESTIONS_BY_ID:
                corr_ans = QUESTIONS_BY_ID[q_num]["correct_answer"]
                q_text = QUESTIONS_BY_ID[q_num].get("question", "")
                opts = QUESTIONS_BY_ID[q_num].get("options", {})
                opt_a, opt_b, opt_c, opt_d = opts.get("A", ""), opts.get("B", ""), opts.get("C", ""), opts.get("D", "")

            new_ans = models.StudentAnswer(
                attempt_id=attempt_id,
                question_number=q_num,
                question_id=db_q.id if db_q else None,
                question_text=q_text,
                option_a=opt_a,
                option_b=opt_b,
                option_c=opt_c,
                option_d=opt_d,
                selected_answer=selected,
                correct_answer=corr_ans,
                is_correct=(selected == corr_ans.upper()) if selected else False,
                answered_at=now
            )
            db.add(new_ans)

    db.commit()
    return {"message": "Answers saved successfully"}

# 7. Submit Test (manual or auto-submit)
@router.post("/attempts/{attempt_id}/submit", response_model=schemas.TestResultOut)
def submit_test(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    if attempt.status in ["completed", "timed_out"]:
        return get_test_result(attempt_id, db)

    now = datetime.utcnow()
    is_timed_out = bool(attempt.deadline_at and now > attempt.deadline_at)

    student_answers = db.query(models.StudentAnswer).filter(
        models.StudentAnswer.attempt_id == attempt_id
    ).all()

    # If no student_answers pre-seeded (legacy case), generate for 1..total_questions
    if not student_answers:
        for q_num in range(1, (attempt.total_questions or 50) + 1):
            corr = "A"
            q_info = QUESTIONS_BY_ID.get(q_num)
            if q_info:
                corr = q_info["correct_answer"]
            sa = models.StudentAnswer(
                attempt_id=attempt_id,
                question_number=q_num,
                selected_answer=None,
                correct_answer=corr,
                is_correct=False,
                answered_at=now
            )
            db.add(sa)
        db.flush()
        student_answers = db.query(models.StudentAnswer).filter(
            models.StudentAnswer.attempt_id == attempt_id
        ).all()

    correct_count = 0
    wrong_count = 0

    for sa in student_answers:
        if sa.selected_answer and sa.selected_answer.upper() == sa.correct_answer.upper():
            sa.is_correct = True
            correct_count += 1
        else:
            sa.is_correct = False
            wrong_count += 1

    total_q = attempt.total_questions or len(student_answers) or 50
    pct = round((correct_count / total_q) * 100, 2) if total_q > 0 else 0.0

    attempt.score = correct_count
    attempt.percentage = pct
    attempt.correct_answers = correct_count
    attempt.wrong_answers = wrong_count
    attempt.submitted_at = now
    attempt.completed_at = attempt.deadline_at if is_timed_out else now
    attempt.status = "timed_out" if is_timed_out else "completed"

    db.commit()
    db.refresh(attempt)

    return get_test_result(attempt_id, db)

# 8. Get Result Page details with Historical Snapshot Protection
@router.get("/attempts/{attempt_id}/result", response_model=schemas.TestResultOut)
def get_test_result(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    student = db.query(models.Student).filter(models.Student.id == attempt.student_id).first()
    student_answers = db.query(models.StudentAnswer).filter(
        models.StudentAnswer.attempt_id == attempt_id
    ).order_by(models.StudentAnswer.question_number.asc()).all()

    answers_out = []
    for sa in student_answers:
        # Prioritize snapshot saved during the test attempt
        q_text = sa.question_text
        opts = {
            "A": sa.option_a or "",
            "B": sa.option_b or "",
            "C": sa.option_c or "",
            "D": sa.option_d or ""
        }

        # Fallback to question table or fixed questions for historical integrity
        if not q_text or not any(opts.values()):
            if sa.question_id:
                db_q = db.query(models.Question).filter(models.Question.id == sa.question_id).first()
                if db_q:
                    q_text = q_text or db_q.question_text
                    if not any(opts.values()):
                        opts = {"A": db_q.option_a, "B": db_q.option_b, "C": db_q.option_c, "D": db_q.option_d}
            if not q_text and sa.question_number in QUESTIONS_BY_ID:
                legacy_q = QUESTIONS_BY_ID[sa.question_number]
                q_text = legacy_q.get("question", f"Question {sa.question_number}")
                if not any(opts.values()):
                    opts = legacy_q.get("options", {})

        answers_out.append({
            "question_number": sa.question_number,
            "question": q_text or f"Question {sa.question_number}",
            "options": opts,
            "selected_answer": sa.selected_answer,
            "correct_answer": sa.correct_answer,
            "is_correct": sa.is_correct
        })

    return {
        "student": student,
        "attempt": attempt,
        "answers": answers_out
    }

# 9. Admin Dashboard Analytics
@router.get("/admin/dashboard", response_model=schemas.AdminDashboardStats)
def get_admin_dashboard(admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_students = db.query(models.Student).count()
    total_attempts = db.query(models.Attempt).count()
    completed_attempts = db.query(models.Attempt).filter(
        models.Attempt.status.in_(["completed", "timed_out"])
    ).all()
    completed_count = len(completed_attempts)

    avg_score = sum(a.score for a in completed_attempts) / completed_count if completed_count > 0 else 0.0
    avg_pct = sum(a.percentage for a in completed_attempts) / completed_count if completed_count > 0 else 0.0

    return {
        "total_students": total_students,
        "total_attempts": total_attempts,
        "completed_tests": completed_count,
        "average_score": round(avg_score, 2),
        "average_percentage": round(avg_pct, 2)
    }

# 10. Admin List Students
@router.get("/admin/students", response_model=List[schemas.StudentSummary])
def get_admin_students(
    search: Optional[str] = None,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    students = db.query(models.Student).all()

    results = []
    for s in students:
        attempt = db.query(models.Attempt).filter(
            models.Attempt.student_id == s.id,
            models.Attempt.status.in_(["completed", "timed_out"])
        ).order_by(models.Attempt.submitted_at.desc()).first()

        if not attempt:
            # Check for in-progress attempt
            in_prog = db.query(models.Attempt).filter(
                models.Attempt.student_id == s.id,
                models.Attempt.status == "in_progress"
            ).first()
            attempt = in_prog

        summary = {
            "student_id": s.id,
            "enrollment_no": s.enrollment_no,
            "name": s.name,
            "department": s.department,
            "score": attempt.score if attempt and attempt.status != "in_progress" else None,
            "percentage": attempt.percentage if attempt and attempt.status != "in_progress" else None,
            "attempt_date": attempt.submitted_at if attempt else None,
            "status": attempt.status if attempt else "Not Attempted",
            "attempt_id": attempt.id if attempt else None
        }

        if search:
            q = search.strip().lower()
            if q not in s.enrollment_no.lower() and q not in s.name.lower() and q not in s.department.lower():
                continue
        results.append(summary)

    return results

# 11. Admin Student Details
@router.get("/admin/students/{student_id}", response_model=schemas.TestResultOut)
def get_admin_student_details(student_id: int, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    attempt = db.query(models.Attempt).filter(
        models.Attempt.student_id == student_id,
        models.Attempt.status.in_(["completed", "timed_out"])
    ).order_by(models.Attempt.id.desc()).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Student has not completed any attempt.")

    return get_test_result(attempt.id, db)

# 12. Assessment Settings Endpoints (Admin Only)
@router.get("/admin/assessment-settings", response_model=schemas.AssessmentSettingsOut)
def get_assessment_settings(admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    setting = get_or_create_settings(db)
    active_count = db.query(models.Question).filter(models.Question.is_active == True).count()
    total_count = db.query(models.Question).count()

    return {
        "question_count": setting.question_count,
        "time_limit_minutes": setting.time_limit_minutes,
        "active_questions_count": active_count,
        "total_questions_count": total_count,
        "updated_at": setting.updated_at
    }

@router.put("/admin/assessment-settings", response_model=schemas.AssessmentSettingsOut)
def update_assessment_settings(
    settings_in: schemas.AssessmentSettingsUpdate,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if settings_in.question_count <= 0:
        raise HTTPException(status_code=400, detail="Number of questions must be greater than 0.")
    if settings_in.time_limit_minutes <= 0:
        raise HTTPException(status_code=400, detail="Time limit must be greater than 0 minutes.")

    active_count = db.query(models.Question).filter(models.Question.is_active == True).count()
    total_count = db.query(models.Question).count()

    if settings_in.question_count > active_count:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot configure {settings_in.question_count} questions: only {active_count} active questions are currently available."
        )

    setting = get_or_create_settings(db)
    setting.question_count = settings_in.question_count
    setting.time_limit_minutes = settings_in.time_limit_minutes
    setting.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(setting)

    return {
        "question_count": setting.question_count,
        "time_limit_minutes": setting.time_limit_minutes,
        "active_questions_count": active_count,
        "total_questions_count": total_count,
        "updated_at": setting.updated_at
    }

# 13. Question Management Endpoints (Admin Only)
@router.get("/admin/questions", response_model=List[schemas.AdminQuestionOut])
def get_admin_questions(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query("all", alias="status"),
    topic: Optional[str] = None,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(models.Question)

    if status_filter == "active":
        query = query.filter(models.Question.is_active == True)
    elif status_filter == "inactive":
        query = query.filter(models.Question.is_active == False)

    if topic and topic.strip():
        query = query.filter(models.Question.topic.ilike(f"%{topic.strip()}%"))

    if search and search.strip():
        q_clean = f"%{search.strip()}%"
        query = query.filter(
            (models.Question.question_text.ilike(q_clean)) |
            (models.Question.option_a.ilike(q_clean)) |
            (models.Question.option_b.ilike(q_clean)) |
            (models.Question.option_c.ilike(q_clean)) |
            (models.Question.option_d.ilike(q_clean))
        )

    return query.order_by(models.Question.id.asc()).all()

@router.get("/admin/questions/{question_id}", response_model=schemas.AdminQuestionOut)
def get_admin_question(question_id: int, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    return q

@router.post("/admin/questions", response_model=schemas.AdminQuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(question_in: schemas.QuestionCreate, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    q_text = question_in.question_text.strip()
    opt_a = question_in.option_a.strip()
    opt_b = question_in.option_b.strip()
    opt_c = question_in.option_c.strip()
    opt_d = question_in.option_d.strip()
    corr = question_in.correct_answer.strip().upper()

    if not q_text:
        raise HTTPException(status_code=400, detail="Question text is required.")
    if not opt_a or not opt_b or not opt_c or not opt_d:
        raise HTTPException(status_code=400, detail="All four options (A, B, C, D) are required.")
    if corr not in ["A", "B", "C", "D"]:
        raise HTTPException(status_code=400, detail="Correct answer must be one of: A, B, C, D.")

    now = datetime.utcnow()
    new_q = models.Question(
        question_text=q_text,
        option_a=opt_a,
        option_b=opt_b,
        option_c=opt_c,
        option_d=opt_d,
        correct_answer=corr,
        topic=question_in.topic.strip() if question_in.topic else "Data Structures & Algorithms",
        is_active=question_in.is_active,
        created_at=now,
        updated_at=now
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return new_q

@router.put("/admin/questions/{question_id}", response_model=schemas.AdminQuestionOut)
def update_question(
    question_id: int,
    question_in: schemas.QuestionUpdate,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    if question_in.question_text is not None:
        val = question_in.question_text.strip()
        if not val:
            raise HTTPException(status_code=400, detail="Question text cannot be empty.")
        q.question_text = val

    if question_in.option_a is not None:
        val = question_in.option_a.strip()
        if not val:
            raise HTTPException(status_code=400, detail="Option A cannot be empty.")
        q.option_a = val

    if question_in.option_b is not None:
        val = question_in.option_b.strip()
        if not val:
            raise HTTPException(status_code=400, detail="Option B cannot be empty.")
        q.option_b = val

    if question_in.option_c is not None:
        val = question_in.option_c.strip()
        if not val:
            raise HTTPException(status_code=400, detail="Option C cannot be empty.")
        q.option_c = val

    if question_in.option_d is not None:
        val = question_in.option_d.strip()
        if not val:
            raise HTTPException(status_code=400, detail="Option D cannot be empty.")
        q.option_d = val

    if question_in.correct_answer is not None:
        val = question_in.correct_answer.strip().upper()
        if val not in ["A", "B", "C", "D"]:
            raise HTTPException(status_code=400, detail="Correct answer must be one of: A, B, C, D.")
        q.correct_answer = val

    if question_in.topic is not None:
        q.topic = question_in.topic.strip()

    if question_in.is_active is not None:
        q.is_active = question_in.is_active

    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q

@router.patch("/admin/questions/{question_id}/status", response_model=schemas.AdminQuestionOut)
def toggle_question_status(
    question_id: int,
    status_in: schemas.QuestionStatusUpdate,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    q.is_active = status_in.is_active
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q

@router.delete("/admin/questions/{question_id}")
def delete_question(question_id: int, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    # 1. Check if question exists
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    # 2. Database Safety: Check whether question is referenced by any existing student attempt/answer records
    referenced = db.query(models.StudentAnswer).filter(
        (models.StudentAnswer.question_id == question_id) |
        (models.StudentAnswer.question_number == question_id)
    ).first()

    if referenced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This question cannot be permanently deleted because it is referenced by existing assessment records. Deactivate it instead."
        )

    # 3. Safe to permanently delete since no student attempts reference it
    db.delete(q)
    db.commit()
    return {"message": "Question permanently deleted successfully", "id": question_id}

@router.post("/admin/questions/{question_id}/deactivate", response_model=schemas.AdminQuestionOut)
def deactivate_question_endpoint(question_id: int, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    q.is_active = False
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q

# 14. Admin Export Results (Excel)
def get_admin_from_request(token: Optional[str] = None, authorization: Optional[str] = Header(None)) -> str:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ", 1)[1]
    elif token:
        auth_token = token
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_token(auth_token)

@router.get("/admin/export/excel")
def export_excel(
    type: str = "summary",
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    get_admin_from_request(token=token, authorization=authorization)
    wb = openpyxl.Workbook()
    ws = wb.active

    if type == "detailed":
        ws.title = "Detailed Answers Export"
        ws.append(["Enrollment Number", "Name", "Department", "Question Number", "Student Answer", "Correct Answer", "Status"])
        
        answers = db.query(models.StudentAnswer).join(models.Attempt).join(models.Student).all()
        for a in answers:
            attempt = a.attempt
            student = attempt.student
            ws.append([
                student.enrollment_no,
                student.name,
                student.department,
                a.question_number,
                a.selected_answer or "N/A",
                a.correct_answer,
                "CORRECT" if a.is_correct else "WRONG"
            ])
    else:
        ws.title = "Summary Results Export"
        ws.append(["Enrollment Number", "Name", "Department", "Score", "Total Questions", "Percentage", "Correct Answers", "Wrong Answers", "Status", "Attempt Date"])
        
        students = db.query(models.Student).all()
        for s in students:
            attempt = db.query(models.Attempt).filter(
                models.Attempt.student_id == s.id,
                models.Attempt.status.in_(["completed", "timed_out"])
            ).order_by(models.Attempt.id.desc()).first()
            if attempt:
                ws.append([
                    s.enrollment_no,
                    s.name,
                    s.department,
                    attempt.score,
                    attempt.total_questions,
                    f"{attempt.percentage}%",
                    attempt.correct_answers,
                    attempt.wrong_answers,
                    attempt.status,
                    attempt.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if attempt.submitted_at else "N/A"
                ])

    file_stream = io.BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)

    filename = "dsa_summary_results.xlsx" if type != "detailed" else "dsa_detailed_answers.xlsx"
    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# 15. Admin Export Results (CSV)
@router.get("/admin/export/csv")
def export_csv(
    type: str = "summary",
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    get_admin_from_request(token=token, authorization=authorization)
    output = io.StringIO()
    writer = csv.writer(output)

    if type == "detailed":
        writer.writerow(["Enrollment Number", "Name", "Department", "Question Number", "Student Answer", "Correct Answer", "Status"])
        answers = db.query(models.StudentAnswer).join(models.Attempt).join(models.Student).all()
        for a in answers:
            attempt = a.attempt
            student = attempt.student
            writer.writerow([
                student.enrollment_no,
                student.name,
                student.department,
                a.question_number,
                a.selected_answer or "N/A",
                a.correct_answer,
                "CORRECT" if a.is_correct else "WRONG"
            ])
    else:
        writer.writerow(["Enrollment Number", "Name", "Department", "Score", "Total Questions", "Percentage", "Correct Answers", "Wrong Answers", "Status", "Attempt Date"])
        students = db.query(models.Student).all()
        for s in students:
            attempt = db.query(models.Attempt).filter(
                models.Attempt.student_id == s.id,
                models.Attempt.status.in_(["completed", "timed_out"])
            ).order_by(models.Attempt.id.desc()).first()
            if attempt:
                writer.writerow([
                    s.enrollment_no,
                    s.name,
                    s.department,
                    attempt.score,
                    attempt.total_questions,
                    f"{attempt.percentage}%",
                    attempt.correct_answers,
                    attempt.wrong_answers,
                    attempt.status,
                    attempt.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if attempt.submitted_at else "N/A"
                ])

    output.seek(0)
    filename = "dsa_summary_results.csv" if type != "detailed" else "dsa_detailed_answers.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
