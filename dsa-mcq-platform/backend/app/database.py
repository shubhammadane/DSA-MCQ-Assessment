import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

logger = logging.getLogger("uvicorn")

DATABASE_URL = settings.sqlalchemy_database_url

try:
    if "sqlite" in DATABASE_URL:
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            pass
except (Exception, ImportError) as e:
    logger.warning(f"PostgreSQL connection / driver unavailable ({e}). Falling back to SQLite.")
    DATABASE_URL = "sqlite:///./dsa_mcq.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
