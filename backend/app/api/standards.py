# backend/app/api/standards.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_  # <-- Make sure to import 'or_'
from ..db import session
from ..models import standard_models

router = APIRouter(
    prefix="/standards",
    tags=["Standards"]
)


# A dependency to get the database session
def get_db():
    db = session.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
async def search_standards(q: str | None = None,
                           db: Session = Depends(get_db)):
    """
    Search for NCEA standards by standard number, subject, or keyword.
    """
    if not q:
        return []

    # 1. Check if the query is a numeric standard number
    if q.isdigit():
        standard = db.query(standard_models.Standard).filter(
            standard_models.Standard.standard_number == int(q)).first()
        return [standard] if standard else []

    # 2. If not a number, perform a combined search on subject and title
    # This is a more robust approach.
    search_term = f"%{q}%"  # Add wildcards for a 'contains' search
    results = db.query(standard_models.Standard).filter(
        or_(
            standard_models.Standard.subject.ilike(search_term),
            standard_models.Standard.title.ilike(search_term)
        )
    ).all()

    return results