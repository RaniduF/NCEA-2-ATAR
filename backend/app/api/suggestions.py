from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

# --- Path Setup & Imports ---
from ..db import session
from ..models import standard_models

# --- API Router Setup ---
router = APIRouter(
    prefix="/suggestions",
    tags=["Suggestions"]
)


# Dependency to get the database session
def get_db():
    db = session.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
async def get_search_suggestions(q: str | None = None,
                                 db: Session = Depends(get_db)):
    """
    Provides real-time search suggestions.
    This performs a fast, prefix-based search on the primary keywords.
    """
    if not q or len(q) < 2:
        # Don't return suggestions for very short queries
        return []

    #  search term needs to be escaped to be safely used in a raw SQL LIKE query
    search_term = q.lower().strip()

    # query uses JSON_EXTRACT and LIKE to efficiently find primary keywords
    # that start with the user's search term.
    # raw SQL query as it's more direct for type of JSON search in MySQL.
    query = text("""
                 SELECT DISTINCT JSON_UNQUOTE(jp.value) AS suggestion
                 FROM standards,
                      JSON_TABLE(
                              search_keywords,
                              '$.primary[*]' COLUMNS (value VARCHAR(100) PATH '$')
                      ) AS jp
                 WHERE jp.value LIKE :search_term LIMIT 10;
                 """)

    results = db.execute(query, {"search_term": f"{search_term}%"}).fetchall()

    # The result is list of tuples, extract the first element of each
    suggestions = [row[0] for row in results]

    return suggestions
