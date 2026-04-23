"""FastAPI-приложение «Инструмент НСИ»."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import (
    auth,
    chat,
    hierarchy,
    maintenance,
    mass_processing,
    reliability,
    specifications,
    tk,
    upper_levels,
)
from app.api.v1.parser import router as parser_router
from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import engine, init_db
from app.rate_limit import limiter, rate_limit_exceeded_handler

PUBLIC_PREFIXES = ("/api/v1/auth",)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up 'Инструмент НСИ' (env=%s)", settings.APP_ENV)
    init_db()
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    yield
    logger.info("Shutting down 'Инструмент НСИ'")


app = FastAPI(
    title="Инструмент НСИ",
    description="Единый функциональный инструмент для работы с НСИ в области ТОиР",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Error handlers -------------------------------------------------------


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "detail": exc.detail},
        headers=getattr(exc, "headers", None) or {},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "validation_error", "detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception for {} {}", request.method, request.url.path)
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "detail": str(exc)},
        )
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": "Внутренняя ошибка сервера"},
    )


# --- Middleware: file size limit -----------------------------------------

MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH"}:
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_UPLOAD_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "payload_too_large",
                    "detail": f"Размер запроса превышает лимит {settings.MAX_UPLOAD_MB} МБ",
                },
            )
    return await call_next(request)


# --- Routers --------------------------------------------------------------

app.include_router(auth.router, prefix="/api/v1")

_protected_routers = [
    (hierarchy.router, "/api/v1"),
    (upper_levels.router, "/api/v1"),
    (mass_processing.router, "/api/v1"),
    (maintenance.router, "/api/v1"),
    (specifications.router, "/api/v1"),
    (tk.router, "/api/v1"),
    (reliability.router, "/api/v1"),
    (chat.router, "/api/v1"),
    (parser_router, "/api/v1"),
]

for router, prefix in _protected_routers:
    app.include_router(router, prefix=prefix, dependencies=[Depends(get_current_user)])


# --- Health endpoints -----------------------------------------------------


@app.get("/api/v1/health", tags=["system"])
def health_check():
    return {"status": "ok", "service": "Инструмент НСИ"}


@app.get("/api/v1/readyz", tags=["system"])
def readiness():
    """Проверка готовности: пинг БД."""
    from sqlalchemy import text

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"db_unavailable: {exc}") from exc
    return {"status": "ready"}
