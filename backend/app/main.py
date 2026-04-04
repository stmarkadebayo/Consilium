from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import Settings, get_settings
from app.db import build_engine, build_session_maker
from app.errors import AppError
from app.migrations import run_migrations
from app.providers import build_provider
from app.routers import auth_router, conversations_router, council_router, jobs_router, personas_router
from app.schemas import ErrorDetail
from app.services.job_runner_service import JobRunnerService


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    app_settings = settings or get_settings()
    app_settings.validate_runtime(role="api")

    engine = build_engine(app_settings.database_url)
    session_maker = build_session_maker(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = app_settings
        app.state.engine = engine
        app.state.session_maker = session_maker
        app.state.provider = build_provider(app_settings)
        app.state.job_runner = JobRunnerService(
            settings=app_settings,
            session_maker=session_maker,
            provider=app.state.provider,
        )
        if app_settings.auto_run_migrations:
            run_migrations(engine, app_settings.database_url)
        app.state.job_runner.start()
        yield
        app.state.job_runner.stop()
        engine.dispose()

    app = FastAPI(title=app_settings.app_name, lifespan=lifespan)
    raw_origins = app_settings.cors_origins
    origins_list = (
        raw_origins if isinstance(raw_origins, list) 
        else [o.strip() for o in raw_origins.split(",") if o.strip()]
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    def handle_app_error(_, error: AppError):
        detail = ErrorDetail(code=error.code, message=error.message, extra=error.extra)
        return JSONResponse(status_code=error.status_code, content={"detail": detail.model_dump(exclude_none=True)})

    @app.get("/health")
    def health() -> dict[str, str]:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail=f"database_unavailable:{error.__class__.__name__}",
            ) from error
        return {"status": "ok", "database": "ok"}

    app.include_router(auth_router)
    app.include_router(council_router)
    app.include_router(personas_router)
    app.include_router(conversations_router)
    app.include_router(jobs_router)
    return app


app = create_app()
