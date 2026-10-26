from sqlalchemy.engine import make_url
from app.config import Settings


def test_supabase_url_handles_reserved_password_characters_and_requires_tls():
    for password in ("example@pass/#[]!", "example%40pass%2F%23%5B%5D%21"):
        value = Settings.normalize_database_url(f"postgresql://postgres:{password}@db.example.supabase.co:5432/postgres")
        parsed = make_url(value)
        assert parsed.password == "example@pass/#[]!"
        assert parsed.host == "db.example.supabase.co"
        assert parsed.query["sslmode"] == "require"
        assert parsed.drivername == "postgresql+psycopg2"


def test_pooler_and_migration_urls_are_independent():
    config = Settings(_env_file=None, DATABASE_URL="postgres://postgres.ref:example@aws-0-region.pooler.supabase.com:6543/postgres",
                      MIGRATION_DATABASE_URL="postgresql://postgres.ref:example@aws-0-region.pooler.supabase.com:5432/postgres")
    assert make_url(config.sqlalchemy_database_url).port == 6543
    assert make_url(config.migration_database_url).port == 5432


def test_url_normalization_preserves_verified_tls_and_sqlite():
    value = Settings.normalize_database_url("postgresql://postgres:example@db.example.supabase.co/postgres?sslmode=verify-full")
    assert make_url(value).query["sslmode"] == "verify-full"
    assert Settings.normalize_database_url("sqlite:////tmp/example.db") == "sqlite:////tmp/example.db"
