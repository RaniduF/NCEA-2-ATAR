from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import standards
from .api import suggestions
from .api import calculation
from .api import subject_analysis
from .core.config import settings

app = FastAPI(title="NCEA to ATAR API")

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