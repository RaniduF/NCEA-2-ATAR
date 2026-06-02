from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from .api import standards
from .api import suggestions
from .api import calculation
from .api import subject_analysis
from .core.config import settings
from .core.limiter import limiter
from .core.logging import logger
from .core.data_cache import prime as prime_data_cache
from .db.session import engine, SessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        prime_data_cache(db)
    finally:
        db.close()
    logger.info(
        "NCEA-to-ATAR API starting (CORS origins=%d, rate limiter=enabled)",
        len(settings.CORS_ORIGINS),
    )
    yield
    logger.info("SIGTERM received — shutting down gracefully")
    engine.dispose()
    logger.info("Database connection pool closed")


app = FastAPI(title="NCEA to ATAR API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(standards.router, prefix="/api/v1")
app.include_router(suggestions.router, prefix="/api/v1")
app.include_router(calculation.router, prefix="/api/v1")
app.include_router(subject_analysis.router, prefix="/api/v1/subject-analysis", tags=["Subject Analysis"])


@app.get("/")
def read_root():
    return {"message": "Welcome to the NCEA to ATAR API"}


@app.get("/health")
def health_check():
    """ALB health check endpoint. No database access — must be cheap and reliable."""
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db():
    """Diagnostic endpoint that verifies database connectivity."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "db": "unreachable"},
        )