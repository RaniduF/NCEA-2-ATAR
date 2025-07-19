from fastapi import FastAPI
from .api import standards
from .api import suggestions
from .api import calculation

app = FastAPI(title="NCEA to ATAR API")

app.include_router(standards.router, prefix="/api/v1")
app.include_router(suggestions.router, prefix="/api/v1")
app.include_router(calculation.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the NCEA to ATAR API"}