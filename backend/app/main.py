from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .api import standards
from .api import suggestions
from .api import calculation
from .api import subject_analysis
from .core.config import settings
from .core.limiter import limiter
from .core.logging import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "NCEA-to-ATAR API starting (CORS origins=%d, rate limiter=enabled)",
        len(settings.CORS_ORIGINS),
    )
    yield


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