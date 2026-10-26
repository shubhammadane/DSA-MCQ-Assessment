import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

DATABASE_URL = settings.sqlalchemy_database_url

engine_options = dict(
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=300,
    pool_use_lifo=True,
)
if DATABASE_URL.startswith("postgresql"):
    engine_options["connect_args"] = {"connect_timeout": settings.DB_CONNECT_TIMEOUT}
    if DATABASE_URL.startswith("postgresql+psycopg2"):
        # Batch ORM answer updates into one round trip to the hosted database.
        engine_options["executemany_mode"] = "values_plus_batch"
        engine_options["executemany_batch_page_size"] = 500
elif DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False, "timeout": 30}
    if ":memory:" in DATABASE_URL:
        for key in ("pool_size", "max_overflow", "pool_timeout", "pool_use_lifo"):
            engine_options.pop(key)

engine = create_engine(DATABASE_URL, **engine_options)
if settings.DB_SCHEMA:
    engine = engine.execution_options(schema_translate_map={None: settings.DB_SCHEMA})

if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
