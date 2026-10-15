import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app import models
from app.api import router
from app.questions_data import FIXED_QUESTIONS
from app.config import settings
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.engine import make_url

logger = logging.getLogger("uvicorn")

if settings.ENVIRONMENT.lower() == "production" and not os.getenv("SECRET_KEY"):
    raise RuntimeError("SECRET_KEY must be explicitly configured in production.")
if settings.ENVIRONMENT.lower() == "production" and not settings.ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD must be explicitly configured in production.")
if settings.ENVIRONMENT.lower() == "production" and not os.getenv("DATABASE_URL"):
    raise RuntimeError("DATABASE_URL must be explicitly configured in production.")
if settings.ENVIRONMENT.lower() == "production" and make_url(settings.sqlalchemy_database_url).password == "postgres":
    raise RuntimeError("The default PostgreSQL password is not allowed in production.")

# Production schema changes are owned by Alembic. Local/test environments keep
# create_all as a convenient bootstrap for isolated disposable databases.
if settings.ENVIRONMENT.lower() != "production":
    Base.metadata.create_all(bind=engine)

def auto_seed_db():
    """Ensure database has initial settings, mandatory departments, and the 50 DSA questions on first run."""
    db = SessionLocal()
    try:
        # 1. Assessment Settings initialization
        setting = db.query(models.AssessmentSetting).first()
        if not setting:
            setting = models.AssessmentSetting(
                question_count=50,
                time_limit_minutes=60,
                updated_at=datetime.utcnow()
            )
            db.add(setting)
            db.commit()

        # 2. Idempotent academic structure for fresh local and test databases.
        department_rows = [
            ("Computer Science & Engineering", "CSE"),
            ("Information Technology", "IT"),
            ("Civil Engineering Department", "CIVIL"),
            ("Electrical Engineering Department", "EE"),
            ("Mechanical Engineering Department", "MECH"),
            ("Electronics & Telecommunication", "ENTC"),
            ("Master in Computer Application", "MCA"),
            ("Applied Mechanics Department", "AM"),
            ("Applied Mathematics", "MATH"),
            ("Science", "SCI"),
        ]
        for name, code in department_rows:
            if not db.query(models.Department).filter(func.lower(models.Department.name) == name.lower()).first():
                db.add(models.Department(name=name, code=code, is_active=True, created_at=datetime.utcnow()))

        program_ids = {}
        for name, code in (("UG", "UG"), ("M.Tech", "PG")):
            program = db.query(models.Program).filter(func.lower(models.Program.name) == name.lower()).first()
            if not program:
                program = models.Program(name=name, code=code, is_active=True, created_at=datetime.utcnow())
                db.add(program)
                db.flush()
            program_ids[name] = program.id

        year_specs = {
            "UG": [("1st Year", 1), ("2nd Year", 2), ("3rd Year", 3), ("Final Year", 4)],
            "M.Tech": [("M.Tech 1st Year", 1), ("M.Tech 2nd Year", 2)],
        }
        years = {}
        for program_name, specs in year_specs.items():
            for year_name, number in specs:
                year = db.query(models.AcademicYear).filter(
                    models.AcademicYear.program_id == program_ids[program_name],
                    models.AcademicYear.year_number == number,
                ).first()
                if not year:
                    year = models.AcademicYear(program_id=program_ids[program_name], name=year_name, year_number=number, is_active=True)
                    db.add(year)
                    db.flush()
                years[(program_name, number)] = year.id

        semester_specs = {
            "UG": [(1, 1), (1, 2), (2, 3), (2, 4), (3, 5), (3, 6), (4, 7), (4, 8)],
            "M.Tech": [(1, 1), (1, 2), (2, 3), (2, 4)],
        }
        for program_name, specs in semester_specs.items():
            for year_number, semester_number in specs:
                year_id = years[(program_name, year_number)]
                exists = db.query(models.Semester).filter(
                    models.Semester.program_id == program_ids[program_name],
                    models.Semester.semester_number == semester_number,
                ).first()
                if not exists:
                    db.add(models.Semester(
                        program_id=program_ids[program_name],
                        academic_year_id=year_id,
                        name=f"Semester {semester_number}",
                        semester_number=semester_number,
                        is_active=True,
                    ))
        db.commit()

        # 3. Seed 50 DSA questions if table is empty
        question_count = db.query(models.Question).count()
        if question_count == 0 and FIXED_QUESTIONS:
            now = datetime.utcnow()
            new_questions = []
            for q in FIXED_QUESTIONS:
                opts = q.get("options", {})
                new_questions.append(models.Question(
                    id=q["id"],
                    question_text=q["question"],
                    option_a=opts.get("A", ""),
                    option_b=opts.get("B", ""),
                    option_c=opts.get("C", ""),
                    option_d=opts.get("D", ""),
                    correct_answer=q["correct_answer"],
                    topic="Data Structures & Algorithms",
                    difficulty="Medium",
                    marks=1,
                    is_active=True,
                    created_at=now,
                    updated_at=now
                ))
            db.bulk_save_objects(new_questions)
            db.commit()

            # Reset PostgreSQL sequence to prevent duplicate key errors on future inserts
            if db.bind.dialect.name == "postgresql":
                from sqlalchemy import text
                try:
                    db.execute(text("SELECT setval(pg_get_serial_sequence('questions', 'id'), COALESCE(MAX(id), 1)) FROM questions;"))
                    db.execute(text("SELECT setval(pg_get_serial_sequence('assessment_settings', 'id'), COALESCE(MAX(id), 1)) FROM assessment_settings;"))
                    db.commit()
                except Exception as seq_err:
                    logger.warning(f"Could not reset PostgreSQL sequence: {seq_err}")
    except Exception as e:
        db.rollback()
        logger.warning(f"Database auto-seed warning: {e}")
    finally:
        db.close()

# Run auto-seed
auto_seed_db()

app = FastAPI(
    title="College Examination & Assessment Management System API",
    description="Backend service for College Examination & Assessment Management System with multi-department, subject-specific question banks, and student-specific exam access.",
    version="2.0.0"
)

# Configure CORS for local dev, Vercel, and Render frontends
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if settings.FRONTEND_URL:
    for u in settings.FRONTEND_URL.split(","):
        trimmed = u.strip()
        if trimmed and trimmed not in origins:
            origins.append(trimmed)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": "College Examination & Assessment Management System",
        "message": "API is active and operational"
    }
