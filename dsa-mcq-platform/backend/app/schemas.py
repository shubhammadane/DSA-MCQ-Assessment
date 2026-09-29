from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

# Student Schemas
class StudentCreate(BaseModel):
    enrollment_no: str
    name: str
    department: str

class StudentOut(BaseModel):
    id: int
    enrollment_no: str
    name: str
    department: str
    created_at: datetime

    class Config:
        from_attributes = True

# Question Schemas (Public sanitized for students)
class QuestionOut(BaseModel):
    id: int
    question: str
    options: Dict[str, str]

# Answer submission schema
class SaveAnswerRequest(BaseModel):
    question_number: int
    selected_answer: Optional[str] = None

class BatchAnswersRequest(BaseModel):
    answers: List[SaveAnswerRequest]

# Student Answer Response
class StudentAnswerOut(BaseModel):
    question_number: int
    question: str
    options: Dict[str, str]
    selected_answer: Optional[str]
    correct_answer: str
    is_correct: bool

    class Config:
        from_attributes = True

# Attempt Schemas
class AttemptOut(BaseModel):
    id: int
    student_id: int
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

    class Config:
        from_attributes = True

class StartAttemptResponse(BaseModel):
    attempt_id: int
    student: StudentOut
    message: str
    deadline_at: Optional[datetime] = None
    time_limit_minutes: int = 60
    total_questions: int = 50

class AttemptStatusResponse(BaseModel):
    attempt_id: int
    status: str
    started_at: datetime
    deadline_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    time_limit_minutes: int
    total_questions: int
    remaining_seconds: int
    current_server_time: datetime
    answers: Dict[int, Optional[str]]

class TestResultOut(BaseModel):
    student: StudentOut
    attempt: AttemptOut
    answers: List[StudentAnswerOut]

# Admin Schemas
class AdminLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class AdminDashboardStats(BaseModel):
    total_students: int
    total_attempts: int
    completed_tests: int
    average_score: float
    average_percentage: float

class StudentSummary(BaseModel):
    student_id: int
    enrollment_no: str
    name: str
    department: str
    score: Optional[int] = None
    percentage: Optional[float] = None
    attempt_date: Optional[datetime] = None
    status: Optional[str] = None
    attempt_id: Optional[int] = None

# Admin Question Management Schemas
class QuestionCreate(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    topic: Optional[str] = "Data Structures & Algorithms"
    is_active: bool = True

class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = None
    topic: Optional[str] = None
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
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Assessment Settings Schemas
class AssessmentSettingsOut(BaseModel):
    question_count: int
    time_limit_minutes: int
    active_questions_count: int
    total_questions_count: int
    updated_at: Optional[datetime] = None

class AssessmentSettingsUpdate(BaseModel):
    question_count: int = Field(..., gt=0)
    time_limit_minutes: int = Field(..., gt=0)
