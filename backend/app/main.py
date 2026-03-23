from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.db import Base, build_engine, build_session_maker, ensure_postgres_extensions
from app.providers import build_provider
from app.routers import auth_router, conversations_router, council_router, jobs_router, personas_router
from app.services.job_runner_service import JobRunnerService
from app.services.retrieval_service import RetrievalService


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    app_settings = settings or get_settings()
    if app_settings.auth_provider == "supabase":
        if not app_settings.supabase_url or not app_settings.supabase_publishable_key:
            raise RuntimeError(
                "Supabase auth is enabled, but SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing."
            )
    engine = build_engine(app_settings.database_url)
    session_maker = build_session_maker(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = app_settings
        app.state.engine = engine
        app.state.session_maker = session_maker
        app.state.provider = build_provider(app_settings)
        app.state.retrieval_service = RetrievalService(app_settings)
        app.state.job_runner = JobRunnerService(
            settings=app_settings,
            session_maker=session_maker,
            provider=app.state.provider,
            retrieval_service=app.state.retrieval_service,
        )
        if app_settings.auto_create_tables:
            ensure_postgres_extensions(engine)
            Base.metadata.create_all(bind=engine)
        app.state.job_runner.start()
        yield
        app.state.job_runner.stop()
        engine.dispose()

    app = FastAPI(title=app_settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(council_router)
    app.include_router(personas_router)
    app.include_router(conversations_router)
    app.include_router(jobs_router)
    return app


app = create_app()
