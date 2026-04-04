from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.models import Base  # noqa: F401

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _build_alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def run_migrations(engine: Engine, database_url: str) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    managed_tables = set(Base.metadata.tables.keys())
    config = _build_alembic_config(database_url)

    if "alembic_version" not in tables:
        existing_managed_tables = tables & managed_tables
        if existing_managed_tables:
            missing_tables = sorted(managed_tables - tables)
            if missing_tables:
                joined = ", ".join(missing_tables)
                raise RuntimeError(
                    "Existing database is not Alembic-managed and is missing required tables: "
                    f"{joined}. Back up the database, then migrate or recreate it."
                )
            command.stamp(config, "head")
            return

    command.upgrade(config, "head")
