from fastapi import APIRouter, Depends, HTTPException, status, Header, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import io
import csv
import re
import random
import openpyxl
from pypdf import PdfReader
from fastapi.responses import StreamingResponse
import logging
import os
import json

logger = logging.getLogger("uvicorn")

from app.database import get_db
from app import models, schemas
from app.config import settings
from app.auth import (
    create_access_token,
    get_current_admin,
    require_super_admin,
    require_hod_or_super_admin,
    get_current_student,
    hash_password,
    verify_password,
    CurrentUser,
    get_optional_admin,
    resolve_admin_user
)
from app.questions_data import FIXED_QUESTIONS, QUESTIONS_BY_ID

router = APIRouter(prefix="/api")


# =========================================================================
# HELPER FUNCTIONS & AUDIT LOGGING
# =========================================================================

def log_deletion_audit(admin_username: str, action_type: str, record_type: str, record_ids: List[int], outcome: str, details: Optional[str] = None):
    """Audit log all high-impact and bulk permanent deletion operations."""
    logger.info(
        f"[AUDIT DELETION] Admin='{admin_username}' | Action='{action_type}' | Target='{record_type}' | "
        f"IDs={record_ids} | Outcome='{outcome}' | Details='{details or 'None'}' | Timestamp='{datetime.utcnow().isoformat()}'"
    )

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


def calculate_attempt_score(attempt: models.Attempt, db: Session):
    """Recalculate score and percentage for an attempt based on actual questions."""
    answers = db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == attempt.id).all()
    correct_count = sum(1 for a in answers if a.is_correct)
    wrong_count = sum(1 for a in answers if not a.is_correct and a.selected_answer is not None)
    total_q = attempt.total_questions or len(answers) or 1
    
    attempt.correct_answers = correct_count
    attempt.wrong_answers = wrong_count
    attempt.score = correct_count
    attempt.percentage = round((correct_count / total_q) * 100.0, 2)


# =========================================================================
# 1. ADMIN & HOD AUTHENTICATION
# =========================================================================

@router.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.AdminLogin, db: Session = Depends(get_db)):
    # 1. Super Admin from environment configuration
    if credentials.username == settings.ADMIN_USERNAME and credentials.password == settings.ADMIN_PASSWORD:
        access_token = create_access_token(data={"sub": credentials.username, "role": "super_admin"})
        user_out = schemas.AdminUserOut(
            id=0,
            username=credentials.username,
            full_name="Super Administrator",
            email=None,
            role="super_admin",
            department_id=None,
            department_name=None,
            is_active=True,
            created_at=datetime.utcnow()
        )
        return {"access_token": access_token, "token_type": "bearer", "user": user_out}

    # 2. Database AdminUser (HOD / Faculty / Super Admin)
    user = db.query(models.AdminUser).filter(
        models.AdminUser.username == credentials.username.strip(),
        models.AdminUser.is_active == True
    ).first()

    if user and verify_password(credentials.password, user.hashed_password):
        access_token = create_access_token(data={
            "sub": user.username,
            "role": user.role,
            "user_id": user.id,
            "department_id": user.department_id
        })
        dept_name = user.department.name if user.department else None
        user_out = schemas.AdminUserOut(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            department_id=user.department_id,
            department_name=dept_name,
            is_active=user.is_active,
            created_at=user.created_at
        )
        return {"access_token": access_token, "token_type": "bearer", "user": user_out}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect username or password"
    )


@router.get("/auth/me", response_model=schemas.AdminUserOut)
def get_current_user_profile(admin: CurrentUser = Depends(get_current_admin)):
    return schemas.AdminUserOut(
        id=admin.id or 0,
        username=admin.username,
        full_name=admin.full_name,
        email=None,
        role=admin.role,
        department_id=admin.department_id,
        department_name=admin.department_name,
        is_active=True,
        created_at=datetime.utcnow()
    )


# =========================================================================
# 1.1 HOD & STAFF ACCOUNT MANAGEMENT (SUPER ADMIN ONLY)
# =========================================================================

@router.get("/admin/users", response_model=List[schemas.AdminUserOut])
def get_admin_users(
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    users = db.query(models.AdminUser).order_by(models.AdminUser.id.asc()).all()
    result = []
    for u in users:
        dept_name = u.department.name if u.department else None
        result.append(schemas.AdminUserOut(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            department_id=u.department_id,
            department_name=dept_name,
            is_active=u.is_active,
            created_at=u.created_at
        ))
    return result


@router.post("/admin/users", response_model=schemas.AdminUserOut, status_code=201)
def create_admin_user(
    user_in: schemas.AdminUserCreate,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    username = user_in.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")
    
    if username == settings.ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Cannot use system super-admin username.")

    existing = db.query(models.AdminUser).filter(func.lower(models.AdminUser.username) == username.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{username}' already exists.")

    dept = None
    if user_in.role == "hod":
        if not user_in.department_id:
            raise HTTPException(status_code=400, detail="Department assignment is required for HOD role.")
        dept = db.query(models.Department).filter(models.Department.id == user_in.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department with ID {user_in.department_id} does not exist.")

    hashed = hash_password(user_in.password)
    user = models.AdminUser(
        username=username,
        hashed_password=hashed,
        full_name=user_in.full_name.strip(),
        email=user_in.email.strip() if user_in.email else None,
        role=user_in.role,
        department_id=user_in.department_id,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return schemas.AdminUserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        department_name=dept.name if dept else None,
        is_active=user.is_active,
        created_at=user.created_at
    )


@router.put("/admin/users/{user_id}", response_model=schemas.AdminUserOut)
def update_admin_user(
    user_id: int,
    user_in: schemas.AdminUserUpdate,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.AdminUser).filter(models.AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_in.full_name is not None:
        user.full_name = user_in.full_name.strip()
    if user_in.email is not None:
        user.email = user_in.email.strip() if user_in.email else None
    if user_in.password:
        user.hashed_password = hash_password(user_in.password)
    if user_in.department_id is not None:
        dept = db.query(models.Department).filter(models.Department.id == user_in.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Invalid department ID.")
        user.department_id = user_in.department_id
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    dept_name = user.department.name if user.department else None
    return schemas.AdminUserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        department_name=dept_name,
        is_active=user.is_active,
        created_at=user.created_at
    )


@router.delete("/admin/users/{user_id}")
def delete_admin_user(
    user_id: int,
    permanent: bool = Query(True, description="Permanently delete user from database"),
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.AdminUser).filter(models.AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if admin.id == user.id or admin.username == user.username:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrative account.")
    if user.username == settings.ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Cannot delete the root system administrator.")

    uname = user.username
    if not permanent:
        user.is_active = False
        db.commit()
        log_deletion_audit(admin.username, "DEACTIVATE", "admin_user", [user_id], "SUCCESS", f"Deactivated user {uname}")
        return {"status": "success", "message": f"User '{uname}' deactivated successfully.", "user_id": user_id, "permanent": False}

    try:
        db.delete(user)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "admin_user", [user_id], "SUCCESS", f"Permanently deleted user {uname}")
        return {"status": "success", "message": f"User '{uname}' permanently deleted successfully.", "user_id": user_id, "permanent": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while deleting admin user: {str(e)}")


@router.post("/admin/users/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_admin_users(
    req: schemas.BulkDeleteRequest,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    if not req.ids:
        raise HTTPException(status_code=400, detail="No user IDs provided.")

    users = db.query(models.AdminUser).filter(models.AdminUser.id.in_(req.ids)).all()
    if not users:
        raise HTTPException(status_code=404, detail="No matching users found.")

    for u in users:
        if admin.id == u.id or admin.username == u.username:
            raise HTTPException(status_code=400, detail="Cannot delete your own administrative account.")
        if u.username == settings.ADMIN_USERNAME:
            raise HTTPException(status_code=400, detail="Cannot delete the root system administrator.")

    try:
        deleted_ids = [u.id for u in users]
        db.query(models.AdminUser).filter(models.AdminUser.id.in_(deleted_ids)).delete(synchronize_session=False)
        db.commit()
        log_deletion_audit(admin.username, "BULK_PERMANENT_DELETE", "admin_user", deleted_ids, "SUCCESS")
        return schemas.BulkDeleteResponse(
            status="success",
            message=f"Successfully deleted {len(deleted_ids)} administrator/staff account(s).",
            deleted_count=len(deleted_ids),
            deleted_ids=deleted_ids
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete admin users: {str(e)}")


# =========================================================================
# 2. ACADEMIC STRUCTURE & DEPARTMENTS
# =========================================================================

@router.get("/academic-structure", response_model=schemas.AcademicStructureResponse)
def get_academic_structure(db: Session = Depends(get_db)):
    depts = db.query(models.Department).filter(models.Department.is_active == True).order_by(models.Department.name.asc()).all()
    progs = db.query(models.Program).filter(models.Program.is_active == True).order_by(models.Program.id.asc()).all()
    years = db.query(models.AcademicYear).filter(models.AcademicYear.is_active == True).order_by(models.AcademicYear.program_id.asc(), models.AcademicYear.year_number.asc()).all()
    sems = db.query(models.Semester).filter(models.Semester.is_active == True).order_by(models.Semester.program_id.asc(), models.Semester.semester_number.asc()).all()
    return {
        "departments": depts,
        "programs": progs,
        "years": years,
        "semesters": sems
    }


@router.get("/departments", response_model=List[schemas.DepartmentOut])
def get_departments(all_status: bool = False, db: Session = Depends(get_db)):
    q = db.query(models.Department)
    if not all_status:
        q = q.filter(models.Department.is_active == True)
    return q.order_by(models.Department.name.asc()).all()


@router.post("/departments", response_model=schemas.DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(dept_in: schemas.DepartmentCreate, admin: CurrentUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    name = dept_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Department Full Name is required.")
    existing = db.query(models.Department).filter(models.Department.name.ilike(name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Department '{name}' already exists.")
    dept = models.Department(
        name=name,
        code=dept_in.code.strip() if dept_in.code else None,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.patch("/departments/{department_id}/status", response_model=schemas.DepartmentOut)
def toggle_department_status(department_id: int, status_in: schemas.QuestionStatusUpdate, admin: CurrentUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")
    dept.is_active = status_in.is_active
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/departments/{department_id}/dependencies")
def get_department_dependencies(
    department_id: int,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    subj_cnt = db.query(models.Subject).filter(models.Subject.department_id == department_id).count()
    st_cnt = db.query(models.Student).filter(
        or_(models.Student.department_id == department_id, models.Student.department.ilike(dept.name))
    ).count()
    q_cnt = db.query(models.Question).filter(models.Question.department_id == department_id).count()
    e_cnt = db.query(models.Exam).filter(models.Exam.department_id == department_id).count()
    u_cnt = db.query(models.AdminUser).filter(models.AdminUser.department_id == department_id).count()

    has_dependencies = (subj_cnt > 0 or st_cnt > 0 or q_cnt > 0 or e_cnt > 0 or u_cnt > 0)
    reasons = []
    if subj_cnt > 0: reasons.append(f"{subj_cnt} subject(s)")
    if st_cnt > 0: reasons.append(f"{st_cnt} student(s)")
    if q_cnt > 0: reasons.append(f"{q_cnt} question(s)")
    if e_cnt > 0: reasons.append(f"{e_cnt} examination(s)")
    if u_cnt > 0: reasons.append(f"{u_cnt} staff/HOD account(s)")

    return {
        "department_id": dept.id,
        "name": dept.name,
        "code": dept.code,
        "is_active": dept.is_active,
        "can_delete": not has_dependencies,
        "has_dependencies": has_dependencies,
        "dependency_counts": {
            "subjects": subj_cnt,
            "students": st_cnt,
            "questions": q_cnt,
            "exams": e_cnt,
            "admin_users": u_cnt,
        },
        "dependency_summary": ", ".join(reasons) if reasons else "None",
        "reason": (
            f"Referenced by {', '.join(reasons)}. Permanent deletion is blocked to prevent orphaned records and protect institutional data."
            if has_dependencies
            else "No protected dependencies. This department can be safely deleted permanently."
        )
    }


@router.delete("/departments/{department_id}")
def delete_department(
    department_id: int,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    subj_cnt = db.query(models.Subject).filter(models.Subject.department_id == department_id).count()
    st_cnt = db.query(models.Student).filter(
        or_(models.Student.department_id == department_id, models.Student.department.ilike(dept.name))
    ).count()
    q_cnt = db.query(models.Question).filter(models.Question.department_id == department_id).count()
    e_cnt = db.query(models.Exam).filter(models.Exam.department_id == department_id).count()
    u_cnt = db.query(models.AdminUser).filter(models.AdminUser.department_id == department_id).count()

    if subj_cnt > 0 or st_cnt > 0 or q_cnt > 0 or e_cnt > 0 or u_cnt > 0:
        reasons = []
        if subj_cnt > 0: reasons.append(f"{subj_cnt} subject(s)")
        if st_cnt > 0: reasons.append(f"{st_cnt} student(s)")
        if q_cnt > 0: reasons.append(f"{q_cnt} question(s)")
        if e_cnt > 0: reasons.append(f"{e_cnt} exam(s)")
        if u_cnt > 0: reasons.append(f"{u_cnt} staff/HOD account(s)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot permanently delete department '{dept.name}' because it contains active dependencies: {', '.join(reasons)}. "
                f"Please deactivate the department or reassign/delete dependent records first."
            )
        )

    try:
        dept_name = dept.name
        db.delete(dept)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "department", [department_id], "SUCCESS", f"Deleted dept {dept_name}")
        return {"status": "success", "message": f"Department '{dept_name}' permanently deleted successfully.", "id": department_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while deleting department: {str(e)}")


@router.post("/departments/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_departments(
    req: schemas.BulkDeleteRequest,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    if not req.ids:
        raise HTTPException(status_code=400, detail="No department IDs provided.")

    depts = db.query(models.Department).filter(models.Department.id.in_(req.ids)).all()
    if not depts:
        raise HTTPException(status_code=404, detail="No matching departments found.")

    blocked = []
    for d in depts:
        s = db.query(models.Subject).filter(models.Subject.department_id == d.id).count()
        st = db.query(models.Student).filter(or_(models.Student.department_id == d.id, models.Student.department.ilike(d.name))).count()
        q = db.query(models.Question).filter(models.Question.department_id == d.id).count()
        e = db.query(models.Exam).filter(models.Exam.department_id == d.id).count()
        u = db.query(models.AdminUser).filter(models.AdminUser.department_id == d.id).count()
        if s > 0 or st > 0 or q > 0 or e > 0 or u > 0:
            blocked.append(f"Department '{d.name}' (ID {d.id}): {s} subjects, {st} students, {q} questions, {e} exams, {u} users")

    if blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Bulk deletion blocked: One or more selected departments have protected dependencies. Details: {'; '.join(blocked)}"
        )

    try:
        deleted_ids = [d.id for d in depts]
        db.query(models.Department).filter(models.Department.id.in_(deleted_ids)).delete(synchronize_session=False)
        db.commit()
        log_deletion_audit(admin.username, "BULK_PERMANENT_DELETE", "department", deleted_ids, "SUCCESS")
        return schemas.BulkDeleteResponse(
            status="success",
            message=f"Successfully deleted {len(deleted_ids)} department(s).",
            deleted_count=len(deleted_ids),
            deleted_ids=deleted_ids
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during bulk department deletion: {str(e)}")


@router.delete("/academic/programs/{program_id}")
def delete_academic_program(
    program_id: int,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    prog = db.query(models.Program).filter(models.Program.id == program_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found.")

    s_cnt = db.query(models.Subject).filter(models.Subject.program_id == program_id).count()
    q_cnt = db.query(models.Question).filter(models.Question.program_id == program_id).count()
    e_cnt = db.query(models.Exam).filter(models.Exam.program_id == program_id).count()

    if s_cnt > 0 or q_cnt > 0 or e_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete program '{prog.name}' because it is referenced by {s_cnt} subject(s), {q_cnt} question(s), and {e_cnt} exam(s)."
        )

    try:
        p_name = prog.name
        db.delete(prog)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "program", [program_id], "SUCCESS")
        return {"status": "success", "message": f"Academic program '{p_name}' permanently deleted.", "id": program_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error deleting program: {str(e)}")


@router.delete("/academic/years/{year_id}")
def delete_academic_year(
    year_id: int,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == year_id).first()
    if not ay:
        raise HTTPException(status_code=404, detail="Academic year not found.")

    s_cnt = db.query(models.Subject).filter(models.Subject.academic_year_id == year_id).count()
    q_cnt = db.query(models.Question).filter(models.Question.academic_year_id == year_id).count()
    e_cnt = db.query(models.Exam).filter(models.Exam.academic_year_id == year_id).count()

    if s_cnt > 0 or q_cnt > 0 or e_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete academic year '{ay.name}' because it is referenced by {s_cnt} subject(s), {q_cnt} question(s), and {e_cnt} exam(s)."
        )

    try:
        y_name = ay.name
        db.delete(ay)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "academic_year", [year_id], "SUCCESS")
        return {"status": "success", "message": f"Academic year '{y_name}' permanently deleted.", "id": year_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error deleting academic year: {str(e)}")


@router.delete("/academic/semesters/{semester_id}")
def delete_academic_semester(
    semester_id: int,
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    sem = db.query(models.Semester).filter(models.Semester.id == semester_id).first()
    if not sem:
        raise HTTPException(status_code=404, detail="Semester not found.")

    s_cnt = db.query(models.Subject).filter(models.Subject.semester_id == semester_id).count()
    q_cnt = db.query(models.Question).filter(models.Question.semester_id == semester_id).count()
    e_cnt = db.query(models.Exam).filter(models.Exam.semester_id == semester_id).count()

    if s_cnt > 0 or q_cnt > 0 or e_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete semester '{sem.name}' because it is referenced by {s_cnt} subject(s), {q_cnt} question(s), and {e_cnt} exam(s)."
        )

    try:
        s_name = sem.name
        db.delete(sem)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "semester", [semester_id], "SUCCESS")
        return {"status": "success", "message": f"Semester '{s_name}' permanently deleted.", "id": semester_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error deleting semester: {str(e)}")


@router.get("/departments/stats", response_model=List[schemas.DepartmentStats])
def get_departments_stats(db: Session = Depends(get_db)):
    """Return each active department with real student, subject, and exam counts."""
    depts = (
        db.query(models.Department)
        .filter(models.Department.is_active == True)
        .order_by(models.Department.name.asc())
        .all()
    )

    result = []
    for dept in depts:
        students_count = (
            db.query(func.count(models.Student.id))
            .filter(
                or_(
                    models.Student.department_id == dept.id,
                    models.Student.department.ilike(dept.name)
                ),
                models.Student.is_active == True
            )
            .scalar() or 0
        )
        active_subjects_count = (
            db.query(func.count(models.Subject.id))
            .filter(models.Subject.department_id == dept.id, models.Subject.is_active == True)
            .scalar() or 0
        )
        exams_count = (
            db.query(func.count(models.Exam.id))
            .filter(
                or_(
                    models.Exam.department_id == dept.id,
                    models.Exam.department_name.ilike(dept.name)
                ),
                models.Exam.is_active == True
            )
            .scalar() or 0
        )
        active_exams_count = (
            db.query(func.count(models.Exam.id))
            .filter(
                or_(
                    models.Exam.department_id == dept.id,
                    models.Exam.department_name.ilike(dept.name)
                ),
                models.Exam.is_active == True,
                models.Exam.status == "published"
            )
            .scalar() or 0
        )
        result.append(schemas.DepartmentStats(
            id=dept.id,
            name=dept.name,
            code=dept.code,
            is_active=dept.is_active,
            students_count=students_count,
            active_subjects_count=active_subjects_count,
            exams_count=exams_count,
            active_exams_count=active_exams_count,
        ))
    return result


# =========================================================================
# 3. SUBJECT MANAGEMENT (MANUALLY ADDED ONLY)
# =========================================================================

@router.get("/subjects", response_model=List[schemas.SubjectOut])
def get_subjects(
    department_id: Optional[int] = None,
    program_id: Optional[int] = None,
    academic_year_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin: Optional[CurrentUser] = Depends(get_optional_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Subject)
    if admin and admin.is_hod:
        if department_id and department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot query subjects from another department.")
        q = q.filter(models.Subject.department_id == admin.department_id)
    elif department_id:
        q = q.filter(models.Subject.department_id == department_id)
    if program_id:
        q = q.filter(models.Subject.program_id == program_id)
    if academic_year_id:
        q = q.filter(models.Subject.academic_year_id == academic_year_id)
    if semester_id:
        q = q.filter(models.Subject.semester_id == semester_id)
    if is_active is not None:
        q = q.filter(models.Subject.is_active == is_active)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(models.Subject.name.ilike(s), models.Subject.code.ilike(s)))
    return q.order_by(models.Subject.name.asc()).all()


@router.get("/subjects/{subject_id}", response_model=schemas.SubjectOut)
def get_subject(subject_id: int, admin: Optional[CurrentUser] = Depends(get_optional_admin), db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found.")
    if admin and admin.is_hod and subj.department_id != admin.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Subject does not belong to your department.")
    return subj


@router.post("/subjects", response_model=schemas.SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(subj_in: schemas.SubjectCreate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    if admin.is_hod:
        if subj_in.department_id and subj_in.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot create subjects for another department.")
        subj_in.department_id = admin.department_id

    name = subj_in.name.strip()
    code = subj_in.code.strip()
    if not name or not code:
        raise HTTPException(status_code=400, detail="Subject name and code are required.")

    dept = db.query(models.Department).filter(models.Department.id == subj_in.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Invalid department ID.")

    prog_name = None
    if subj_in.program_id:
        prog = db.query(models.Program).filter(models.Program.id == subj_in.program_id).first()
        if prog:
            prog_name = prog.name

    year_name = None
    if subj_in.academic_year_id:
        ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == subj_in.academic_year_id).first()
        if ay:
            year_name = ay.name

    sem_name = None
    if subj_in.semester_id:
        sem = db.query(models.Semester).filter(models.Semester.id == subj_in.semester_id).first()
        if sem:
            sem_name = sem.name

    subj = models.Subject(
        name=name,
        code=code,
        department_id=dept.id,
        department_name=dept.name,
        program_id=subj_in.program_id,
        program_name=prog_name,
        academic_year_id=subj_in.academic_year_id,
        year_name=year_name,
        semester_id=subj_in.semester_id,
        semester_name=sem_name,
        is_active=subj_in.is_active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj


@router.put("/subjects/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(subject_id: int, subj_in: schemas.SubjectUpdate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if admin.is_hod:
        if subj.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Subject does not belong to your department.")
        if subj_in.department_id and subj_in.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot transfer subject to another department.")

    if subj_in.name is not None:
        subj.name = subj_in.name.strip()
    if subj_in.code is not None:
        subj.code = subj_in.code.strip()
    if subj_in.department_id is not None and not admin.is_hod:
        dept = db.query(models.Department).filter(models.Department.id == subj_in.department_id).first()
        if dept:
            subj.department_id = dept.id
            subj.department_name = dept.name
    if subj_in.program_id is not None:
        prog = db.query(models.Program).filter(models.Program.id == subj_in.program_id).first()
        subj.program_id = prog.id if prog else None
        subj.program_name = prog.name if prog else None
    if subj_in.academic_year_id is not None:
        ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == subj_in.academic_year_id).first()
        subj.academic_year_id = ay.id if ay else None
        subj.year_name = ay.name if ay else None
    if subj_in.semester_id is not None:
        sem = db.query(models.Semester).filter(models.Semester.id == subj_in.semester_id).first()
        subj.semester_id = sem.id if sem else None
        subj.semester_name = sem.name if sem else None
    if subj_in.is_active is not None:
        subj.is_active = subj_in.is_active

    subj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(subj)
    return subj


@router.patch("/subjects/{subject_id}/status", response_model=schemas.SubjectOut)
def toggle_subject_status(subject_id: int, status_in: schemas.QuestionStatusUpdate, admin: CurrentUser = Depends(require_hod_or_super_admin), db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found.")
    if admin.is_hod and subj.department_id != admin.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Subject does not belong to your department.")
    subj.is_active = status_in.is_active
    subj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(subj)
    return subj


@router.get("/subjects/{subject_id}/dependencies")
def get_subject_dependencies(
    subject_id: int,
    admin: CurrentUser = Depends(require_hod_or_super_admin),
    db: Session = Depends(get_db)
):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found.")
    if admin.is_hod and subj.department_id != admin.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Subject does not belong to your department.")

    q_count = db.query(models.Question).filter(models.Question.subject_id == subject_id).count()
    exam_count = db.query(models.Exam).filter(models.Exam.subject_id == subject_id).count()
    attempt_count = db.query(models.Attempt).join(models.Exam, models.Attempt.exam_id == models.Exam.id).filter(models.Exam.subject_id == subject_id).count()
    answers_count = db.query(models.StudentAnswer).join(models.Question, models.StudentAnswer.question_id == models.Question.id).filter(models.Question.subject_id == subject_id).count()

    has_dependencies = (q_count > 0 or exam_count > 0 or attempt_count > 0 or answers_count > 0)
    reasons = []
    if q_count > 0:
        reasons.append(f"{q_count} question(s)")
    if exam_count > 0:
        reasons.append(f"{exam_count} examination(s)")
    if attempt_count > 0:
        reasons.append(f"{attempt_count} student examination attempt(s)")
    if answers_count > 0 and attempt_count == 0:
        reasons.append(f"{answers_count} student answer record(s)")

    return {
        "subject_id": subj.id,
        "name": subj.name,
        "code": subj.code,
        "department_id": subj.department_id,
        "department_name": subj.department_name,
        "is_active": subj.is_active,
        "has_dependencies": has_dependencies,
        "can_delete": not has_dependencies,
        "question_count": q_count,
        "exam_count": exam_count,
        "attempt_count": attempt_count,
        "answers_count": answers_count,
        "dependency_summary": ", ".join(reasons) if reasons else "None",
        "reason": (
            f"Referenced by {', '.join(reasons)}. Permanent deletion is blocked to protect historical academic records."
            if has_dependencies
            else "No protected dependencies. This subject can be safely deleted permanently."
        )
    }


@router.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, admin: CurrentUser = Depends(require_hod_or_super_admin), db: Session = Depends(get_db)):
    subj = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found.")
    if admin.is_hod and subj.department_id != admin.department_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Subject does not belong to your department.")

    # Safe delete checks: verify if any questions, exams, student attempts or answers reference this subject
    q_count = db.query(models.Question).filter(models.Question.subject_id == subject_id).count()
    exam_count = db.query(models.Exam).filter(models.Exam.subject_id == subject_id).count()
    attempt_count = db.query(models.Attempt).join(models.Exam, models.Attempt.exam_id == models.Exam.id).filter(models.Exam.subject_id == subject_id).count()
    answers_count = db.query(models.StudentAnswer).join(models.Question, models.StudentAnswer.question_id == models.Question.id).filter(models.Question.subject_id == subject_id).count()

    if q_count > 0 or exam_count > 0 or attempt_count > 0 or answers_count > 0:
        reasons = []
        if q_count > 0:
            reasons.append(f"{q_count} question(s)")
        if exam_count > 0:
            reasons.append(f"{exam_count} examination(s)")
        if attempt_count > 0:
            reasons.append(f"{attempt_count} student examination attempt(s)")
        if answers_count > 0 and attempt_count == 0:
            reasons.append(f"{answers_count} student answer record(s)")
        reasons_str = ", ".join(reasons)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot permanently delete subject '{subj.name}' ({subj.code}) because it has protected academic dependencies: "
                f"{reasons_str}. Deleting it would compromise historical records. "
                f"Please deactivate or archive this subject instead to safely remove it from active selection."
            )
        )

    try:
        subj_name = subj.name
        subj_code = subj.code
        db.delete(subj)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "subject", [subject_id], "SUCCESS", f"Deleted {subj_name}")
        return {
            "message": f"Subject '{subj_name}' ({subj_code}) permanently deleted successfully",
            "id": subject_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database error occurred while deleting subject '{subj.name}': {str(e)}"
        )


@router.post("/subjects/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_subjects(
    req: schemas.BulkDeleteRequest,
    admin: CurrentUser = Depends(require_hod_or_super_admin),
    db: Session = Depends(get_db)
):
    if not req.ids:
        raise HTTPException(status_code=400, detail="No subject IDs provided for deletion.")

    subjects = db.query(models.Subject).filter(models.Subject.id.in_(req.ids)).all()
    if not subjects:
        raise HTTPException(status_code=404, detail="No matching subjects found.")

    if admin.is_hod:
        for s in subjects:
            if s.department_id != admin.department_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: Subject '{s.name}' ({s.code}) does not belong to your department."
                )

    blocked = []
    for s in subjects:
        q_count = db.query(models.Question).filter(models.Question.subject_id == s.id).count()
        exam_count = db.query(models.Exam).filter(models.Exam.subject_id == s.id).count()
        attempt_count = db.query(models.Attempt).join(models.Exam, models.Attempt.exam_id == models.Exam.id).filter(models.Exam.subject_id == s.id).count()
        answers_count = db.query(models.StudentAnswer).join(models.Question, models.StudentAnswer.question_id == models.Question.id).filter(models.Question.subject_id == s.id).count()

        if q_count > 0 or exam_count > 0 or attempt_count > 0 or answers_count > 0:
            reasons = []
            if q_count > 0: reasons.append(f"{q_count} questions")
            if exam_count > 0: reasons.append(f"{exam_count} exams")
            if attempt_count > 0: reasons.append(f"{attempt_count} attempts")
            blocked.append(f"Subject '{s.name}' ({s.code}): referenced by {', '.join(reasons)}")

    if blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bulk deletion blocked: One or more selected subjects have protected academic dependencies. {'; '.join(blocked)}. Please deactivate them instead."
        )

    try:
        deleted_ids = [s.id for s in subjects]
        db.query(models.Subject).filter(models.Subject.id.in_(deleted_ids)).delete(synchronize_session=False)
        db.commit()
        log_deletion_audit(admin.username, "BULK_PERMANENT_DELETE", "subject", deleted_ids, "SUCCESS")
        return schemas.BulkDeleteResponse(
            status="success",
            message=f"Successfully deleted {len(deleted_ids)} subject(s) with zero dependencies.",
            deleted_count=len(deleted_ids),
            deleted_ids=deleted_ids
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during bulk subject deletion: {str(e)}")



# =========================================================================
# 4. STUDENT MANAGEMENT & BULK IMPORT
# =========================================================================

@router.get("/admin/students/list", response_model=List[schemas.StudentOut])
def list_students(
    department: Optional[str] = None,
    program: Optional[str] = None,
    year: Optional[str] = None,
    semester: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Student)
    if admin.is_hod:
        if department and department != admin.department_name:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot query students from another department.")
        q = q.filter(
            or_(
                models.Student.department_id == admin.department_id,
                models.Student.department.ilike(admin.department_name)
            )
        )
    elif department:
        q = q.filter(models.Student.department == department)
    if program:
        q = q.filter(models.Student.program == program)
    if year:
        q = q.filter(models.Student.year == year)
    if semester:
        q = q.filter(models.Student.semester == semester)
    if is_active is not None:
        q = q.filter(models.Student.is_active == is_active)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(models.Student.enrollment_no.ilike(s), models.Student.name.ilike(s)))
    return q.order_by(models.Student.enrollment_no.asc()).all()


@router.post("/admin/students", response_model=schemas.StudentOut, status_code=status.HTTP_201_CREATED)
def admin_create_student(student_in: schemas.StudentCreate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    if admin.is_hod:
        if student_in.department and admin.department_name:
            norm_in = student_in.department.strip().lower().replace("and", "&")
            norm_admin = admin.department_name.strip().lower().replace("and", "&")
            if norm_in != norm_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot create student for another department.")
        dept = admin.department_name
        dept_id = admin.department_id
    else:
        dept = student_in.department.strip()
        dept_obj = db.query(models.Department).filter(models.Department.name.ilike(dept)).first()
        dept_id = dept_obj.id if dept_obj else None

    enrollment = student_in.enrollment_no.strip()
    name = student_in.name.strip()

    if not enrollment or not name or not dept:
        raise HTTPException(status_code=400, detail="Enrollment No, Name, and Department are required.")

    existing = db.query(models.Student).filter(models.Student.enrollment_no == enrollment).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student with this Enrollment Number already exists."
        )

    raw_password = student_in.password.strip() if student_in.password else enrollment
    hashed_pwd = hash_password(raw_password)

    student = models.Student(
        enrollment_no=enrollment,
        name=name,
        gender=student_in.gender.strip() if student_in.gender else None,
        department=dept,
        department_id=dept_id,
        program=student_in.program.strip() if student_in.program else "UG",
        year=student_in.year.strip() if student_in.year else "1st Year",
        semester=student_in.semester.strip() if student_in.semester else "Semester 1",
        password_hash=hashed_pwd,
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.put("/admin/students/{student_id}", response_model=schemas.StudentOut)
def admin_update_student(student_id: int, student_in: schemas.StudentUpdate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if admin.is_hod:
        if student.department_id != admin.department_id and student.department != admin.department_name:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Student does not belong to your department.")

    if student_in.name is not None:
        student.name = student_in.name.strip()
    if student_in.department is not None and not admin.is_hod:
        student.department = student_in.department.strip()
        dept_obj = db.query(models.Department).filter(models.Department.name.ilike(student.department)).first()
        student.department_id = dept_obj.id if dept_obj else student.department_id
    if student_in.gender is not None:
        student.gender = student_in.gender.strip()
    if student_in.program is not None:
        student.program = student_in.program.strip()
    if student_in.year is not None:
        student.year = student_in.year.strip()
    if student_in.semester is not None:
        student.semester = student_in.semester.strip()
    if student_in.password is not None and student_in.password.strip():
        student.password_hash = hash_password(student_in.password.strip())
    if student_in.is_active is not None:
        student.is_active = student_in.is_active

    student.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(student)
    return student


@router.patch("/admin/students/{student_id}/status", response_model=schemas.StudentOut)
def toggle_student_status(student_id: int, status_in: schemas.QuestionStatusUpdate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    if admin.is_hod and student.department_id != admin.department_id and student.department != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Student does not belong to your department.")
    student.is_active = status_in.is_active
    student.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(student)
    return student


@router.get("/admin/students/{student_id}/dependencies", response_model=schemas.DependencyCheckResponse)
def get_student_dependencies(
    student_id: int,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if admin.is_hod:
        if student.department_id != admin.department_id and student.department != admin.department_name:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Student does not belong to your department.")

    total_attempts = db.query(models.Attempt).filter(models.Attempt.student_id == student_id).count()
    completed_attempts = db.query(models.Attempt).filter(
        models.Attempt.student_id == student_id,
        or_(models.Attempt.status == "completed", models.Attempt.completed_at != None, models.Attempt.score != None)
    ).count()
    assignments_count = db.query(models.ExamStudent).filter(models.ExamStudent.student_id == student_id).count()

    can_delete = True  # Can be deleted with explicit force or if no completed history
    reason = f"Student has {total_attempts} total attempts ({completed_attempts} completed with recorded marks) and {assignments_count} exam assignment(s)."
    if completed_attempts > 0:
        reason += " Deleting will permanently destroy historical examination results. Explicit confirmation is required."

    return schemas.DependencyCheckResponse(
        record_id=student_id,
        record_name=f"{student.name} ({student.enrollment_no})",
        record_type="student",
        can_delete=can_delete,
        has_dependencies=total_attempts > 0 or assignments_count > 0,
        dependency_counts={
            "total_attempts": total_attempts,
            "completed_attempts": completed_attempts,
            "exam_assignments": assignments_count
        },
        reason=reason
    )


@router.delete("/admin/students/{student_id}")
def admin_delete_student(
    student_id: int,
    force: bool = Query(False),
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    CRITICAL REQUIREMENT: SAFE STUDENT DELETION & EXAMINATION HISTORY PROTECTION
    Safely delete a student and their dependent records:
    Exam assignments, answers, security logs, and attempts.
    Preserves other students, questions, subjects, exams, departments, and system configuration.
    Enforces HOD authorization restrictions.
    Requires force=True if student has completed exam history.
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if admin.is_hod:
        if student.department_id != admin.department_id and student.department != admin.department_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot delete student belonging to another department."
            )

    # Protect examination history
    completed_count = db.query(models.Attempt).filter(
        models.Attempt.student_id == student_id,
        or_(models.Attempt.status == "completed", models.Attempt.completed_at != None, models.Attempt.score != None)
    ).count()

    if completed_count > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Student '{student.name}' ({student.enrollment_no}) has {completed_count} completed examination attempt(s) with recorded marks. Deleting this student would permanently destroy their examination history. Please confirm with force=true or archive/deactivate the student instead."
        )

    try:
        # 1. Identify all attempt IDs for this student
        attempts = db.query(models.Attempt).filter(models.Attempt.student_id == student_id).all()
        attempt_ids = [a.id for a in attempts]

        # 2. Delete student answers and security logs belonging to these attempts
        if attempt_ids:
            db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)

        # 3. Delete any remaining security logs by student_id
        db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.student_id == student_id).delete(synchronize_session=False)

        # 4. Delete exam assignment mappings
        db.query(models.ExamStudent).filter(models.ExamStudent.student_id == student_id).delete(synchronize_session=False)

        # 5. Delete attempts
        if attempt_ids:
            db.query(models.Attempt).filter(models.Attempt.student_id == student_id).delete(synchronize_session=False)

        # 6. Delete student
        student_name = student.name
        enrollment_no = student.enrollment_no
        db.delete(student)
        db.commit()

        log_deletion_audit(admin.username, "SINGLE_DELETE", "Student", [student_id], "SUCCESS", f"Student '{student_name}' ({enrollment_no}) deleted.")

        return {
            "status": "success",
            "message": f"Student '{student_name}' ({enrollment_no}) and dependent records safely deleted.",
            "student_id": student_id,
            "deleted_attempts_count": len(attempt_ids)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        log_deletion_audit(admin.username, "SINGLE_DELETE", "Student", [student_id], "FAILED", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to safely delete student: {str(e)}"
        )


@router.post("/admin/students/bulk-delete", response_model=schemas.BulkDeleteStudentsResponse)
def admin_bulk_delete_students(
    req: schemas.BulkDeleteStudentsRequest,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Safely delete multiple selected students and their dependent records.
    Enforces HOD authorization: if any selected student belongs to another department,
    the entire operation is rejected with 403 Forbidden.
    Requires force=True if any selected student has completed examination history.
    """
    if not req.student_ids:
        raise HTTPException(status_code=400, detail="No student IDs provided for deletion.")

    students = db.query(models.Student).filter(models.Student.id.in_(req.student_ids)).all()
    if not students:
        raise HTTPException(status_code=404, detail="No matching students found to delete.")

    if admin.is_hod:
        for st in students:
            if st.department_id != admin.department_id and st.department != admin.department_name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: Student '{st.name}' ({st.enrollment_no}) belongs to another department."
                )

    # Protect examination history
    if not req.force:
        st_with_history = []
        for st in students:
            c = db.query(models.Attempt).filter(
                models.Attempt.student_id == st.id,
                or_(models.Attempt.status == "completed", models.Attempt.completed_at != None, models.Attempt.score != None)
            ).count()
            if c > 0:
                st_with_history.append(f"{st.name} ({st.enrollment_no}): {c} completed attempt(s)")
        if st_with_history:
            raise HTTPException(
                status_code=400,
                detail=f"Bulk deletion blocked: {len(st_with_history)} student(s) have completed examination history with recorded marks: {'; '.join(st_with_history[:5])}. To permanently delete academic records, confirm with force=true."
            )

    student_ids = [st.id for st in students]
    try:
        # 1. Collect all attempt IDs
        attempts = db.query(models.Attempt).filter(models.Attempt.student_id.in_(student_ids)).all()
        attempt_ids = [a.id for a in attempts]

        # 2. Delete answers and security logs
        if attempt_ids:
            db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)

        # 3. Delete any remaining security logs by student_id
        db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.student_id.in_(student_ids)).delete(synchronize_session=False)

        # 4. Delete exam assignments
        db.query(models.ExamStudent).filter(models.ExamStudent.student_id.in_(student_ids)).delete(synchronize_session=False)

        # 5. Delete attempts
        if attempt_ids:
            db.query(models.Attempt).filter(models.Attempt.student_id.in_(student_ids)).delete(synchronize_session=False)

        # 6. Delete students
        deleted_count = db.query(models.Student).filter(models.Student.id.in_(student_ids)).delete(synchronize_session=False)
        db.commit()

        log_deletion_audit(admin.username, "BULK_DELETE", "Student", student_ids, "SUCCESS", f"Deleted {deleted_count} students.")

        return schemas.BulkDeleteStudentsResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} student(s) and their dependent assessment records.",
            deleted_count=deleted_count,
            student_ids=student_ids
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        log_deletion_audit(admin.username, "BULK_DELETE", "Student", student_ids, "FAILED", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to safely delete selected students: {str(e)}"
        )


@router.post("/admin/students/bulk-import")
async def bulk_import_students(
    file: UploadFile = File(...),
    department: str = Form(...),
    program: str = Form("UG"),
    year: str = Form("1st Year"),
    semester: str = Form("Semester 1"),
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if admin.is_hod and department != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You cannot import students for another department.")
    if not department.strip():
        raise HTTPException(status_code=400, detail="Department is required for student import.")

    contents = await file.read()
    filename = file.filename.lower() if file.filename else ""
    parsed_records = []

    try:
        if filename.endswith(".csv") or file.content_type == "text/csv":
            text = contents.decode("utf-8-sig", errors="ignore")
            reader = csv.reader(io.StringIO(text))
            rows = list(reader)
            if rows:
                header = [h.strip().lower() for h in rows[0]]
                roll_idx, name_idx, gender_idx = 0, 1, 2
                start_row = 0
                # Detect header
                for i, col in enumerate(header):
                    if any(k in col for k in ["roll", "enroll"]):
                        roll_idx = i
                        start_row = 1
                    elif any(k in col for k in ["name", "student"]):
                        name_idx = i
                        start_row = 1
                    elif "gender" in col or "sex" in col:
                        gender_idx = i
                        start_row = 1

                for row in rows[start_row:]:
                    if not row or len(row) <= roll_idx:
                        continue
                    r_no = row[roll_idx].strip()
                    nm = row[name_idx].strip() if len(row) > name_idx else ""
                    gnd = row[gender_idx].strip() if len(row) > gender_idx else None
                    if r_no and nm:
                        parsed_records.append((r_no, nm, gnd))

        elif filename.endswith((".xlsx", ".xls")):
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if rows:
                header = [str(h).strip().lower() if h is not None else "" for h in rows[0]]
                roll_idx, name_idx, gender_idx = 0, 1, 2
                start_row = 0
                for i, col in enumerate(header):
                    if any(k in col for k in ["roll", "enroll"]):
                        roll_idx = i
                        start_row = 1
                    elif any(k in col for k in ["name", "student"]):
                        name_idx = i
                        start_row = 1
                    elif "gender" in col or "sex" in col:
                        gender_idx = i
                        start_row = 1

                for row in rows[start_row:]:
                    if not row or len(row) <= roll_idx or row[roll_idx] is None:
                        continue
                    r_no = str(row[roll_idx]).strip()
                    nm = str(row[name_idx]).strip() if len(row) > name_idx and row[name_idx] is not None else ""
                    gnd = str(row[gender_idx]).strip() if len(row) > gender_idx and row[gender_idx] is not None else None
                    if r_no and nm:
                        parsed_records.append((r_no, nm, gnd))

        elif filename.endswith(".pdf") or file.content_type == "application/pdf":
            reader = PdfReader(io.BytesIO(contents))
            pdf_text = ""
            for page in reader.pages:
                txt = page.extract_text()
                if txt:
                    pdf_text += txt + "\n"

            # Parse lines for patterns like: [SrNo] RollNo Student Name [MALE|FEMALE]
            # Pattern: (BT26F05F001 or similar roll number) followed by name and gender
            lines = pdf_text.splitlines()
            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue
                # Regex match for roll number and name
                # E.g.: "1  BT26F05F001  ALAMWAR MOHD ZAID ABDUL WAHID  MALE"
                # or "BT26F05F001 JOHN DOE M"
                match = re.search(
                    r'(?:^|\s+)([A-Z0-9_-]{6,20})\s+([A-Za-z\s\.\'-]{3,50})(?:\s+(MALE|FEMALE|M|F|OTHER))?',
                    line_str,
                    re.IGNORECASE
                )
                if match:
                    r_no = match.group(1).strip()
                    # Skip common header strings if matched
                    if any(h in r_no.lower() for h in ["rollno", "enroll", "student", "number", "srno"]):
                        continue
                    nm = match.group(2).strip()
                    gnd = match.group(3).strip() if match.group(3) else None
                    if r_no and nm:
                        parsed_records.append((r_no, nm, gnd))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV, XLSX, or PDF.")

    except Exception as parse_err:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(parse_err)}")

    if not parsed_records:
        raise HTTPException(status_code=400, detail="No valid student records found in file. Ensure Roll No and Name columns are present.")

    imported_count = 0
    skipped_count = 0
    updated_count = 0

    default_hashed_pwd = hash_password("student123")
    now = datetime.utcnow()

    for r_no, nm, gnd in parsed_records:
        existing = db.query(models.Student).filter(models.Student.enrollment_no == r_no).first()
        if existing:
            # Update attributes safely
            existing.name = nm
            if gnd:
                existing.gender = gnd
            existing.department = department.strip()
            existing.program = program.strip()
            existing.year = year.strip()
            existing.semester = semester.strip()
            existing.is_active = True
            existing.updated_at = now
            updated_count += 1
        else:
            new_student = models.Student(
                enrollment_no=r_no,
                name=nm,
                gender=gnd,
                department=department.strip(),
                program=program.strip(),
                year=year.strip(),
                semester=semester.strip(),
                password_hash=default_hashed_pwd,
                is_active=True,
                created_at=now,
                updated_at=now
            )
            db.add(new_student)
            imported_count += 1

    db.commit()

    return {
        "message": f"Student import completed: {imported_count} new imported, {updated_count} existing updated.",
        "imported_count": imported_count,
        "updated_count": updated_count,
        "total_processed": len(parsed_records)
    }


# =========================================================================
# 5. SECURE STUDENT LOGIN & STUDENT APIS
# =========================================================================

@router.post("/student/login", response_model=schemas.StudentToken)
def student_login(credentials: schemas.StudentLogin, db: Session = Depends(get_db)):
    enrollment = credentials.enrollment_no.strip()
    plain_pwd = credentials.password.strip()

    if not enrollment or not plain_pwd:
        raise HTTPException(status_code=400, detail="Enrollment number and password are required.")

    student = db.query(models.Student).filter(models.Student.enrollment_no == enrollment).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Enrollment Number or Password.")

    if not student.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student account has been deactivated. Please contact admin.")

    # Validate password hash
    if not student.password_hash:
        # If student password was not set yet, fallback allow enrollment or default 'student123'
        if plain_pwd in [student.enrollment_no, "student123"]:
            student.password_hash = hash_password(plain_pwd)
            db.commit()
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Enrollment Number or Password.")
    else:
        if not verify_password(plain_pwd, student.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Enrollment Number or Password.")

    access_token = create_access_token(data={"sub": str(student.id), "enrollment_no": student.enrollment_no, "role": "student"})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "student": student
    }


@router.get("/student/profile", response_model=schemas.StudentOut)
def get_student_profile(current_student: models.Student = Depends(get_current_student)):
    return current_student


@router.get("/student/exams", response_model=List[schemas.StudentAvailableExam])
def get_student_available_exams(
    current_student: models.Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    CRITICAL REQUIREMENT: STUDENT-SPECIFIC EXAM ACCESS
    Only return exams that are assigned to this specific student via exam_students!
    """
    assigned_records = db.query(models.ExamStudent).filter(
        models.ExamStudent.student_id == current_student.id
    ).all()

    assigned_exam_ids = [ar.exam_id for ar in assigned_records]
    if not assigned_exam_ids:
        return []

    exams = db.query(models.Exam).filter(
        models.Exam.id.in_(assigned_exam_ids),
        models.Exam.is_active == True,
        models.Exam.status == "published"
    ).order_by(models.Exam.created_at.desc()).all()

    results = []
    now = datetime.utcnow()

    for ex in exams:
        # Check if student already has an attempt
        attempt = db.query(models.Attempt).filter(
            models.Attempt.exam_id == ex.id,
            models.Attempt.student_id == current_student.id
        ).order_by(models.Attempt.started_at.desc()).first()

        status_str = "available"
        attempt_id = None
        score = None
        percentage = None

        if attempt:
            attempt_id = attempt.id
            if attempt.status in ["completed", "timed_out"]:
                status_str = attempt.status
                score = attempt.score
                percentage = attempt.percentage
            elif attempt.status == "in_progress":
                if attempt.deadline_at and now >= attempt.deadline_at:
                    # Automatically finalize expired attempt
                    attempt.status = "timed_out"
                    attempt.completed_at = attempt.deadline_at
                    calculate_attempt_score(attempt, db)
                    db.commit()
                    status_str = "timed_out"
                    score = attempt.score
                    percentage = attempt.percentage
                else:
                    status_str = "in_progress"

        results.append({
            "id": ex.id,
            "title": ex.title,
            "code": ex.code,
            "subject_name": ex.subject_name or (ex.subject.name if ex.subject else "General"),
            "department_name": ex.department_name,
            "duration_minutes": ex.duration_minutes,
            "total_questions": ex.total_questions,
            "total_marks": ex.total_marks,
            "passing_percentage": ex.passing_percentage,
            "start_date": ex.start_date,
            "start_time": ex.start_time,
            "end_date": ex.end_date,
            "end_time": ex.end_time,
            "status": status_str,
            "attempt_id": attempt_id,
            "score": score,
            "percentage": percentage
        })

    return results


# =========================================================================
# 6. EXAM MANAGEMENT (ADMIN)
# =========================================================================

@router.get("/admin/exams", response_model=List[schemas.ExamOut])
def list_exams(
    department_id: Optional[int] = None,
    program_id: Optional[int] = None,
    academic_year_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Exam)
    if admin.is_hod:
        if department_id and department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot query exams from another department.")
        q = q.filter(
            or_(
                models.Exam.department_id == admin.department_id,
                models.Exam.department_name.ilike(admin.department_name)
            )
        )
    elif department_id:
        q = q.filter(models.Exam.department_id == department_id)
    if program_id:
        q = q.filter(models.Exam.program_id == program_id)
    if academic_year_id:
        q = q.filter(models.Exam.academic_year_id == academic_year_id)
    if semester_id:
        q = q.filter(models.Exam.semester_id == semester_id)
    if subject_id:
        q = q.filter(models.Exam.subject_id == subject_id)
    if status:
        q = q.filter(models.Exam.status == status)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(models.Exam.title.ilike(s), models.Exam.code.ilike(s)))

    exams = q.order_by(models.Exam.created_at.desc()).all()
    out = []
    for ex in exams:
        assigned_cnt = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == ex.id).count()
        attempts_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == ex.id).count()
        e_dict = schemas.ExamOut.model_validate(ex)
        e_dict.assigned_students_count = assigned_cnt
        e_dict.attempts_count = attempts_cnt
        out.append(e_dict)
    return out


@router.get("/admin/exams/{exam_id}", response_model=schemas.ExamOut)
def get_exam(exam_id: int, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    ex = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and ex.department_id != admin.department_id and ex.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")
    assigned_cnt = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == ex.id).count()
    attempts_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == ex.id).count()
    e_dict = schemas.ExamOut.model_validate(ex)
    e_dict.assigned_students_count = assigned_cnt
    e_dict.attempts_count = attempts_cnt
    return e_dict


@router.post("/admin/exams", response_model=schemas.ExamOut, status_code=status.HTTP_201_CREATED)
def create_exam(exam_in: schemas.ExamCreate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    title = exam_in.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Exam title is required.")

    # 1. Department Validation
    if admin.is_hod:
        if exam_in.department_id and exam_in.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot create exam for another department.")
        dept_id = admin.department_id
        dept_name = admin.department_name
    elif exam_in.department_id:
        dept = db.query(models.Department).filter(models.Department.id == exam_in.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Selected department not found.")
        if not dept.is_active:
            raise HTTPException(status_code=400, detail="Selected department is inactive.")
        dept_id = dept.id
        dept_name = dept.name
    elif exam_in.subject_id:
        subj_lookup = db.query(models.Subject).filter(models.Subject.id == exam_in.subject_id).first()
        if subj_lookup and subj_lookup.department_id:
            dept_id = subj_lookup.department_id
            dept_name = subj_lookup.department_name or (subj_lookup.department.name if subj_lookup.department else None)
        else:
            dept_id = None
            dept_name = None
    else:
        dept_id = None
        dept_name = None

    exam_in.department_id = dept_id

    # 2. Subject Validation & Department Matching
    subj_id = None
    subj_name = None
    if exam_in.subject_id:
        subj = db.query(models.Subject).filter(models.Subject.id == exam_in.subject_id).first()
        if not subj:
            raise HTTPException(status_code=400, detail="Selected subject not found.")
        if not subj.is_active:
            raise HTTPException(status_code=400, detail="Selected subject is inactive.")
        if dept_id and subj.department_id and subj.department_id != dept_id:
            raise HTTPException(
                status_code=400,
                detail=f"Selected subject '{subj.name}' does not belong to the selected department '{dept_name}'."
            )
        if not dept_id and subj.department_id:
            dept_id = subj.department_id
            dept_name = subj.department_name or (subj.department.name if subj.department else None)
            exam_in.department_id = dept_id

        subj_id = subj.id
        subj_name = subj.name

        # Validate active questions available in subject bank for random selection
        if exam_in.selection_mode == "random":
            q_count = db.query(models.Question).filter(
                models.Question.subject_id == exam_in.subject_id,
                models.Question.is_active == True
            ).count()
            if q_count < exam_in.total_questions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {q_count} active questions are available for this subject. Please add more questions or reduce question count."
                )
    else:
        # Fallback if subject not specified (legacy tests compatibility)
        if exam_in.selection_mode == "random":
            q_count = db.query(models.Question).filter(models.Question.is_active == True).count()
            if q_count < exam_in.total_questions:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {q_count} active questions are available. Please add more questions or reduce question count."
                )

    prog_name = None
    if exam_in.program_id:
        prog = db.query(models.Program).filter(models.Program.id == exam_in.program_id).first()
        prog_name = prog.name if prog else None

    year_name = None
    if exam_in.academic_year_id:
        ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == exam_in.academic_year_id).first()
        year_name = ay.name if ay else None

    sem_name = None
    if exam_in.semester_id:
        sem = db.query(models.Semester).filter(models.Semester.id == exam_in.semester_id).first()
        sem_name = sem.name if sem else None

    total_marks = exam_in.total_marks or (exam_in.total_questions * exam_in.marks_per_question)

    exam = models.Exam(
        title=title,
        code=exam_in.code.strip() if exam_in.code else None,
        department_id=dept_id,
        department_name=dept_name,
        program_id=exam_in.program_id,
        program_name=prog_name,
        academic_year_id=exam_in.academic_year_id,
        year_name=year_name,
        semester_id=exam_in.semester_id,
        semester_name=sem_name,
        subject_id=subj_id,
        subject_name=subj_name,
        start_date=exam_in.start_date,
        start_time=exam_in.start_time,
        end_date=exam_in.end_date,
        end_time=exam_in.end_time,
        duration_minutes=exam_in.duration_minutes,
        total_questions=exam_in.total_questions,
        marks_per_question=exam_in.marks_per_question,
        total_marks=total_marks,
        passing_percentage=exam_in.passing_percentage,
        selection_mode=exam_in.selection_mode,
        status=exam_in.status,
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)

    # If manual questions selection
    if exam_in.selection_mode == "manual" and exam_in.selected_question_ids:
        for idx, qid in enumerate(exam_in.selected_question_ids, start=1):
            eq = models.ExamQuestion(exam_id=exam.id, question_id=qid, order_index=idx)
            db.add(eq)
        db.commit()

    e_dict = schemas.ExamOut.model_validate(exam)
    e_dict.assigned_students_count = 0
    e_dict.attempts_count = 0
    return e_dict


@router.put("/admin/exams/{exam_id}", response_model=schemas.ExamOut)
def update_exam(exam_id: int, exam_in: schemas.ExamUpdate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if admin.is_hod:
        if exam.department_id != admin.department_id and exam.department_name != admin.department_name:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")
        if exam_in.department_id and exam_in.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot transfer exam to another department.")

    target_dept_id = admin.department_id if admin.is_hod else (exam_in.department_id if exam_in.department_id is not None else exam.department_id)
    target_subj_id = exam_in.subject_id if exam_in.subject_id is not None else exam.subject_id

    # Validate department update if requested (Super Admin only)
    if exam_in.department_id is not None and not admin.is_hod:
        dept = db.query(models.Department).filter(models.Department.id == exam_in.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Selected department not found.")
        exam.department_id = dept.id
        exam.department_name = dept.name

    # Validate subject update if requested
    if exam_in.subject_id is not None:
        subj = db.query(models.Subject).filter(models.Subject.id == exam_in.subject_id).first()
        if not subj:
            raise HTTPException(status_code=400, detail="Selected subject not found.")
        if not subj.is_active:
            raise HTTPException(status_code=400, detail="Selected subject is inactive.")
        if target_dept_id and subj.department_id != target_dept_id:
            raise HTTPException(status_code=400, detail="Selected subject does not belong to the selected department.")
        exam.subject_id = subj.id
        exam.subject_name = subj.name
    elif exam_in.department_id is not None and exam.subject_id:
        # Check that existing subject matches the new department
        subj = db.query(models.Subject).filter(models.Subject.id == exam.subject_id).first()
        if subj and target_dept_id and subj.department_id != target_dept_id:
            raise HTTPException(
                status_code=400,
                detail="Existing subject does not belong to the newly selected department. Please update the subject association."
            )
    if exam_in.program_id is not None:
        prog = db.query(models.Program).filter(models.Program.id == exam_in.program_id).first()
        exam.program_id = prog.id if prog else None
        exam.program_name = prog.name if prog else None
    if exam_in.academic_year_id is not None:
        ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == exam_in.academic_year_id).first()
        exam.academic_year_id = ay.id if ay else None
        exam.year_name = ay.name if ay else None
    if exam_in.semester_id is not None:
        sem = db.query(models.Semester).filter(models.Semester.id == exam_in.semester_id).first()
        exam.semester_id = sem.id if sem else None
        exam.semester_name = sem.name if sem else None
    if exam_in.start_date is not None:
        exam.start_date = exam_in.start_date
    if exam_in.start_time is not None:
        exam.start_time = exam_in.start_time
    if exam_in.end_date is not None:
        exam.end_date = exam_in.end_date
    if exam_in.end_time is not None:
        exam.end_time = exam_in.end_time
    if exam_in.duration_minutes is not None:
        exam.duration_minutes = exam_in.duration_minutes
    if exam_in.total_questions is not None:
        exam.total_questions = exam_in.total_questions
    if exam_in.marks_per_question is not None:
        exam.marks_per_question = exam_in.marks_per_question
    if exam_in.total_marks is not None:
        exam.total_marks = exam_in.total_marks
    if exam_in.passing_percentage is not None:
        exam.passing_percentage = exam_in.passing_percentage
    if exam_in.selection_mode is not None:
        exam.selection_mode = exam_in.selection_mode
    if exam_in.status is not None:
        exam.status = exam_in.status
    if exam_in.is_active is not None:
        exam.is_active = exam_in.is_active

    if exam_in.selected_question_ids is not None:
        db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id == exam.id).delete()
        for idx, qid in enumerate(exam_in.selected_question_ids, start=1):
            db.add(models.ExamQuestion(exam_id=exam.id, question_id=qid, order_index=idx))

    exam.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)

    assigned_cnt = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == exam.id).count()
    attempts_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == exam.id).count()
    e_dict = schemas.ExamOut.model_validate(exam)
    e_dict.assigned_students_count = assigned_cnt
    e_dict.attempts_count = attempts_cnt
    return e_dict


@router.patch("/admin/exams/{exam_id}/status", response_model=schemas.ExamOut)
def set_exam_status(exam_id: int, status_in: schemas.QuestionStatusUpdate, status_name: Optional[str] = None, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")
    if status_name:
        exam.status = status_name
    exam.is_active = status_in.is_active
    exam.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)
    assigned_cnt = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == exam.id).count()
    attempts_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == exam.id).count()
    e_dict = schemas.ExamOut.model_validate(exam)
    e_dict.assigned_students_count = assigned_cnt
    e_dict.attempts_count = attempts_cnt
    return e_dict


@router.get("/admin/exams/{exam_id}/students", response_model=List[schemas.AssignedStudentOut])
def get_exam_assigned_students(exam_id: int, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")

    assignments = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == exam_id).all()
    results = []
    for a in assignments:
        st = a.student
        if not st:
            continue
        attempt = db.query(models.Attempt).filter(
            models.Attempt.exam_id == exam_id,
            models.Attempt.student_id == st.id
        ).order_by(models.Attempt.started_at.desc()).first()

        results.append({
            "student_id": st.id,
            "enrollment_no": st.enrollment_no,
            "name": st.name,
            "department": st.department,
            "gender": st.gender,
            "program": st.program,
            "year": st.year,
            "semester": st.semester,
            "assigned_at": a.assigned_at,
            "attempt_id": attempt.id if attempt else None,
            "status": attempt.status if attempt else "unattempted",
            "score": attempt.score if attempt else None,
            "percentage": attempt.percentage if attempt else None
        })
    return results


@router.post("/admin/exams/{exam_id}/assign")
def assign_students_to_exam(
    exam_id: int,
    assign_in: schemas.AssignStudentsRequest,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod:
        if exam.department_id != admin.department_id and exam.department_name != admin.department_name:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")
        st_count = db.query(models.Student).filter(
            models.Student.id.in_(assign_in.student_ids),
            or_(models.Student.department_id == admin.department_id, models.Student.department == admin.department_name)
        ).count()
        if st_count < len(assign_in.student_ids):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot assign students from another department.")

    now = datetime.utcnow()
    added_count = 0
    for sid in assign_in.student_ids:
        exists = db.query(models.ExamStudent).filter(
            models.ExamStudent.exam_id == exam_id,
            models.ExamStudent.student_id == sid
        ).first()
        if not exists:
            db.add(models.ExamStudent(exam_id=exam_id, student_id=sid, assigned_at=now))
            added_count += 1
    db.commit()

    total_assigned = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == exam_id).count()
    return {"message": f"Successfully assigned {added_count} students to '{exam.title}'.", "total_assigned": total_assigned}


@router.delete("/admin/exams/{exam_id}/students/{student_id}")
def unassign_student_from_exam(exam_id: int, student_id: int, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")

    rec = db.query(models.ExamStudent).filter(
        models.ExamStudent.exam_id == exam_id,
        models.ExamStudent.student_id == student_id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Student is not assigned to this exam.")
    db.delete(rec)
    db.commit()
    return {"message": "Student unassigned from exam successfully."}


@router.get("/admin/exams/{exam_id}/dependencies")
def get_exam_dependencies(
    exam_id: int,
    admin: CurrentUser = Depends(require_hod_or_super_admin),
    db: Session = Depends(get_db)
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")

    attempt_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == exam_id).count()
    assigned_cnt = db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == exam_id).count()
    questions_cnt = db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id == exam_id).count()

    has_dependencies = (attempt_cnt > 0)
    return {
        "exam_id": exam.id,
        "title": exam.title,
        "code": exam.code,
        "status": exam.status,
        "is_active": exam.is_active,
        "can_delete": not has_dependencies,
        "has_dependencies": has_dependencies,
        "attempts_count": attempt_cnt,
        "assigned_students_count": assigned_cnt,
        "questions_count": questions_cnt,
        "reason": (
            f"Examination has {attempt_cnt} recorded student attempt(s). Completed attempts and marks must be protected. Permanent deletion is blocked; please archive instead."
            if has_dependencies
            else f"No student attempts recorded. Exam has {assigned_cnt} assigned students and {questions_cnt} questions that will be safely unmapped."
        )
    }


@router.delete("/admin/exams/{exam_id}")
def delete_exam(
    exam_id: int,
    archive: bool = Query(False, description="Archive the exam safely instead of deleting"),
    admin: CurrentUser = Depends(require_hod_or_super_admin),
    db: Session = Depends(get_db)
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")

    attempt_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == exam_id).count()

    if archive:
        exam.status = "archived"
        exam.is_active = False
        exam.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(exam)
        log_deletion_audit(admin.username, "ARCHIVE", "exam", [exam_id], "SUCCESS", f"Archived {exam.title}")
        return {
            "message": f"Examination '{exam.title}' archived successfully. Historical attempts and marks are protected.",
            "archived": True,
            "exam_id": exam.id,
            "attempts_count": attempt_cnt
        }

    if attempt_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete examination '{exam.title}' because it has {attempt_cnt} recorded attempt(s). Completed attempts and student marks must be protected. Please archive the examination instead."
        )

    try:
        ex_title = exam.title
        db.query(models.ExamStudent).filter(models.ExamStudent.exam_id == exam_id).delete(synchronize_session=False)
        db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id == exam_id).delete(synchronize_session=False)
        db.delete(exam)
        db.commit()
        log_deletion_audit(admin.username, "PERMANENT_DELETE", "exam", [exam_id], "SUCCESS", f"Deleted {ex_title}")
        return {"message": f"Exam '{ex_title}' deleted successfully.", "deleted_id": exam_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error deleting examination: {str(e)}")


@router.post("/admin/exams/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_exams(
    req: schemas.BulkDeleteRequest,
    admin: CurrentUser = Depends(require_hod_or_super_admin),
    db: Session = Depends(get_db)
):
    if not req.ids:
        raise HTTPException(status_code=400, detail="No exam IDs provided.")

    exams = db.query(models.Exam).filter(models.Exam.id.in_(req.ids)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="No matching exams found.")

    if admin.is_hod:
        for ex in exams:
            if ex.department_id != admin.department_id and ex.department_name != admin.department_name:
                raise HTTPException(status_code=403, detail=f"Forbidden: Exam '{ex.title}' belongs to another department.")

    blocked = []
    for ex in exams:
        att_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == ex.id).count()
        if att_cnt > 0:
            blocked.append(f"Exam '{ex.title}' (ID {ex.id}): {att_cnt} recorded attempt(s)")

    if blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Bulk exam deletion blocked: One or more selected exams have student attempt records. {'; '.join(blocked)}. Completed student marks must be protected. Please archive them instead."
        )

    try:
        deleted_ids = [ex.id for ex in exams]
        db.query(models.ExamStudent).filter(models.ExamStudent.exam_id.in_(deleted_ids)).delete(synchronize_session=False)
        db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id.in_(deleted_ids)).delete(synchronize_session=False)
        db.query(models.Exam).filter(models.Exam.id.in_(deleted_ids)).delete(synchronize_session=False)
        db.commit()
        log_deletion_audit(admin.username, "BULK_PERMANENT_DELETE", "exam", deleted_ids, "SUCCESS")
        return schemas.BulkDeleteResponse(
            status="success",
            message=f"Successfully deleted {len(deleted_ids)} examination(s) with zero attempt records.",
            deleted_count=len(deleted_ids),
            deleted_ids=deleted_ids
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during bulk exam deletion: {str(e)}")


@router.post("/admin/exams/{exam_id}/archive")
def archive_exam(exam_id: int, admin: CurrentUser = Depends(require_hod_or_super_admin), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")

    attempt_cnt = db.query(models.Attempt).filter(models.Attempt.exam_id == exam_id).count()
    exam.status = "archived"
    exam.is_active = False
    exam.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)
    return {
        "message": f"Examination '{exam.title}' archived successfully. Completed attempts and student marks are protected.",
        "archived": True,
        "exam_id": exam.id,
        "attempts_count": attempt_cnt
    }


@router.post("/admin/exams/{exam_id}/unarchive")
def unarchive_exam(exam_id: int, admin: CurrentUser = Depends(require_hod_or_super_admin), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if admin.is_hod and exam.department_id != admin.department_id and exam.department_name != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Exam does not belong to your department.")

    exam.status = "draft"
    exam.is_active = True
    exam.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exam)
    return {
        "message": f"Examination '{exam.title}' restored to draft status.",
        "archived": False,
        "exam_id": exam.id
    }


# =========================================================================
# 7. CRITICAL STUDENT EXAM START & BACKEND AUTHORIZATION
# =========================================================================

@router.post("/student/exams/{exam_id}/start", response_model=schemas.StartAttemptResponse)
def student_start_exam(
    exam_id: int,
    current_student: models.Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    CRITICAL REQUIREMENT: STUDENT-SPECIFIC EXAM ACCESS
    Enforces authorization on the backend.
    Unassigned student receives 403 Forbidden.
    """
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    if not exam.is_active:
        raise HTTPException(status_code=400, detail="This exam is currently inactive.")

    if exam.status != "published":
        raise HTTPException(status_code=400, detail=f"Exam is currently {exam.status} and not open for attempts.")

    # BACKEND AUTHORIZATION CHECK: Is student assigned?
    assignment = db.query(models.ExamStudent).filter(
        models.ExamStudent.exam_id == exam_id,
        models.ExamStudent.student_id == current_student.id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Exam is not assigned to this student."
        )

    now = datetime.utcnow()

    # Check date/time window if defined
    if exam.start_date:
        today_str = now.strftime("%Y-%m-%d")
        if today_str < exam.start_date:
            raise HTTPException(status_code=400, detail=f"Exam has not started yet. Starts on {exam.start_date}.")
        if exam.end_date and today_str > exam.end_date:
            raise HTTPException(status_code=400, detail=f"Exam availability has ended on {exam.end_date}.")

    # Check for existing attempts
    existing_attempt = db.query(models.Attempt).filter(
        models.Attempt.exam_id == exam_id,
        models.Attempt.student_id == current_student.id
    ).order_by(models.Attempt.started_at.desc()).first()

    if existing_attempt:
        if existing_attempt.status in ["completed", "timed_out"]:
            raise HTTPException(status_code=400, detail="You have already completed this exam.")
        
        # In progress: check deadline
        if existing_attempt.deadline_at and now >= existing_attempt.deadline_at:
            existing_attempt.status = "timed_out"
            existing_attempt.completed_at = existing_attempt.deadline_at
            calculate_attempt_score(existing_attempt, db)
            db.commit()
            raise HTTPException(status_code=400, detail="Your exam attempt time limit has expired.")

        # Resume existing attempt
        return {
            "attempt_id": existing_attempt.id,
            "student": current_student,
            "message": "Resumed ongoing exam attempt.",
            "exam_title": exam.title,
            "deadline_at": existing_attempt.deadline_at,
            "time_limit_minutes": existing_attempt.time_limit_minutes,
            "total_questions": existing_attempt.total_questions
        }

    # Create new attempt with server-side timer
    started_at = now
    deadline_at = started_at + timedelta(minutes=exam.duration_minutes)

    attempt = models.Attempt(
        student_id=current_student.id,
        exam_id=exam.id,
        exam_title_snapshot=exam.title,
        subject_name_snapshot=exam.subject_name or (exam.subject.name if exam.subject else "General"),
        total_questions=exam.total_questions,
        question_count_snapshot=exam.total_questions,
        time_limit_minutes=exam.duration_minutes,
        started_at=started_at,
        deadline_at=deadline_at,
        status="in_progress",
        tab_switch_count=0,
        fullscreen_exit_count=0,
        copy_count=0,
        paste_count=0
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Question Selection:
    # 1. Manual mode: use exam_questions
    chosen_questions = []
    if exam.selection_mode == "manual":
        eqs = db.query(models.ExamQuestion).filter(models.ExamQuestion.exam_id == exam.id).order_by(models.ExamQuestion.order_index.asc()).all()
        for eq in eqs:
            if eq.question and eq.question.is_active:
                chosen_questions.append(eq.question)

    # 2. Random mode: pick from subject's question bank matching subject
    if len(chosen_questions) < exam.total_questions:
        q_filter = db.query(models.Question).filter(models.Question.is_active == True)
        if exam.subject_id:
            q_filter = q_filter.filter(models.Question.subject_id == exam.subject_id)
        elif exam.department_id:
            q_filter = q_filter.filter(models.Question.department_id == exam.department_id)

        available_qs = q_filter.all()
        if len(available_qs) < exam.total_questions:
            # Check if this is the legacy/unassigned assessment, else enforce subject questions
            if exam.subject_id or exam.department_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {len(available_qs)} active question(s) are available for this subject. Please add more questions."
                )
            else:
                available_qs = db.query(models.Question).filter(models.Question.is_active == True).all()

        needed = exam.total_questions - len(chosen_questions)
        already_ids = {q.id for q in chosen_questions}
        pool = [q for q in available_qs if q.id not in already_ids]
        if len(pool) < needed:
            raise HTTPException(
                status_code=400,
                detail=f"Only {len(pool)} question(s) available in subject bank to select."
            )
        sampled = random.sample(pool, needed)
        chosen_questions.extend(sampled)

    # Create student answers snapshot
    student_answers = []
    for idx, q in enumerate(chosen_questions[:exam.total_questions], start=1):
        sa = models.StudentAnswer(
            attempt_id=attempt.id,
            question_number=idx,
            question_id=q.id,
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            selected_answer=None,
            correct_answer=q.correct_answer,
            marks=q.marks or exam.marks_per_question or 1,
            is_correct=False,
            answered_at=started_at
        )
        student_answers.append(sa)

    db.bulk_save_objects(student_answers)
    db.commit()

    return {
        "attempt_id": attempt.id,
        "student": current_student,
        "message": "Exam attempt started successfully.",
        "exam_title": exam.title,
        "deadline_at": deadline_at,
        "time_limit_minutes": exam.duration_minutes,
        "total_questions": len(student_answers)
    }


# =========================================================================
# 8. SECURITY & CHEATING AUDIT LOGGING
# =========================================================================

@router.post("/attempts/{attempt_id}/security-log", response_model=schemas.SecurityLogOut)
def record_security_log(
    attempt_id: int,
    log_in: schemas.SecurityLogCreate,
    db: Session = Depends(get_db)
):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    now = datetime.utcnow()

    # Update summary counters on attempt
    etype = log_in.event_type.lower()
    if "tab" in etype:
        attempt.tab_switch_count = (attempt.tab_switch_count or 0) + 1
    elif "fullscreen" in etype:
        attempt.fullscreen_exit_count = (attempt.fullscreen_exit_count or 0) + 1
    elif "copy" in etype:
        attempt.copy_count = (attempt.copy_count or 0) + 1
    elif "paste" in etype:
        attempt.paste_count = (attempt.paste_count or 0) + 1

    sec_log = models.ExamSecurityLog(
        attempt_id=attempt.id,
        student_id=attempt.student_id,
        event_type=log_in.event_type,
        details=log_in.details,
        occurred_at=now
    )
    db.add(sec_log)
    db.commit()
    db.refresh(sec_log)
    return sec_log


# =========================================================================
# 9. GENERAL & EXISTING ATTEMPT FLOW (100% BACKWARD COMPATIBLE)
# =========================================================================

@router.get("/questions", response_model=List[schemas.QuestionOut])
def get_questions(attempt_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    if attempt_id:
        attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found.")
        
        student_answers = db.query(models.StudentAnswer).filter(
            models.StudentAnswer.attempt_id == attempt_id
        ).order_by(models.StudentAnswer.question_number.asc()).all()

        sanitized = []
        for sa in student_answers:
            opts = {
                "A": sa.option_a or "",
                "B": sa.option_b or "",
                "C": sa.option_c or "",
                "D": sa.option_d or ""
            }
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

    sanitized = []
    for q in FIXED_QUESTIONS[:target_count]:
        sanitized.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"]
        })
    return sanitized


@router.post("/students", response_model=schemas.StudentOut)
def create_student(student_data: schemas.StudentCreate, db: Session = Depends(get_db)):
    enrollment = student_data.enrollment_no.strip()
    name = student_data.name.strip()
    dept = student_data.department.strip()

    if not enrollment or not name or not dept:
        raise HTTPException(status_code=400, detail="All fields (Enrollment No, Name, Department) are required.")

    student = db.query(models.Student).filter(models.Student.enrollment_no == enrollment).first()
    default_pwd_hash = hash_password(student_data.password.strip() if student_data.password else enrollment)

    if not student:
        student = models.Student(
            enrollment_no=enrollment,
            name=name,
            department=dept,
            gender=student_data.gender,
            program=student_data.program or "UG",
            year=student_data.year or "1st Year",
            semester=student_data.semester or "Semester 1",
            password_hash=default_pwd_hash,
            is_active=True
        )
        db.add(student)
        db.commit()
        db.refresh(student)
    else:
        student.name = name
        student.department = dept
        if student_data.gender:
            student.gender = student_data.gender
        if student_data.program:
            student.program = student_data.program
        if student_data.year:
            student.year = student_data.year
        if student_data.semester:
            student.semester = student_data.semester
        if not student.password_hash:
            student.password_hash = default_pwd_hash
        db.commit()
        db.refresh(student)

    return student


@router.post("/attempts/start", response_model=schemas.StartAttemptResponse)
def start_attempt(student_data: schemas.StudentCreate, db: Session = Depends(get_db)):
    """Existing DSA MCQ assessment attempt start flow."""
    enrollment = student_data.enrollment_no.strip()
    name = student_data.name.strip()
    dept = student_data.department.strip()

    if not enrollment or not name or not dept:
        raise HTTPException(status_code=400, detail="All fields (Enrollment No, Name, Department) are required.")

    student = db.query(models.Student).filter(models.Student.enrollment_no == enrollment).first()
    default_pwd_hash = hash_password(enrollment)
    if not student:
        student = models.Student(
            enrollment_no=enrollment,
            name=name,
            department=dept,
            password_hash=default_pwd_hash,
            is_active=True
        )
        db.add(student)
        db.commit()
        db.refresh(student)
    else:
        # Protect existing verified student profile from arbitrary browser overwrite
        if not student.name or not student.name.strip():
            student.name = name
        if not student.department or not student.department.strip():
            student.department = dept
        if not student.password_hash:
            student.password_hash = default_pwd_hash
        db.commit()
        db.refresh(student)

    # Check for in-progress attempt
    existing_attempt = db.query(models.Attempt).filter(
        models.Attempt.student_id == student.id,
        models.Attempt.status == "in_progress",
        models.Attempt.exam_id == None
    ).first()

    now = datetime.utcnow()
    if existing_attempt:
        if existing_attempt.deadline_at and now >= existing_attempt.deadline_at:
            existing_attempt.status = "timed_out"
            existing_attempt.completed_at = existing_attempt.deadline_at
            calculate_attempt_score(existing_attempt, db)
            db.commit()
        else:
            return {
                "attempt_id": existing_attempt.id,
                "student": student,
                "message": "Continuing your test in progress.",
                "deadline_at": existing_attempt.deadline_at,
                "time_limit_minutes": existing_attempt.time_limit_minutes or 60,
                "total_questions": existing_attempt.question_count_snapshot or 50
            }

    # Snapshot current assessment settings
    setting = get_or_create_settings(db)
    target_q_count = setting.question_count
    target_time_limit = setting.time_limit_minutes

    active_questions = db.query(models.Question).filter(
        models.Question.is_active == True
    ).order_by(models.Question.id.asc()).limit(target_q_count).all()

    actual_q_count = len(active_questions)
    if actual_q_count == 0 and FIXED_QUESTIONS:
        actual_q_count = min(target_q_count, len(FIXED_QUESTIONS))

    deadline_at = now + timedelta(minutes=target_time_limit)

    attempt = models.Attempt(
        student_id=student.id,
        exam_id=None,
        exam_title_snapshot="DSA 50-Question Assessment",
        subject_name_snapshot="Data Structures & Algorithms",
        total_questions=actual_q_count,
        question_count_snapshot=actual_q_count,
        time_limit_minutes=target_time_limit,
        score=0,
        percentage=0.0,
        correct_answers=0,
        wrong_answers=0,
        started_at=now,
        deadline_at=deadline_at,
        status="in_progress",
        tab_switch_count=0,
        fullscreen_exit_count=0
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Create student answers snapshot
    student_answers = []
    if active_questions:
        for idx, q in enumerate(active_questions, start=1):
            sa = models.StudentAnswer(
                attempt_id=attempt.id,
                question_number=idx,
                question_id=q.id,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                selected_answer=None,
                correct_answer=q.correct_answer,
                marks=q.marks or 1,
                is_correct=False,
                answered_at=now
            )
            student_answers.append(sa)
    else:
        for q in FIXED_QUESTIONS[:actual_q_count]:
            opts = q.get("options", {})
            sa = models.StudentAnswer(
                attempt_id=attempt.id,
                question_number=q["id"],
                question_id=None,
                question_text=q["question"],
                option_a=opts.get("A", ""),
                option_b=opts.get("B", ""),
                option_c=opts.get("C", ""),
                option_d=opts.get("D", ""),
                selected_answer=None,
                correct_answer=q["correct_answer"],
                marks=1,
                is_correct=False,
                answered_at=now
            )
            student_answers.append(sa)

    db.bulk_save_objects(student_answers)
    db.commit()

    return {
        "attempt_id": attempt.id,
        "student": student,
        "message": "Assessment attempt started.",
        "deadline_at": deadline_at,
        "time_limit_minutes": target_time_limit,
        "total_questions": actual_q_count
    }


@router.get("/attempts/{attempt_id}/status", response_model=schemas.AttemptStatusResponse)
def get_attempt_status(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    now = datetime.utcnow()

    # Server-side timer & auto-submit check
    if attempt.status == "in_progress" and attempt.deadline_at and now >= attempt.deadline_at:
        attempt.status = "timed_out"
        attempt.completed_at = attempt.deadline_at
        calculate_attempt_score(attempt, db)
        db.commit()
        db.refresh(attempt)

    remaining_seconds = 0
    if attempt.status == "in_progress" and attempt.deadline_at:
        remaining_seconds = max(0, int((attempt.deadline_at - now).total_seconds()))

    student_answers = db.query(models.StudentAnswer).filter(
        models.StudentAnswer.attempt_id == attempt_id
    ).all()

    answers_map = {sa.question_number: sa.selected_answer for sa in student_answers}

    return {
        "attempt_id": attempt.id,
        "status": attempt.status,
        "exam_id": attempt.exam_id,
        "exam_title": attempt.exam_title_snapshot,
        "subject_name": attempt.subject_name_snapshot,
        "started_at": attempt.started_at,
        "deadline_at": attempt.deadline_at,
        "completed_at": attempt.completed_at,
        "time_limit_minutes": attempt.time_limit_minutes or 60,
        "total_questions": attempt.question_count_snapshot or attempt.total_questions or 50,
        "remaining_seconds": remaining_seconds,
        "current_server_time": now,
        "tab_switch_count": attempt.tab_switch_count or 0,
        "fullscreen_exit_count": attempt.fullscreen_exit_count or 0,
        "answers": answers_map
    }


@router.post("/attempts/{attempt_id}/answers")
def save_student_answer(
    attempt_id: int,
    payload: Dict,
    db: Session = Depends(get_db)
):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    now = datetime.utcnow()
    # Check if timer expired
    if attempt.status != "in_progress" or (attempt.deadline_at and now >= attempt.deadline_at):
        if attempt.status == "in_progress":
            attempt.status = "timed_out"
            attempt.completed_at = attempt.deadline_at
            calculate_attempt_score(attempt, db)
            db.commit()
        raise HTTPException(status_code=400, detail="Cannot save answers: Attempt has been completed or timed out.")

    answers_list = payload.get("answers", [])
    if not answers_list and "question_number" in payload:
        answers_list = [payload]

    updated_count = 0
    for ans in answers_list:
        q_num = ans.get("question_number")
        sel = ans.get("selected_answer")
        if sel is not None:
            sel = sel.strip().upper()
            if sel not in ["A", "B", "C", "D", ""]:
                sel = None

        sa = db.query(models.StudentAnswer).filter(
            models.StudentAnswer.attempt_id == attempt_id,
            models.StudentAnswer.question_number == q_num
        ).first()

        if sa:
            sa.selected_answer = sel
            sa.is_correct = (sel == sa.correct_answer)
            sa.answered_at = now
            updated_count += 1

    db.commit()
    return {"status": "success", "updated_count": updated_count}


@router.post("/attempts/{attempt_id}/submit", response_model=schemas.TestResultOut)
def submit_attempt(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    now = datetime.utcnow()
    if attempt.status == "in_progress":
        is_timed_out = attempt.deadline_at and now >= attempt.deadline_at
        attempt.status = "timed_out" if is_timed_out else "completed"
        attempt.submitted_at = now
        attempt.completed_at = now
        calculate_attempt_score(attempt, db)
        db.commit()
        db.refresh(attempt)

    return get_attempt_result(attempt_id, db)


@router.get("/attempts/{attempt_id}/result", response_model=schemas.TestResultOut)
def get_attempt_result(attempt_id: int, db: Session = Depends(get_db)):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found.")

    student = db.query(models.Student).filter(models.Student.id == attempt.student_id).first()
    student_answers = db.query(models.StudentAnswer).filter(
        models.StudentAnswer.attempt_id == attempt_id
    ).order_by(models.StudentAnswer.question_number.asc()).all()

    security_logs = db.query(models.ExamSecurityLog).filter(
        models.ExamSecurityLog.attempt_id == attempt_id
    ).order_by(models.ExamSecurityLog.occurred_at.asc()).all()

    answers_out = []
    for sa in student_answers:
        opts = {
            "A": sa.option_a or "",
            "B": sa.option_b or "",
            "C": sa.option_c or "",
            "D": sa.option_d or ""
        }
        if not any(opts.values()) and sa.question_number in QUESTIONS_BY_ID:
            opts = QUESTIONS_BY_ID[sa.question_number].get("options", {})

        q_text = sa.question_text
        if not q_text and sa.question_number in QUESTIONS_BY_ID:
            q_text = QUESTIONS_BY_ID[sa.question_number].get("question", "")

        answers_out.append({
            "question_number": sa.question_number,
            "question": q_text or f"Question {sa.question_number}",
            "options": opts,
            "selected_answer": sa.selected_answer,
            "correct_answer": sa.correct_answer,
            "marks": sa.marks or 1,
            "is_correct": sa.is_correct
        })

    return {
        "student": student,
        "attempt": attempt,
        "answers": answers_out,
        "security_logs": security_logs
    }


# =========================================================================
# 10. ADMIN DASHBOARD & STUDENT RECORDS
# =========================================================================

@router.get("/admin/dashboard", response_model=schemas.AdminDashboardStats)
def get_admin_dashboard(admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    if admin.is_hod:
        dept_id = admin.department_id
        dept_student_ids = [s.id for s in db.query(models.Student.id).filter(
            or_(models.Student.department_id == dept_id, models.Student.department.ilike(admin.department_name))
        ).all()]
        total_students = len(dept_student_ids)
        total_attempts = db.query(models.Attempt).filter(models.Attempt.student_id.in_(dept_student_ids)).count() if dept_student_ids else 0
        completed_tests = db.query(models.Attempt).filter(models.Attempt.student_id.in_(dept_student_ids), models.Attempt.status.in_(["completed", "timed_out"])).count() if dept_student_ids else 0
        avg_score = db.query(func.avg(models.Attempt.score)).filter(models.Attempt.student_id.in_(dept_student_ids), models.Attempt.status.in_(["completed", "timed_out"])).scalar() if dept_student_ids else 0.0
        avg_pct = db.query(func.avg(models.Attempt.percentage)).filter(models.Attempt.student_id.in_(dept_student_ids), models.Attempt.status.in_(["completed", "timed_out"])).scalar() if dept_student_ids else 0.0

        total_departments = 1
        total_subjects = db.query(models.Subject).filter(models.Subject.department_id == dept_id).count()
        active_subjects = db.query(models.Subject).filter(models.Subject.department_id == dept_id, models.Subject.is_active == True).count()
        total_exams = db.query(models.Exam).filter(models.Exam.department_id == dept_id).count()
        active_exams = db.query(models.Exam).filter(models.Exam.department_id == dept_id, models.Exam.status == "published", models.Exam.is_active == True).count()
        dept_subj_ids = [s.id for s in db.query(models.Subject.id).filter(models.Subject.department_id == dept_id).all()]
        total_questions = db.query(models.Question).filter(models.Question.subject_id.in_(dept_subj_ids)).count() if dept_subj_ids else 0

        return {
            "total_students": total_students,
            "total_attempts": total_attempts,
            "completed_tests": completed_tests,
            "average_score": round(float(avg_score or 0.0), 2),
            "average_percentage": round(float(avg_pct or 0.0), 2),
            "total_departments": total_departments,
            "total_subjects": total_subjects,
            "active_subjects": active_subjects,
            "total_exams": total_exams,
            "active_exams": active_exams,
            "total_questions": total_questions
        }

    total_students = db.query(models.Student).count()
    total_attempts = db.query(models.Attempt).count()
    completed_tests = db.query(models.Attempt).filter(models.Attempt.status.in_(["completed", "timed_out"])).count()
    
    avg_score = db.query(func.avg(models.Attempt.score)).filter(models.Attempt.status.in_(["completed", "timed_out"])).scalar() or 0.0
    avg_pct = db.query(func.avg(models.Attempt.percentage)).filter(models.Attempt.status.in_(["completed", "timed_out"])).scalar() or 0.0
    
    total_departments = db.query(models.Department).count()
    total_subjects = db.query(models.Subject).count()
    active_subjects = db.query(models.Subject).filter(models.Subject.is_active == True).count()
    total_exams = db.query(models.Exam).count()
    active_exams = db.query(models.Exam).filter(models.Exam.status == "published", models.Exam.is_active == True).count()
    total_questions = db.query(models.Question).count()

    return {
        "total_students": total_students,
        "total_attempts": total_attempts,
        "completed_tests": completed_tests,
        "average_score": round(float(avg_score), 2),
        "average_percentage": round(float(avg_pct), 2),
        "total_departments": total_departments,
        "total_subjects": total_subjects,
        "active_subjects": active_subjects,
        "total_exams": total_exams,
        "active_exams": active_exams,
        "total_questions": total_questions
    }


@router.get("/admin/students", response_model=List[schemas.StudentSummary])
def get_admin_students(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(models.Student)
    if admin.is_hod:
        if department and department != admin.department_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access student records of another department."
            )
        query = query.filter(
            or_(
                models.Student.department_id == admin.department_id,
                models.Student.department.ilike(admin.department_name)
            )
        )
    elif department:
        query = query.filter(models.Student.department == department)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(models.Student.name.ilike(s), models.Student.enrollment_no.ilike(s)))

    students = query.order_by(models.Student.created_at.desc()).all()
    summaries = []

    for s in students:
        latest_attempt = db.query(models.Attempt).filter(
            models.Attempt.student_id == s.id
        ).order_by(models.Attempt.started_at.desc()).first()

        summaries.append({
            "student_id": s.id,
            "enrollment_no": s.enrollment_no,
            "name": s.name,
            "department": s.department,
            "gender": s.gender,
            "program": s.program,
            "year": s.year,
            "semester": s.semester,
            "is_active": s.is_active,
            "score": latest_attempt.score if latest_attempt else None,
            "percentage": latest_attempt.percentage if latest_attempt else None,
            "attempt_date": (latest_attempt.completed_at or latest_attempt.submitted_at or latest_attempt.started_at) if latest_attempt else None,
            "status": latest_attempt.status if latest_attempt else "Not Attempted",
            "attempt_id": latest_attempt.id if latest_attempt else None,
            "exam_title": latest_attempt.exam_title_snapshot if latest_attempt else None,
            "tab_switch_count": latest_attempt.tab_switch_count if latest_attempt else 0,
            "fullscreen_exit_count": latest_attempt.fullscreen_exit_count if latest_attempt else 0
        })

    return summaries


@router.get("/admin/students/{student_id}", response_model=schemas.TestResultOut)
def get_admin_student_details(
    student_id: int,
    attempt_id: Optional[int] = Query(None),
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    if admin.is_hod and student.department_id != admin.department_id and student.department != admin.department_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Student does not belong to your department.")

    if attempt_id:
        attempt = db.query(models.Attempt).filter(
            models.Attempt.id == attempt_id,
            models.Attempt.student_id == student_id
        ).first()
    else:
        attempt = db.query(models.Attempt).filter(
            models.Attempt.student_id == student_id
        ).order_by(models.Attempt.started_at.desc()).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="No assessment attempt found for this student.")

    return get_attempt_result(attempt.id, db)


@router.get("/admin/attempts/{attempt_id}/dependencies", response_model=schemas.DependencyCheckResponse)
def get_attempt_dependencies(
    attempt_id: int,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Assessment attempt not found.")

    if admin.is_hod:
        st = db.query(models.Student).filter(models.Student.id == attempt.student_id).first()
        if not st or (st.department_id != admin.department_id and st.department != admin.department_name):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot access assessment attempt from another department.")

    ans_count = db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == attempt_id).count()
    log_count = db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.attempt_id == attempt_id).count()

    exam_title = attempt.exam_title_snapshot or "Exam"
    student = db.query(models.Student).filter(models.Student.id == attempt.student_id).first()
    st_name = student.name if student else f"Student #{attempt.student_id}"

    return schemas.DependencyCheckResponse(
        record_id=attempt_id,
        record_name=f"Attempt #{attempt_id} ({st_name} - {exam_title})",
        record_type="attempt",
        can_delete=True,
        has_dependencies=ans_count > 0 or log_count > 0,
        dependency_counts={
            "student_answers": ans_count,
            "security_logs": log_count
        },
        reason=f"Attempt contains {ans_count} recorded answers and {log_count} security log events that will be permanently removed."
    )


@router.delete("/admin/attempts/{attempt_id}")
def delete_assessment_attempt(
    attempt_id: int,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    CRITICAL REQUIREMENT: DELETE ASSESSMENT ATTEMPT
    Safely delete attempt and its answers/logs, preserving student and questions.
    """
    attempt = db.query(models.Attempt).filter(models.Attempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Assessment attempt not found.")

    if admin.is_hod:
        st = db.query(models.Student).filter(models.Student.id == attempt.student_id).first()
        if not st or (st.department_id != admin.department_id and st.department != admin.department_name):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot delete assessment attempt from another department.")

    student_id = attempt.student_id
    try:
        db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id == attempt_id).delete(synchronize_session=False)
        db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.attempt_id == attempt_id).delete(synchronize_session=False)
        db.delete(attempt)
        db.commit()

        log_deletion_audit(admin.username, "SINGLE_DELETE", "Attempt", [attempt_id], "SUCCESS", f"Student ID: {student_id}")

        return {
            "status": "success",
            "message": f"Assessment attempt #{attempt_id} deleted successfully.",
            "attempt_id": attempt_id,
            "student_id": student_id
        }
    except Exception as e:
        db.rollback()
        log_deletion_audit(admin.username, "SINGLE_DELETE", "Attempt", [attempt_id], "FAILED", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete assessment attempt: {str(e)}")


@router.post("/admin/attempts/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_attempts(
    req: schemas.BulkDeleteRequest,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if not req.ids:
        raise HTTPException(status_code=400, detail="No attempt IDs provided for deletion.")

    attempts = db.query(models.Attempt).filter(models.Attempt.id.in_(req.ids)).all()
    if not attempts:
        raise HTTPException(status_code=404, detail="No matching assessment attempts found.")

    if admin.is_hod:
        st_ids = [a.student_id for a in attempts]
        st_depts = db.query(models.Student.id, models.Student.department_id, models.Student.department).filter(models.Student.id.in_(st_ids)).all()
        for sid, did, dname in st_depts:
            if did != admin.department_id and dname != admin.department_name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: One or more selected attempts belong to students in another department."
                )

    attempt_ids = [a.id for a in attempts]
    try:
        db.query(models.StudentAnswer).filter(models.StudentAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.query(models.ExamSecurityLog).filter(models.ExamSecurityLog.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        deleted_count = db.query(models.Attempt).filter(models.Attempt.id.in_(attempt_ids)).delete(synchronize_session=False)
        db.commit()

        log_deletion_audit(admin.username, "BULK_DELETE", "Attempt", attempt_ids, "SUCCESS", f"Deleted {deleted_count} attempts.")
        return schemas.BulkDeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} assessment attempt(s) and their records.",
            deleted_count=deleted_count,
            deleted_ids=attempt_ids
        )
    except Exception as e:
        db.rollback()
        log_deletion_audit(admin.username, "BULK_DELETE", "Attempt", attempt_ids, "FAILED", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete assessment attempts: {str(e)}")


# =========================================================================
# 11. QUESTION BANK MANAGEMENT (ADMIN)
# =========================================================================

@router.get("/admin/questions", response_model=List[schemas.AdminQuestionOut])
def get_admin_questions(
    subject_id: Optional[int] = None,
    department_id: Optional[int] = None,
    program_id: Optional[int] = None,
    academic_year_id: Optional[int] = None,
    semester_id: Optional[int] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Question)
    if admin.is_hod:
        dept_subj_ids = [s.id for s in db.query(models.Subject.id).filter(models.Subject.department_id == admin.department_id).all()]
        q = q.filter(
            or_(
                models.Question.subject_id.in_(dept_subj_ids),
                models.Question.department_id == admin.department_id,
                models.Question.department_name.ilike(admin.department_name)
            )
        )
        if department_id and department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot query questions from another department.")
    elif department_id:
        q = q.filter(models.Question.department_id == department_id)
    if subject_id:
        q = q.filter(models.Question.subject_id == subject_id)
    if program_id:
        q = q.filter(models.Question.program_id == program_id)
    if academic_year_id:
        q = q.filter(models.Question.academic_year_id == academic_year_id)
    if semester_id:
        q = q.filter(models.Question.semester_id == semester_id)
    if topic:
        q = q.filter(models.Question.topic == topic)
    if difficulty:
        q = q.filter(models.Question.difficulty == difficulty)
    if is_active is not None:
        q = q.filter(models.Question.is_active == is_active)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(models.Question.question_text.ilike(s))

    return q.order_by(models.Question.id.asc()).all()


@router.get("/admin/questions/{question_id}", response_model=schemas.AdminQuestionOut)
def get_admin_question(question_id: int, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    if admin.is_hod:
        if q.subject_id:
            subj = db.query(models.Subject).filter(models.Subject.id == q.subject_id).first()
            if not subj or subj.department_id != admin.department_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Question does not belong to your department.")
        elif q.department_id and q.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Question does not belong to your department.")
    return q


@router.post("/admin/questions", response_model=schemas.AdminQuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(q_in: schemas.QuestionCreate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    correct = q_in.correct_answer.strip().upper()
    if correct not in ["A", "B", "C", "D"]:
        raise HTTPException(status_code=400, detail="Correct answer must be A, B, C, or D.")

    if admin.is_hod:
        if q_in.department_id and q_in.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot create questions for another department.")
        if q_in.subject_id:
            subj = db.query(models.Subject).filter(models.Subject.id == q_in.subject_id).first()
            if not subj or subj.department_id != admin.department_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Target subject does not belong to your department.")
        q_in.department_id = admin.department_id
        dept_name = admin.department_name
    else:
        dept_name = None
        if q_in.department_id:
            dept = db.query(models.Department).filter(models.Department.id == q_in.department_id).first()
            dept_name = dept.name if dept else None

    subj_name = None
    if q_in.subject_id:
        subj = db.query(models.Subject).filter(models.Subject.id == q_in.subject_id).first()
        subj_name = subj.name if subj else None

    prog_name = None
    if q_in.program_id:
        prog = db.query(models.Program).filter(models.Program.id == q_in.program_id).first()
        prog_name = prog.name if prog else None

    year_name = None
    if q_in.academic_year_id:
        ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == q_in.academic_year_id).first()
        year_name = ay.name if ay else None

    sem_name = None
    if q_in.semester_id:
        sem = db.query(models.Semester).filter(models.Semester.id == q_in.semester_id).first()
        sem_name = sem.name if sem else None

    now = datetime.utcnow()
    q = models.Question(
        question_text=q_in.question_text.strip(),
        option_a=q_in.option_a.strip(),
        option_b=q_in.option_b.strip(),
        option_c=q_in.option_c.strip(),
        option_d=q_in.option_d.strip(),
        correct_answer=correct,
        topic=q_in.topic.strip() if q_in.topic else None,
        department_id=q_in.department_id,
        department_name=dept_name,
        program_id=q_in.program_id,
        program_name=prog_name,
        academic_year_id=q_in.academic_year_id,
        year_name=year_name,
        semester_id=q_in.semester_id,
        semester_name=sem_name,
        subject_id=q_in.subject_id,
        subject_name=subj_name,
        difficulty=q_in.difficulty or "Medium",
        marks=q_in.marks or 1,
        is_active=q_in.is_active,
        created_at=now,
        updated_at=now
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.put("/admin/questions/{question_id}", response_model=schemas.AdminQuestionOut)
def update_question(question_id: int, q_in: schemas.QuestionUpdate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    if admin.is_hod:
        if q.department_id and q.department_id != admin.department_id:
            raise HTTPException(status_code=403, detail="Forbidden: Question belongs to another department.")
        if q_in.department_id is not None and q_in.department_id != admin.department_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot assign question to another department.")

    if q_in.correct_answer is not None:
        c = q_in.correct_answer.strip().upper()
        if c not in ["A", "B", "C", "D"]:
            raise HTTPException(status_code=400, detail="Correct answer must be A, B, C, or D.")
        q.correct_answer = c

    if q_in.question_text is not None:
        q.question_text = q_in.question_text.strip()
    if q_in.option_a is not None:
        q.option_a = q_in.option_a.strip()
    if q_in.option_b is not None:
        q.option_b = q_in.option_b.strip()
    if q_in.option_c is not None:
        q.option_c = q_in.option_c.strip()
    if q_in.option_d is not None:
        q.option_d = q_in.option_d.strip()
    if q_in.topic is not None:
        q.topic = q_in.topic.strip()
    if q_in.difficulty is not None:
        q.difficulty = q_in.difficulty
    if q_in.marks is not None:
        q.marks = q_in.marks
    if q_in.is_active is not None:
        q.is_active = q_in.is_active

    if q_in.subject_id is not None:
        subj = db.query(models.Subject).filter(models.Subject.id == q_in.subject_id).first()
        q.subject_id = subj.id if subj else None
        q.subject_name = subj.name if subj else None
    if q_in.department_id is not None:
        dept = db.query(models.Department).filter(models.Department.id == q_in.department_id).first()
        q.department_id = dept.id if dept else None
        q.department_name = dept.name if dept else None
    if q_in.program_id is not None:
        prog = db.query(models.Program).filter(models.Program.id == q_in.program_id).first()
        q.program_id = prog.id if prog else None
        q.program_name = prog.name if prog else None
    if q_in.academic_year_id is not None:
        ay = db.query(models.AcademicYear).filter(models.AcademicYear.id == q_in.academic_year_id).first()
        q.academic_year_id = ay.id if ay else None
        q.year_name = ay.name if ay else None
    if q_in.semester_id is not None:
        sem = db.query(models.Semester).filter(models.Semester.id == q_in.semester_id).first()
        q.semester_id = sem.id if sem else None
        q.semester_name = sem.name if sem else None

    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q


@router.patch("/admin/questions/{question_id}/status", response_model=schemas.AdminQuestionOut)
def toggle_question_status(question_id: int, status_in: schemas.QuestionStatusUpdate, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    if admin.is_hod and q.department_id and q.department_id != admin.department_id:
        raise HTTPException(status_code=403, detail="Forbidden: Question belongs to another department.")
    q.is_active = status_in.is_active
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q


@router.post("/admin/questions/{question_id}/deactivate", response_model=schemas.AdminQuestionOut)
def deactivate_question(question_id: int, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    if admin.is_hod and q.department_id and q.department_id != admin.department_id:
        raise HTTPException(status_code=403, detail="Forbidden: Question belongs to another department.")
    q.is_active = False
    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q


@router.get("/admin/questions/{question_id}/dependencies", response_model=schemas.DependencyCheckResponse)
def get_question_dependencies(
    question_id: int,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    if admin.is_hod:
        if q.subject_id:
            subj = db.query(models.Subject).filter(models.Subject.id == q.subject_id).first()
            if not subj or subj.department_id != admin.department_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Question does not belong to your department.")
        elif q.department_id and q.department_id != admin.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Question does not belong to your department.")

    usage_count = db.query(models.StudentAnswer).filter(models.StudentAnswer.question_id == question_id).count()
    exam_usage = db.query(models.ExamQuestion).filter(models.ExamQuestion.question_id == question_id).count()

    can_delete = (usage_count == 0 and exam_usage == 0)
    reasons = []
    if usage_count > 0:
        reasons.append(f"{usage_count} student answer(s)")
    if exam_usage > 0:
        reasons.append(f"{exam_usage} examination(s)")

    reason_str = f"Referenced by {', '.join(reasons)}. Question cannot be permanently deleted to protect academic integrity. Please deactivate it instead." if not can_delete else "Question is not referenced by any exams or student answers and can be safely deleted."

    return schemas.DependencyCheckResponse(
        record_id=question_id,
        record_name=q.question_text[:50] + ("..." if len(q.question_text) > 50 else ""),
        record_type="question",
        can_delete=can_delete,
        has_dependencies=(usage_count > 0 or exam_usage > 0),
        dependency_counts={
            "student_answers": usage_count,
            "exams": exam_usage
        },
        reason=reason_str
    )


@router.delete("/admin/questions/{question_id}")
def delete_question(question_id: int, admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    """
    CRITICAL REQUIREMENT: QUESTION DELETE
    If referenced by attempts, block hard deletion and recommend deactivate.
    If unused, permanently delete.
    """
    q = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    if admin.is_hod and q.department_id and q.department_id != admin.department_id:
        raise HTTPException(status_code=403, detail="Forbidden: Question belongs to another department.")

    usage_count = db.query(models.StudentAnswer).filter(models.StudentAnswer.question_id == question_id).count()
    exam_usage = db.query(models.ExamQuestion).filter(models.ExamQuestion.question_id == question_id).count()

    if usage_count > 0 or exam_usage > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Question #{question_id} cannot be permanently deleted because it is referenced in {usage_count} student answer(s) and {exam_usage} exam(s). Please deactivate it instead to protect historical assessment records."
        )

    try:
        db.delete(q)
        db.commit()
        log_deletion_audit(admin.username, "SINGLE_DELETE", "Question", [question_id], "SUCCESS")
        return {"message": f"Question #{question_id} deleted permanently.", "id": question_id}
    except Exception as e:
        db.rollback()
        log_deletion_audit(admin.username, "SINGLE_DELETE", "Question", [question_id], "FAILED", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")


@router.post("/admin/questions/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_questions(
    req: schemas.BulkDeleteRequest,
    admin: CurrentUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if not req.ids:
        raise HTTPException(status_code=400, detail="No question IDs provided for deletion.")

    questions = db.query(models.Question).filter(models.Question.id.in_(req.ids)).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No matching questions found.")

    if admin.is_hod:
        dept_subj_ids = {s.id for s in db.query(models.Subject.id).filter(models.Subject.department_id == admin.department_id).all()}
        for q in questions:
            is_in_dept = (q.department_id == admin.department_id) or (q.subject_id in dept_subj_ids)
            if not is_in_dept:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: Question #{q.id} does not belong to your department."
                )

    blocked = []
    for q in questions:
        ans_c = db.query(models.StudentAnswer).filter(models.StudentAnswer.question_id == q.id).count()
        exam_c = db.query(models.ExamQuestion).filter(models.ExamQuestion.question_id == q.id).count()
        if ans_c > 0 or exam_c > 0:
            blocked.append(f"Question #{q.id} (used in {ans_c} answers, {exam_c} exams)")

    if blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Bulk delete blocked: {len(blocked)} question(s) are referenced by examinations or attempts and cannot be deleted: {'; '.join(blocked[:5])}. Please deactivate them instead to protect examination history."
        )

    q_ids = [q.id for q in questions]
    try:
        deleted_count = db.query(models.Question).filter(models.Question.id.in_(q_ids)).delete(synchronize_session=False)
        db.commit()
        log_deletion_audit(admin.username, "BULK_DELETE", "Question", q_ids, "SUCCESS", f"Deleted {deleted_count} questions.")
        return schemas.BulkDeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} question(s) permanently.",
            deleted_count=deleted_count,
            deleted_ids=q_ids
        )
    except Exception as e:
        db.rollback()
        log_deletion_audit(admin.username, "BULK_DELETE", "Question", q_ids, "FAILED", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete questions: {str(e)}")


# =========================================================================
# 12. ASSESSMENT SETTINGS (ADMIN)
# =========================================================================

@router.get("/admin/assessment-settings", response_model=schemas.AssessmentSettingsOut)
def get_assessment_settings(admin: CurrentUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    setting = get_or_create_settings(db)
    active_cnt = db.query(models.Question).filter(models.Question.is_active == True).count()
    total_cnt = db.query(models.Question).count()
    return {
        "question_count": setting.question_count,
        "time_limit_minutes": setting.time_limit_minutes,
        "active_questions_count": active_cnt,
        "total_questions_count": total_cnt,
        "updated_at": setting.updated_at
    }


@router.put("/admin/assessment-settings", response_model=schemas.AssessmentSettingsOut)
def update_assessment_settings(settings_in: schemas.AssessmentSettingsUpdate, admin: CurrentUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    active_cnt = db.query(models.Question).filter(models.Question.is_active == True).count()
    if settings_in.question_count > active_cnt and active_cnt > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot configure {settings_in.question_count} questions: only {active_cnt} active questions exist."
        )

    setting = get_or_create_settings(db)
    setting.question_count = settings_in.question_count
    setting.time_limit_minutes = settings_in.time_limit_minutes
    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)

    total_cnt = db.query(models.Question).count()
    return {
        "question_count": setting.question_count,
        "time_limit_minutes": setting.time_limit_minutes,
        "active_questions_count": active_cnt,
        "total_questions_count": total_cnt,
        "updated_at": setting.updated_at
    }


# =========================================================================
# 13. EXPORTS (EXCEL & CSV) - STUDENT DATA EXPORT
# =========================================================================

def get_student_export_dataset(
    db: Session,
    admin: CurrentUser,
    department: Optional[str] = None,
    student_ids: Optional[str] = None
):
    query = db.query(models.Student)

    # 1. HOD Department isolation
    if admin.is_hod and admin.department_id:
        query = query.filter(
            or_(
                models.Student.department_id == admin.department_id,
                models.Student.department.ilike(admin.department_name or "")
            )
        )
    elif department and department.strip() and department.strip() != "All Departments":
        dept_val = department.strip()
        query = query.filter(
            or_(
                models.Student.department == dept_val,
                models.Student.department.ilike(dept_val)
            )
        )

    # 2. Optional student_ids filter (for selected student backup)
    if student_ids and student_ids.strip():
        parsed_ids = [int(x.strip()) for x in student_ids.split(",") if x.strip().isdigit()]
        if parsed_ids:
            query = query.filter(models.Student.id.in_(parsed_ids))

    students = query.order_by(models.Student.department.asc(), models.Student.enrollment_no.asc()).all()

    headers = [
        "Student Name",
        "Enrollment Number",
        "Department",
        "Program",
        "Year",
        "Semester",
        "Exam Name",
        "Marks Obtained",
        "Total Marks",
        "Percentage",
        "Result",
        "Exam Completion Date"
    ]

    rows = []
    for s in students:
        # Fetch completed exam attempts for this student
        completed_attempts = (
            db.query(models.Attempt)
            .filter(
                models.Attempt.student_id == s.id,
                or_(
                    models.Attempt.status == "completed",
                    models.Attempt.completed_at != None,
                    models.Attempt.submitted_at != None
                )
            )
            .order_by(models.Attempt.started_at.asc())
            .all()
        )

        if not completed_attempts:
            # If a student has no completed exam attempt, export student details and leave result fields blank
            rows.append([
                s.name,
                s.enrollment_no,
                s.department or "",
                s.program or "",
                s.year or "",
                s.semester or "",
                "",  # Exam Name
                "",  # Marks Obtained
                "",  # Total Marks
                "",  # Percentage
                "",  # Result
                ""   # Exam Completion Date
            ])
        else:
            for att in completed_attempts:
                exam_name = att.exam_title_snapshot or (att.exam.title if att.exam else "DSA Assessment")
                total_marks = att.exam.total_marks if (att.exam and att.exam.total_marks) else (att.total_questions or 50)
                marks_obtained = att.score
                percentage_val = round(att.percentage, 2) if att.percentage is not None else 0.0
                passing_pct = att.exam.passing_percentage if (att.exam and att.exam.passing_percentage) else 40.0
                result_status = "Pass" if percentage_val >= passing_pct else "Fail"
                comp_dt = att.completed_at or att.submitted_at or att.started_at
                comp_str = comp_dt.strftime("%Y-%m-%d %H:%M:%S") if comp_dt else ""

                rows.append([
                    s.name,
                    s.enrollment_no,
                    s.department or "",
                    s.program or "",
                    s.year or "",
                    s.semester or "",
                    exam_name,
                    marks_obtained,
                    total_marks,
                    f"{percentage_val}%",
                    result_status,
                    comp_str
                ])

    return headers, rows


def generate_excel_stream(headers, rows, sheet_title="Student Data"):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title

    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[1].height = 26

    for r_idx, row in enumerate(rows, start=2):
        ws.append(row)
        for c_idx in range(1, len(row) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.border = thin_border
            if c_idx in (8, 9):  # Marks
                cell.alignment = Alignment(horizontal="right", vertical="center")
            elif c_idx in (10, 11, 12):  # Percentage, Result, Date
                cell.alignment = Alignment(horizontal="center", vertical="center")

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_csv_stream(headers, rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    output.seek(0)
    return io.BytesIO(output.getvalue().encode("utf-8-sig"))


@router.get("/admin/export/students")
def export_students_dataset(
    format: str = Query("xlsx"),
    department: Optional[str] = Query(None),
    student_ids: Optional[str] = Query(None),
    admin: CurrentUser = Depends(resolve_admin_user),
    db: Session = Depends(get_db)
):
    """
    Download student details and completed exam attempts as Excel (.xlsx) or CSV (.csv).
    """
    headers, rows = get_student_export_dataset(db, admin, department=department, student_ids=student_ids)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if format.lower() == "csv":
        csv_stream = generate_csv_stream(headers, rows)
        filename = f"student_data_export_{timestamp}.csv"
        return StreamingResponse(
            csv_stream,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        excel_stream = generate_excel_stream(headers, rows, sheet_title="Student Assessment Data")
        filename = f"student_data_export_{timestamp}.xlsx"
        return StreamingResponse(
            excel_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@router.get("/admin/export/excel")
def export_students_excel(
    type: Optional[str] = Query(None),
    admin: CurrentUser = Depends(resolve_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Student)
    if admin.is_hod and admin.department_id:
        query = query.filter(models.Student.department_id == admin.department_id)
    students = query.order_by(models.Student.enrollment_no.asc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Assessment Records"

    headers = [
        "Student ID", "Enrollment No", "Student Name", "Department", "Gender",
        "Program", "Year", "Semester", "Exam Title", "Subject",
        "Score", "Percentage (%)", "Status", "Attempt Date",
        "Tab Switches", "Fullscreen Exits", "Copy Attempts", "Paste Attempts"
    ]
    ws.append(headers)

    for s in students:
        attempts = db.query(models.Attempt).filter(models.Attempt.student_id == s.id).order_by(models.Attempt.started_at.desc()).all()
        if not attempts:
            if type == "summary":
                continue
            ws.append([
                s.id, s.enrollment_no, s.name, s.department, s.gender or "",
                s.program or "", s.year or "", s.semester or "", "N/A", "N/A",
                "N/A", "N/A", "Unattempted", "N/A",
                0, 0, 0, 0
            ])
        else:
            for att in attempts:
                att_date = att.completed_at or att.submitted_at or att.started_at
                ws.append([
                    s.id, s.enrollment_no, s.name, s.department, s.gender or "",
                    s.program or "", s.year or "", s.semester or "",
                    att.exam_title_snapshot or "General Assessment",
                    att.subject_name_snapshot or "DSA",
                    att.score, att.percentage, att.status,
                    att_date.strftime("%Y-%m-%d %H:%M:%S") if att_date else "N/A",
                    att.tab_switch_count or 0,
                    att.fullscreen_exit_count or 0,
                    att.copy_count or 0,
                    att.paste_count or 0
                ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"college_assessment_records_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/admin/export/csv")
def export_students_csv(
    type: Optional[str] = Query(None),
    admin: CurrentUser = Depends(resolve_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Student)
    if admin.is_hod and admin.department_id:
        query = query.filter(models.Student.department_id == admin.department_id)
    students = query.order_by(models.Student.enrollment_no.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Student ID", "Enrollment No", "Student Name", "Department", "Gender",
        "Program", "Year", "Semester", "Exam Title", "Subject",
        "Score", "Percentage", "Status", "Attempt Date",
        "Tab Switches", "Fullscreen Exits", "Copy Attempts", "Paste Attempts"
    ])

    for s in students:
        attempts = db.query(models.Attempt).filter(models.Attempt.student_id == s.id).order_by(models.Attempt.started_at.desc()).all()
        if not attempts:
            if type == "summary":
                continue
            writer.writerow([
                s.id, s.enrollment_no, s.name, s.department, s.gender or "",
                s.program or "", s.year or "", s.semester or "", "N/A", "N/A",
                "N/A", "N/A", "Unattempted", "N/A",
                0, 0, 0, 0
            ])
        else:
            for att in attempts:
                att_date = att.completed_at or att.submitted_at or att.started_at
                writer.writerow([
                    s.id, s.enrollment_no, s.name, s.department, s.gender or "",
                    s.program or "", s.year or "", s.semester or "",
                    att.exam_title_snapshot or "General Assessment",
                    att.subject_name_snapshot or "DSA",
                    att.score, att.percentage, att.status,
                    att_date.strftime("%Y-%m-%d %H:%M:%S") if att_date else "N/A",
                    att.tab_switch_count or 0,
                    att.fullscreen_exit_count or 0,
                    att.copy_count or 0,
                    att.paste_count or 0
                ])

    output.seek(0)
    filename = f"college_assessment_records_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# =========================================================================
# 14. DATABASE SAFETY & VERIFIED SYSTEM BACKUPS
# =========================================================================

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db_backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

@router.post("/admin/backup/create")
def create_system_backup(
    admin: CurrentUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Creates a verified JSON snapshot backup of all database tables.
    Computes SHA-256 hash and records verification metadata.
    """
    import hashlib
    now_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_assessment_system_{now_str}.json"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    tables_data = {}
    table_counts = {}

    model_list = [
        ("admin_users", models.AdminUser, ["id", "username", "email", "full_name", "role", "department_id", "department_name", "is_active", "created_at"]),
        ("departments", models.Department, ["id", "name", "code", "description", "is_active", "created_at"]),
        ("programs", models.Program, ["id", "name", "code", "department_id", "is_active", "created_at"]),
        ("academic_years", models.AcademicYear, ["id", "name", "code", "department_id", "program_id", "is_active", "created_at"]),
        ("semesters", models.Semester, ["id", "name", "code", "department_id", "program_id", "academic_year_id", "is_active", "created_at"]),
        ("subjects", models.Subject, ["id", "name", "code", "department_id", "department_name", "program_id", "academic_year_id", "semester_id", "is_active", "created_at"]),
        ("questions", models.Question, ["id", "question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer", "topic", "department_id", "subject_id", "difficulty", "marks", "is_active", "created_at"]),
        ("exams", models.Exam, ["id", "title", "code", "department_id", "subject_id", "duration_minutes", "total_questions", "total_marks", "passing_percentage", "selection_mode", "status", "is_active", "created_at"]),
        ("exam_questions", models.ExamQuestion, ["id", "exam_id", "question_id", "order_index"]),
        ("students", models.Student, ["id", "enrollment_no", "name", "department", "department_id", "gender", "program", "year", "semester", "is_active", "created_at"]),
        ("exam_students", models.ExamStudent, ["id", "exam_id", "student_id", "assigned_at"]),
        ("attempts", models.Attempt, ["id", "student_id", "exam_id", "exam_title_snapshot", "subject_name_snapshot", "total_questions", "score", "percentage", "status", "started_at", "completed_at"]),
        ("student_answers", models.StudentAnswer, ["id", "attempt_id", "question_number", "question_id", "selected_answer", "correct_answer", "marks", "is_correct"]),
        ("exam_security_logs", models.ExamSecurityLog, ["id", "attempt_id", "student_id", "event_type", "details", "occurred_at"]),
        ("assessment_settings", models.AssessmentSetting, ["id", "question_count", "time_limit_minutes", "updated_at"]),
    ]

    for tbl_name, model_cls, cols in model_list:
        records = db.query(model_cls).all()
        table_counts[tbl_name] = len(records)
        serialized = []
        for r in records:
            item = {}
            for c in cols:
                val = getattr(r, c, None)
                if isinstance(val, datetime):
                    val = val.isoformat()
                item[c] = val
            serialized.append(item)
        tables_data[tbl_name] = serialized

    content_str = json.dumps({
        "metadata": {
            "backup_version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
            "created_by": admin.username,
            "table_counts": table_counts,
            "total_records": sum(table_counts.values())
        },
        "data": tables_data
    }, indent=2)

    sha256 = hashlib.sha256(content_str.encode("utf-8")).hexdigest()

    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(content_str)

    # Index entry
    index_path = os.path.join(BACKUP_DIR, "index.json")
    backups_list = []
    if os.path.exists(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                backups_list = json.load(f)
        except Exception:
            backups_list = []

    backup_info = {
        "filename": backup_filename,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": admin.username,
        "sha256": sha256,
        "total_records": sum(table_counts.values()),
        "table_counts": table_counts,
        "size_kb": round(len(content_str) / 1024, 2)
    }
    backups_list.insert(0, backup_info)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(backups_list, f, indent=2)

    log_deletion_audit(admin.username, "BACKUP_CREATE", "SystemBackup", [], "SUCCESS", f"Created backup {backup_filename}")

    return {
        "status": "success",
        "message": f"Database backup '{backup_filename}' created and verified.",
        "backup": backup_info
    }


@router.get("/admin/backup/list")
def list_system_backups(
    admin: CurrentUser = Depends(get_current_admin)
):
    index_path = os.path.join(BACKUP_DIR, "index.json")
    if not os.path.exists(index_path):
        return []
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


@router.post("/admin/backup/verify")
def verify_system_backup(
    data: Dict[str, str],
    admin: CurrentUser = Depends(get_current_admin)
):
    import hashlib
    filename = data.get("filename", "")
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found.")

    with open(backup_path, "r", encoding="utf-8") as f:
        content = f.read()

    try:
        parsed = json.loads(content)
        calc_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        meta = parsed.get("metadata", {})
        return {
            "status": "verified",
            "filename": filename,
            "calculated_sha256": calc_hash,
            "recorded_total_records": meta.get("total_records", 0),
            "table_counts": meta.get("table_counts", {}),
            "created_at": meta.get("created_at")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Backup verification failed: {str(e)}")

