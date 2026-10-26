"""Copy a local SQLite installation into a freshly migrated PostgreSQL project.

Existing user data in the destination is never overwritten. Seeded academic
records and bundled questions are merged, with foreign keys remapped atomically.
"""
import argparse
from pathlib import Path

from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

from app import models
from app.config import settings
from app.database import Base
from app.questions_data import FIXED_QUESTIONS
from check_database import failure_reason

NATURAL_KEYS = {
    "departments": ("name",),
    "programs": ("name",),
    "academic_years": ("program_id", "year_number"),
    "semesters": ("program_id", "semester_number"),
    "questions": ("question_text", "option_a", "option_b", "option_c", "option_d", "correct_answer"),
}


def copy_local_data(source_url, target_url):
    source_info = make_url(source_url)
    if source_info.drivername != "sqlite" or not source_info.database or not Path(source_info.database).is_file():
        raise ValueError("Source must be an existing SQLite database file.")
    if not make_url(target_url).drivername.startswith("postgresql"):
        raise ValueError("Destination must be PostgreSQL.")
    source = create_engine(source_url, poolclass=NullPool)
    target = create_engine(target_url, poolclass=NullPool, connect_args={"connect_timeout": 10})
    counts, id_maps = {}, {}
    try:
        with source.connect() as original, target.begin() as destination:
            # Transaction-scoped lock works through Supabase's poolers.
            destination.execute(text("SELECT pg_advisory_xact_lock(843217901)"))
            for table in Base.metadata.sorted_tables:
                if table.name in {*NATURAL_KEYS, "assessment_settings", "login_failures"}:
                    continue
                if destination.scalar(select(func.count()).select_from(table)):
                    raise ValueError(f"Destination {table.name} already contains user records; refusing to overwrite them.")
            questions = models.Question.__table__
            bundled = {tuple([row["question"], *[row["options"][letter] for letter in "ABCD"], row["correct_answer"]]) for row in FIXED_QUESTIONS}
            for row in destination.execute(select(questions)).mappings():
                if tuple(row[key] for key in NATURAL_KEYS["questions"]) not in bundled:
                    raise ValueError("Destination has custom questions; refusing to modify an existing installation.")
            for table in Base.metadata.sorted_tables:
                if table.name == "login_failures":
                    continue
                id_maps[table.name] = {}
                rows = original.execute(select(table).order_by(table.c.id)).mappings().all()
                for row in rows:
                    values = dict(row)
                    old_id = values.pop("id")
                    for column in table.columns:
                        for reference in column.foreign_keys:
                            if values.get(column.name) is not None:
                                values[column.name] = id_maps[reference.column.table.name][values[column.name]]
                    existing = None
                    if keys := NATURAL_KEYS.get(table.name):
                        existing = destination.scalar(select(table.c.id).where(*(table.c[key] == values[key] for key in keys)))
                    elif table.name == "assessment_settings":
                        existing = destination.scalar(select(table.c.id).limit(1))
                    if existing is None:
                        new_id = destination.scalar(table.insert().values(**values).returning(table.c.id))
                    else:
                        destination.execute(table.update().where(table.c.id == existing).values(**values))
                        new_id = existing
                    id_maps[table.name][old_id] = new_id
                counts[table.name] = len(rows)
        return counts
    finally:
        source.dispose()
        target.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="SQLite URL of the local database to preserve")
    args = parser.parse_args()
    try:
        copied = copy_local_data(args.source, settings.migration_database_url)
        print("Local records copied atomically:", copied)
    except Exception as error:
        print(str(error) if isinstance(error, ValueError) else failure_reason(error))
        raise SystemExit(1)
