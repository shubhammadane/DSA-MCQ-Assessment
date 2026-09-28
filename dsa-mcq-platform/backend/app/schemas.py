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

# Question Schemas
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
    submitted_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True

class StartAttemptResponse(BaseModel):
    attempt_id: int
    student: StudentOut
    message: str

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
