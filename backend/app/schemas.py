from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from datetime import datetime


# ==========================================
# 1. Department Schemas
# ==========================================
class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None

class DepartmentOut(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DepartmentStats(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    is_active: bool = True
    students_count: int = 0
    active_subjects_count: int = 0
    exams_count: int = 0
    active_exams_count: int = 0

    class Config:
        from_attributes = True


# ==========================================
# 2. Academic Structure Schemas
# ==========================================
class ProgramOut(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True

class AcademicYearOut(BaseModel):
    id: int
    program_id: int
    name: str
    year_number: int
    is_active: bool = True

    class Config:
        from_attributes = True

class SemesterOut(BaseModel):
    id: int
    program_id: int
    academic_year_id: int
    name: str
    semester_number: int
    is_active: bool = True

    class Config:
        from_attributes = True

class AcademicStructureResponse(BaseModel):
    departments: List[DepartmentOut]
    programs: List[ProgramOut]
    years: List[AcademicYearOut]
    semesters: List[SemesterOut]


# ==========================================
# 3. Subject Schemas (Manual Admin Creation)
# ==========================================
class SubjectCreate(BaseModel):
    name: str
    code: str
    department_id: int
    program_id: Optional[int] = None
    academic_year_id: Optional[int] = None
    semester_id: Optional[int] = None
    is_active: bool = True

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    academic_year_id: Optional[int] = None
    semester_id: Optional[int] = None
    is_active: Optional[bool] = None

class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    department_id: int
    department_name: Optional[str] = None
    program_id: Optional[int] = None
    program_name: Optional[str] = None
    academic_year_id: Optional[int] = None
    year_name: Optional[str] = None
    semester_id: Optional[int] = None
    semester_name: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================================
# 4. Student Schemas
# ==========================================
class StudentCreate(BaseModel):
    enrollment_no: str
    name: str
    department: str
    gender: Optional[str] = None
    program: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    password: Optional[str] = None

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    gender: Optional[str] = None
    program: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    is_active: Optional[bool] = None

class StudentOut(BaseModel):
    id: int
    enrollment_no: str
    name: str
    department: str
    gender: Optional[str] = None
    program: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True

class StudentLogin(BaseModel):
    enrollment_no: str
    password: str

class StudentToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student: StudentOut

class BulkDeleteStudentsRequest(BaseModel):
    student_ids: List[int]
    confirm_text: Optional[str] = None
    force: Optional[bool] = False

class BulkDeleteStudentsResponse(BaseModel):
    status: str
    message: str
    deleted_count: int
    student_ids: List[int]


class BulkDeleteRequest(BaseModel):
    ids: List[int]
    confirm_text: Optional[str] = None
    force: Optional[bool] = False

class BulkDeleteResponse(BaseModel):
    status: str
    message: str
    deleted_count: int
    deleted_ids: List[int]
    blocked_ids: Optional[List[int]] = []
    blocked_reasons: Optional[List[str]] = []

class DependencyCheckResponse(BaseModel):
    record_id: int
    record_name: str
    record_type: str
    can_delete: bool
    has_dependencies: bool
    dependency_counts: Dict[str, int]
    reason: str



# ==========================================
# 5. Question Schemas
# ==========================================
class QuestionOut(BaseModel):
    id: int
    question: str
    options: Dict[str, str]

class QuestionCreate(BaseModel):
    question_text: str = Field(min_length=1, max_length=10000)
    option_a: str = Field(min_length=1, max_length=5000)
    option_b: str = Field(min_length=1, max_length=5000)
    option_c: str = Field(min_length=1, max_length=5000)
    option_d: str = Field(min_length=1, max_length=5000)
    correct_answer: Literal["A", "B", "C", "D"]
    topic: Optional[str] = "General"
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    academic_year_id: Optional[int] = None
    semester_id: Optional[int] = None
    subject_id: Optional[int] = None
    difficulty: Optional[Literal["Easy", "Medium", "Hard"]] = "Medium"
    marks: int = Field(default=1, ge=1, le=100)
    is_active: bool = True

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = None
    topic: Optional[str] = None
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    academic_year_id: Optional[int] = None
    semester_id: Optional[int] = None
    subject_id: Optional[int] = None
    difficulty: Optional[str] = None
    marks: Optional[int] = Field(default=None, ge=1, le=100)
    is_active: Optional[bool] = None

class QuestionStatusUpdate(BaseModel):
    is_active: bool

class AdminQuestionOut(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    topic: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    program_id: Optional[int] = None
    program_name: Optional[str] = None
    academic_year_id: Optional[int] = None
    year_name: Optional[str] = None
    semester_id: Optional[int] = None
    semester_name: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    difficulty: Optional[str] = "Medium"
    marks: int = 1
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================================
# 6. Exam Schemas
# ==========================================
class ExamCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    code: Optional[str] = None
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    academic_year_id: Optional[int] = None
    semester_id: Optional[int] = None
    subject_id: Optional[int] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: int = Field(default=60, ge=1, le=1440)
    total_questions: int = Field(default=25, ge=1, le=500)
    marks_per_question: int = Field(default=1, ge=1, le=100)
    total_marks: Optional[int] = Field(default=None, ge=1, le=50000)
    passing_percentage: float = Field(default=40.0, ge=0, le=100)
    selection_mode: Literal["random", "manual"] = "random"
    selected_question_ids: Optional[List[int]] = None
    status: Literal["draft", "published", "closed", "archived"] = "draft"
    result_release_mode: Literal["immediate", "after_close"] = "after_close"

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[int] = None
    program_id: Optional[int] = None
    academic_year_id: Optional[int] = None
    semester_id: Optional[int] = None
    subject_id: Optional[int] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    total_questions: Optional[int] = Field(default=None, ge=1, le=500)
    marks_per_question: Optional[int] = Field(default=None, ge=1, le=100)
    total_marks: Optional[int] = Field(default=None, ge=1, le=50000)
    passing_percentage: Optional[float] = Field(default=None, ge=0, le=100)
    selection_mode: Optional[Literal["random", "manual"]] = None
    selected_question_ids: Optional[List[int]] = None
    status: Optional[Literal["draft", "published", "closed", "archived"]] = None
    result_release_mode: Optional[Literal["immediate", "after_close"]] = None
    is_active: Optional[bool] = None

class ExamOut(BaseModel):
    id: int
    selected_question_ids: List[int] = Field(default_factory=list)
    title: str
    code: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    program_id: Optional[int] = None
    program_name: Optional[str] = None
    academic_year_id: Optional[int] = None
    year_name: Optional[str] = None
    semester_id: Optional[int] = None
    semester_name: Optional[str] = None
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: int
    total_questions: int
    marks_per_question: int
    total_marks: int
    passing_percentage: float
    selection_mode: str
    status: str
    is_active: bool
    has_session_code: bool = False
    session_code_rotated_at: Optional[datetime] = None
    result_release_mode: str = "after_close"
    assigned_students_count: int = 0
    attempts_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AssignStudentsRequest(BaseModel):
    student_ids: List[int] = Field(max_length=5000)
    replace: bool = False

class AssignedStudentOut(BaseModel):
    student_id: int
    enrollment_no: str
    name: str
    department: str
    gender: Optional[str] = None
    program: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    assigned_at: Optional[datetime] = None
    attempt_id: Optional[int] = None
    status: Optional[str] = None
    score: Optional[int] = None
    percentage: Optional[float] = None

class StudentAvailableExam(BaseModel):
    id: int
    title: str
    code: Optional[str] = None
    subject_name: Optional[str] = None
    department_name: Optional[str] = None
    duration_minutes: int
    total_questions: int
    total_marks: int
    passing_percentage: float
    start_date: Optional[str] = None
    start_time: Optional[str] = None
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    status: str  # 'available', 'in_progress', 'completed', 'timed_out', 'closed', 'upcoming'
    attempt_id: Optional[int] = None
    score: Optional[int] = None
    percentage: Optional[float] = None
    requires_session_code: bool = True


# ==========================================
# 7. Answer & Attempt Schemas
# ==========================================
class SaveAnswerRequest(BaseModel):
    question_number: int = Field(ge=1, le=500)
    selected_answer: Optional[Literal["A", "B", "C", "D"]] = None

class BatchAnswersRequest(BaseModel):
    answers: List[SaveAnswerRequest] = Field(max_length=500)

class StudentAnswerOut(BaseModel):
    question_number: int
    question: str
    options: Dict[str, str]
    selected_answer: Optional[str]
    correct_answer: str
    marks: int = 1
    is_correct: bool

    class Config:
        from_attributes = True

class SecurityLogCreate(BaseModel):
    event_type: Literal["tab_switch", "fullscreen_exit", "copy_attempt", "paste_attempt", "context_menu"]
    details: Optional[str] = Field(default=None, max_length=500)

class SecurityLogOut(BaseModel):
    id: int
    attempt_id: int
    student_id: int
    event_type: str
    details: Optional[str] = None
    occurred_at: datetime

    class Config:
        from_attributes = True

class AttemptOut(BaseModel):
    id: int
    student_id: int
    exam_id: Optional[int] = None
    exam_title_snapshot: Optional[str] = None
    subject_name_snapshot: Optional[str] = None
    total_questions: int
    score: int
    percentage: float
    correct_answers: int
    wrong_answers: int
    started_at: datetime
    submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    time_limit_minutes: Optional[int] = 60
    question_count_snapshot: Optional[int] = 50
    status: str
    tab_switch_count: int = 0
    fullscreen_exit_count: int = 0
    copy_count: int = 0
    paste_count: int = 0

    class Config:
        from_attributes = True

class StartAttemptResponse(BaseModel):
    attempt_id: int
    student: StudentOut
    message: str
    exam_title: Optional[str] = None
    deadline_at: Optional[datetime] = None
    time_limit_minutes: int = 60
    total_questions: int = 50

class StartExamRequest(BaseModel):
    session_code: str = Field(min_length=6, max_length=32)

class AttemptStatusResponse(BaseModel):
    attempt_id: int
    status: str
    exam_id: Optional[int] = None
    exam_title: Optional[str] = None
    subject_name: Optional[str] = None
    started_at: datetime
    deadline_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    time_limit_minutes: int
    total_questions: int
    remaining_seconds: int
    current_server_time: datetime
    tab_switch_count: int = 0
    fullscreen_exit_count: int = 0
    answers: Dict[int, Optional[str]]

class TestResultOut(BaseModel):
    student: StudentOut
    attempt: AttemptOut
    answers: List[StudentAnswerOut]
    security_logs: Optional[List[SecurityLogOut]] = []
    review_available: bool = True
    review_message: Optional[str] = None
    maximum_score: int = 0


# ==========================================
# 8. Admin & Dashboard Schemas
# ==========================================
class AdminLogin(BaseModel):
    username: str
    password: str

class AdminUserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    role: str = "hod"  # "super_admin", "hod", "faculty"
    department_id: Optional[int] = None

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None

class AdminUserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[AdminUserOut] = None

class AdminDashboardStats(BaseModel):
    total_students: int
    total_attempts: int
    completed_tests: int
    average_score: float
    average_percentage: float
    total_departments: int = 0
    total_subjects: int = 0
    active_subjects: int = 0
    total_exams: int = 0
    active_exams: int = 0
    total_questions: int = 0

class StudentSummary(BaseModel):
    student_id: int
    enrollment_no: str
    name: str
    department: str
    gender: Optional[str] = None
    program: Optional[str] = None
    year: Optional[str] = None
    semester: Optional[str] = None
    is_active: bool = True
    score: Optional[int] = None
    percentage: Optional[float] = None
    attempt_date: Optional[datetime] = None
    status: Optional[str] = None
    attempt_id: Optional[int] = None
    exam_title: Optional[str] = None
    tab_switch_count: Optional[int] = 0
    fullscreen_exit_count: Optional[int] = 0

class AssessmentSettingsOut(BaseModel):
    question_count: int
    time_limit_minutes: int
    active_questions_count: int
    total_questions_count: int
    updated_at: Optional[datetime] = None

class AssessmentSettingsUpdate(BaseModel):
    question_count: int = Field(..., gt=0)
    time_limit_minutes: int = Field(..., gt=0)

class ClearAllDataRequest(BaseModel):
    confirmation_phrase: str
