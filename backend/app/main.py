from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import standards
from .api import suggestions
from .api import calculation
from .api import subject_analysis

app = FastAPI(title="NCEA to ATAR API")

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://localhost:3006",
        "http://localhost:3007",
        "http://localhost:3008",
        "http://localhost:3009",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
        "http://127.0.0.1:3006",
        "http://127.0.0.1:3007",
        "http://127.0.0.1:3008",
        "http://127.0.0.1:3009"
    ],
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