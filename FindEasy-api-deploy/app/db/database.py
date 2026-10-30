from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL.strip()

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required and must point to PostgreSQL.")

try:
    parsed_url = make_url(DATABASE_URL)
except Exception as exc:
    raise RuntimeError("DATABASE_URL is not a valid SQLAlchemy database URL.") from exc

if parsed_url.drivername == "postgresql":
    DATABASE_URL = parsed_url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
elif parsed_url.drivername == "postgresql+psycopg2":
    DATABASE_URL = parsed_url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
elif parsed_url.drivername != "postgresql+psycopg":
    raise RuntimeError("Only PostgreSQL URLs using the psycopg driver are supported.")
elif parsed_url.drivername == "postgresql+psycopg":
    DATABASE_URL = parsed_url.render_as_string(hide_password=False)

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgres://"):]

engine_kwargs = {
    "pool_pre_ping": True,
    "pool_size": settings.DB_POOL_SIZE,
    "max_overflow": settings.DB_MAX_OVERFLOW,
    "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
}

if DATABASE_URL.startswith("postgresql+"):
    engine_kwargs["connect_args"] = {"connect_timeout": settings.DB_CONNECT_TIMEOUT_SECONDS}

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
