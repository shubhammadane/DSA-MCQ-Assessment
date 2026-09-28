from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
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

# 2. Get fixed 50 questions
@router.get("/questions", response_model=List[schemas.QuestionOut])
def get_questions():
    # Sanitized questions without exposing correct_answer during the test
    sanitized = []
    for q in FIXED_QUESTIONS:
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
        # Update name and dept if updated
        student.name = name
        student.department = dept
        db.commit()
        db.refresh(student)

    return student

# 4. Start Attempt with Duplicate Check
@router.post("/attempts/start", response_model=schemas.StartAttemptResponse)
def start_attempt(student_data: schemas.StudentCreate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.enrollment_no == student_data.enrollment_no.strip()).first()
    if not student:
        student = models.Student(
            enrollment_no=student_data.enrollment_no.strip(),
            name=student_data.name.strip(),
            department=student_data.department.strip()
        )
        db.add(student)
        db.commit()
        db.refresh(student)

    # Check for existing completed attempt
    completed_attempt = db.query(models.Attempt).filter(
        models.Attempt.student_id == student.id,
        models.Attempt.status == "completed"
    ).first()

    if completed_attempt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already completed this assessment."
        )

    # Reuse in-progress attempt or create new one
    in_progress = db.query(models.Attempt).filter(
        models.Attempt.student_id == student.id,
        models.Attempt.status == "in_progress"
    ).first()

    if not in_progress:
        in_progress = models.Attempt(
            student_id=student.id,
            total_questions=50,
            status="in_progress",
            started_at=datetime.utcnow()
        )
        db.add(in_progress)
        db.commit()
        db.refresh(in_progress)

    return {
        "attempt_id": in_progress.id,
        "student": student,
        "message": "Test started successfully."
    }

# 5. Save student answers incrementally
@router.post("/attempts/{attempt_id}/answers")
def save_answers(attempt_id: int, request: schemas.BatchAnswersRequest, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt or attempt.status == "completed":
        raise HTTPException(status_code=400, detail="Invalid or completed attempt.")

    for ans in request.answers:
        q_num = ans.question_number
        if q_num not in QUESTIONS_BY_ID:
            continue
        
        correct_ans = QUESTIONS_BY_ID[q_num]["correct_answer"]
        existing = db.query(models.StudentAnswer).filter(
            models.StudentAnswer.attempt_id == attempt_id,
            models.StudentAnswer.question_number == q_num
        ).first()

        selected = ans.selected_answer.upper() if ans.selected_answer else None

        if existing:
            existing.selected_answer = selected
            existing.correct_answer = correct_ans
            existing.is_correct = (selected == correct_ans)
            existing.answered_at = datetime.utcnow()
        else:
            new_ans = models.StudentAnswer(
                attempt_id=attempt_id,
                question_number=q_num,
                selected_answer=selected,
                correct_answer=correct_ans,
                is_correct=(selected == correct_ans),
                answered_at=datetime.utcnow()
            )
            db.add(new_ans)

    db.commit()
    return {"message": "Answers saved successfully"}

# 6. Submit Test
@router.post("/attempts/{attempt_id}/submit", response_model=schemas.TestResultOut)
def submit_test(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")
    
    if attempt.status == "completed":
        return get_test_result(attempt_id, db)

    # Fill un-answered questions if any
    existing_answers = {
        sa.question_number: sa for sa in db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == attempt_id).all()
    }

    correct_count = 0
    wrong_count = 0

    for q_num, q_info in QUESTIONS_BY_ID.items():
        corr_ans = q_info["correct_answer"]
        if q_num in existing_answers:
            sa = existing_answers[q_num]
            if sa.selected_answer == corr_ans:
                sa.is_correct = True
                correct_count += 1
            else:
                sa.is_correct = False
                wrong_count += 1
        else:
            sa = models.StudentAnswer(
                attempt_id=attempt_id,
                question_number=q_num,
                selected_answer=None,
                correct_answer=corr_ans,
                is_correct=False,
                answered_at=datetime.utcnow()
            )
            db.add(sa)
            wrong_count += 1

    total_q = 50
    score = correct_count
    pct = round((correct_count / total_q) * 100, 2)

    attempt.score = score
    attempt.percentage = pct
    attempt.correct_answers = correct_count
    attempt.wrong_answers = wrong_count
    attempt.submitted_at = datetime.utcnow()
    attempt.status = "completed"

    db.commit()
    db.refresh(attempt)

    return get_test_result(attempt_id, db)

# 7. Get Result Page details
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
        q_info = QUESTIONS_BY_ID.get(sa.question_number, {})
        answers_out.append({
            "question_number": sa.question_number,
            "question": q_info.get("question", ""),
            "options": q_info.get("options", {}),
            "selected_answer": sa.selected_answer,
            "correct_answer": sa.correct_answer,
            "is_correct": sa.is_correct
        })

    return {
        "student": student,
        "attempt": attempt,
        "answers": answers_out
    }

# 8. Admin Dashboard Analytics
@router.get("/admin/dashboard", response_model=schemas.AdminDashboardStats)
def get_admin_dashboard(admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    total_students = db.query(models.Student).count()
    total_attempts = db.query(models.Attempt).count()
    completed_attempts = db.query(models.Attempt).filter(models.Attempt.status == "completed").all()
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

# 9. Admin List Students
@router.get("/admin/students", response_model=List[schemas.StudentSummary])
def get_admin_students(
    search: Optional[str] = None,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(models.Student)
    students = query.all()

    results = []
    for s in students:
        attempt = db.query(models.Attempt).filter(
            models.Attempt.student_id == s.id,
            models.Attempt.status == "completed"
        ).order_by(models.Attempt.submitted_at.desc()).first()

        summary = {
            "student_id": s.id,
            "enrollment_no": s.enrollment_no,
            "name": s.name,
            "department": s.department,
            "score": attempt.score if attempt else None,
            "percentage": attempt.percentage if attempt else None,
            "attempt_date": attempt.submitted_at if attempt else None,
            "status": attempt.status if attempt else "Not Attempted",
            "attempt_id": attempt.id if attempt else None
        }
        
        # Apply search filtering
        if search:
            q = search.strip().lower()
            if q not in s.enrollment_no.lower() and q not in s.name.lower() and q not in s.department.lower():
                continue
        results.append(summary)

    return results

# 10. Admin Student Details
@router.get("/admin/students/{student_id}", response_model=schemas.TestResultOut)
def get_admin_student_details(student_id: int, admin: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    attempt = db.query(models.Attempt).filter(
        models.Attempt.student_id == student_id,
        models.Attempt.status == "completed"
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Student has not completed any attempt.")

    return get_test_result(attempt.id, db)

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

# 11. Admin Export Results (Excel)
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
        ws.append(["Enrollment Number", "Name", "Department", "Score", "Total Questions", "Percentage", "Correct Answers", "Wrong Answers", "Attempt Date"])
        
        students = db.query(models.Student).all()
        for s in students:
            attempt = db.query(models.Attempt).filter(
                models.Attempt.student_id == s.id,
                models.Attempt.status == "completed"
            ).first()
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

# 12. Admin Export Results (CSV)
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
        writer.writerow(["Enrollment Number", "Name", "Department", "Score", "Total Questions", "Percentage", "Correct Answers", "Wrong Answers", "Attempt Date"])
        students = db.query(models.Student).all()
        for s in students:
            attempt = db.query(models.Attempt).filter(
                models.Attempt.student_id == s.id,
                models.Attempt.status == "completed"
            ).first()
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
                    attempt.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if attempt.submitted_at else "N/A"
                ])

    output.seek(0)
    filename = "dsa_summary_results.csv" if type != "detailed" else "dsa_detailed_answers.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
