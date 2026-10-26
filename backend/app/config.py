import os
import secrets
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field
from sqlalchemy.engine import make_url
from urllib.parse import quote, unquote

class Settings(BaseSettings):
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "dsa_mcq_db")
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )
    MIGRATION_DATABASE_URL: Optional[str] = None
    DB_POOL_SIZE: int = Field(default=5, ge=1, le=30)
    DB_MAX_OVERFLOW: int = Field(default=5, ge=0, le=30)
    DB_POOL_TIMEOUT: int = Field(default=15, ge=1, le=120)
    DB_CONNECT_TIMEOUT: int = Field(default=10, ge=1, le=60)
    DB_SCHEMA: Optional[str] = Field(default=None, pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    
    SECRET_KEY: str = os.getenv("SECRET_KEY") or secrets.token_urlsafe(48)
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: Optional[str] = os.getenv("ADMIN_PASSWORD")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    EXAM_TIMEZONE: str = os.getenv("EXAM_TIMEZONE", "Asia/Kolkata")
    
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "")

    @property
    def sqlalchemy_database_url(self) -> str:
        return self.normalize_database_url(self.DATABASE_URL)

    @property
    def migration_database_url(self) -> str:
        return self.normalize_database_url(self.MIGRATION_DATABASE_URL or self.DATABASE_URL)

    @staticmethod
    def normalize_database_url(value: str) -> str:
        value = value.strip()
        # Accept pasted Connect URLs even when a password contains reserved
        # characters such as @, / or #. Split on the final authority separator
        # before SQLAlchemy parses the URL, and preserve already encoded values.
        scheme, separator, remainder = value.partition("://")
        if separator and scheme.startswith(("postgres", "postgresql")):
            credentials, at_sign, destination = remainder.rpartition("@")
            username, colon, password = credentials.partition(":")
            if at_sign and colon:
                value = f"{scheme}://{quote(unquote(username), safe='')}:{quote(unquote(password), safe='')}@{destination}"
        url = make_url(value)
        if url.drivername in ("postgres", "postgresql"):
            url = url.set(drivername="postgresql+psycopg2")
        # Supabase requires TLS. Preserve explicitly supplied verification options.
        if url.host and url.host.endswith((".supabase.com", ".supabase.co")):
            url = url.update_query_dict({"sslmode": url.query.get("sslmode", "require")})
        return url.render_as_string(hide_password=False)

    class Config:
        env_file = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
            ".env"
        ]
        extra = "ignore"

settings = Settings()
