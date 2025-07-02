from fastapi import FastAPI
from .api import standards

app = FastAPI(title="NCEA to ATAR API")

app.include_router(standards.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the NCEA 2 ATAR API"}