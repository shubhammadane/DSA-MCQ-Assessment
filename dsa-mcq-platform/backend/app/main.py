import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app import models
from app.api import router
from app.questions_data import FIXED_QUESTIONS
from app.config import settings
from datetime import datetime

logger = logging.getLogger("uvicorn")

# Ensure database tables exist
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

        # 2. Seed 50 DSA questions if table is empty
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
    allow_origins=origins if settings.FRONTEND_URL else ["*"],
    allow_origin_regex=r"https:\/\/.*(\.vercel\.app|\.onrender\.com)" if settings.FRONTEND_URL else None,
    allow_credentials=True if settings.FRONTEND_URL else False,
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
