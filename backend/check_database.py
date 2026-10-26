"""Check configured PostgreSQL connectivity without printing connection secrets."""
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from app.config import settings


def failure_reason(error):
    message = str(getattr(error, "orig", error)).lower()
    for fragment, reason in (
        ("password authentication failed", "Password authentication failed; check the database password in both URLs."),
        ("tenant or user not found", "Pooler username or project region is incorrect; copy the exact Connect URL."),
        ("could not translate host", "DNS lookup failed; check the pooler hostname."),
        ("network is unreachable", "Network/IPv6 is unreachable; use the IPv4 shared pooler."),
        ("timeout", "Connection timed out; check project availability and network restrictions."),
        ("connection refused", "Connection refused; check the hostname and port."),
        ("ssl", "TLS connection failed; check SSL configuration."),
        ("max clients", "Pooler connection limit reached; reduce application connections."),
    ):
        if fragment in message:
            return reason
    return f"{type(error).__name__}; connection details suppressed to protect credentials."


def check():
    success = True
    for label, url in (("Runtime", settings.sqlalchemy_database_url), ("Migrations", settings.migration_database_url)):
        engine = None
        try:
            kwargs = {"connect_args": {"connect_timeout": settings.DB_CONNECT_TIMEOUT}} if url.startswith("postgresql") else {}
            engine = create_engine(url, poolclass=NullPool, **kwargs)
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print(f"{label}: connected", flush=True)
        except Exception as error:
            success = False
            print(f"{label}: {failure_reason(error)}", flush=True)
        finally:
            if engine is not None:
                engine.dispose()
    return success


if __name__ == "__main__":
    raise SystemExit(0 if check() else 1)
