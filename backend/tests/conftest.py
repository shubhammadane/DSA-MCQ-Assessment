import os
import uuid
import socket
import subprocess
import sys
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.api import router
from app.database import Base, get_db
from app.auth import CurrentUser, get_current_admin
from app.config import settings


@pytest.fixture
def database(tmp_path, request):
    postgres = request.node.get_closest_marker("postgres") is not None
    control = None
    if postgres:
        url = os.getenv("TEST_DATABASE_URL")
        if not url:
            pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database for concurrency tests")
        schema = "assessment_test_" + uuid.uuid4().hex
        control = create_engine(url, pool_pre_ping=True, pool_size=1, max_overflow=0,
                                connect_args={"connect_timeout": 10})
        with control.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        schema_url = make_url(url).update_query_dict({"options": f"-csearch_path={schema}"})
        engine = create_engine(schema_url, pool_pre_ping=True, pool_size=5, max_overflow=5, pool_timeout=15,
                               connect_args={"connect_timeout": 10})
        @event.listens_for(engine, "connect")
        def private_schema(connection, _):
            # Supabase's session pooler ignores startup search_path options.
            # Set it explicitly on the dedicated session, outside a transaction.
            previous = connection.autocommit
            connection.autocommit = True
            with connection.cursor() as cursor:
                cursor.execute(f'SET SESSION search_path TO "{schema}"')
            connection.autocommit = previous
        engine = engine.execution_options(schema_translate_map={None: schema})
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT current_schema()")) == schema, "Test schema isolation was not honored; refusing to run."
    else:
        engine = create_engine(f"sqlite:///{tmp_path / 'assessment.db'}", connect_args={"check_same_thread": False})
        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    sessions.test_schema = schema if postgres else None
    yield sessions
    engine.dispose()
    if control:
        with control.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        control.dispose()


@pytest.fixture
def client(database):
    app = FastAPI()
    app.include_router(router)
    def session():
        with database() as db:
            try:
                yield db
            except Exception:
                db.rollback()
                raise
    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_current_admin] = lambda: CurrentUser(id=None, username="test-admin", full_name="Test Administrator", role="super_admin")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def live_client(database, tmp_path):
    """Run the real production app over TCP with a private PostgreSQL schema."""
    import httpx
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    url = database.kw["bind"].url
    runtime_url = url.difference_update_query(["options"])
    if runtime_url.host and runtime_url.host.endswith(".pooler.supabase.com"):
        runtime_url = runtime_url.set(port=6543)
    env = dict(os.environ, DATABASE_URL=runtime_url.render_as_string(hide_password=False), MIGRATION_DATABASE_URL=url.render_as_string(hide_password=False),
               ENVIRONMENT="production", SECRET_KEY=settings.SECRET_KEY,
               ADMIN_USERNAME="load-admin", ADMIN_PASSWORD="LoadTestAdminPassword!",
               DB_POOL_SIZE="5", DB_MAX_OVERFLOW="5", DB_SCHEMA=database.test_schema)
    with (tmp_path / "server.log").open("w+") as log:
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app",
                                    "--host", "127.0.0.1", "--port", str(port),
                                    "--limit-concurrency", "200", "--no-access-log"],
                                   env=env, stdout=log, stderr=log)
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=30,
                              limits=httpx.Limits(max_connections=100, max_keepalive_connections=80)) as connection:
                for _ in range(150):
                    if process.poll() is not None:
                        log.seek(0)
                        pytest.fail("Test server failed: " + log.read())
                    try:
                        if connection.get("/health/ready").status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    time.sleep(0.1)
                else:
                    pytest.fail("Test server did not become ready")
                login = connection.post("/api/auth/login", json={"username": "load-admin", "password": "LoadTestAdminPassword!"})
                assert login.status_code == 200, login.text
                connection.headers["Authorization"] = "Bearer " + login.json()["access_token"]
                yield connection
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
