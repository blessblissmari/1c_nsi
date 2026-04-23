from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, reset_db
from app.api.v1 import hierarchy, upper_levels, mass_processing, maintenance, specifications, tk, reliability, chat
from app.api.v1.parser import router as parser_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Do NOT reset database at startup - preserve user-loaded data
    yield


app = FastAPI(
    title="Инструмент НСИ",
    description="Единый функциональный инструмент для работы с НСИ в области ТОиР",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hierarchy.router, prefix="/api/v1")
app.include_router(upper_levels.router, prefix="/api/v1")
app.include_router(mass_processing.router, prefix="/api/v1")
app.include_router(maintenance.router, prefix="/api/v1")
app.include_router(specifications.router, prefix="/api/v1")
app.include_router(tk.router, prefix="/api/v1")
app.include_router(reliability.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(parser_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "service": "Инструмент НСИ"}


@app.post("/api/v1/reset")
def reset_database():
    """Reset database to clean state"""
    try:
        reset_db()
        return {"status": "ok", "message": "База данных очищена"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
