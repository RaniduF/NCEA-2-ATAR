from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy import bindparam
from sqlalchemy import func

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
                                 Produce subject and standard search suggestions for a query string.
                                 
                                 Parameters:
                                 	q (str | None): The user's search term. If omitted or shorter than 2 characters, the function returns empty suggestion lists.
                                 
                                 Returns:
                                 	dict: A mapping with two keys:
                                 		- "subjects": list of up to three subject names ranked by relevance.
                                 		- "standards": list of formatted strings "STANDARD_NUMBER • Title" combining matches found by standard-number prefix (if the query is numeric) and by primary search keywords.
                                 """
    if not q or len(q) < 2:
        # Don't return suggestions for very short queries
        return {"subjects": [], "standards": []}

    search_term = q.lower().strip()

    # --- 1. Find matching subjects ---
    subject_matches = db.query(standard_models.Standard.subject).filter(
        func.lower(standard_models.Standard.subject).like(f"{search_term}%")
    ).distinct().all()
    
    # Score and rank subjects by relevance
    scored_subjects = []
    for subject_tuple in subject_matches:
        if subject_tuple[0]:
            subject = subject_tuple[0]
            subject_lower = subject.lower()
            
            # Calculate relevance score (lower score = better match)
            length_penalty = len(subject)  # Shorter names are better
            match_ratio = len(search_term) / len(subject)  # Higher ratio is better
            
            # Bonus for exact word boundary matches
            word_bonus = 0
            if subject_lower.startswith(search_term):
                word_bonus = -10  # Strong bonus for prefix match
            
            score = length_penalty - (match_ratio * 50) + word_bonus
            scored_subjects.append((score, subject))
    
    # Sort by score (ascending - lower is better) and take top 3
    scored_subjects.sort(key=lambda x: x[0])
    subjects = [subject for score, subject in scored_subjects[:3]]

    # --- 2. Find matching standards by keywords or standard numbers ---
    # First try to find by standard number (if the search term is numeric)
    standards_by_number = []
    if search_term.isdigit():
        standards_by_number = db.query(standard_models.Standard).filter(
            standard_models.Standard.standard_number.like(f"{search_term}%")
        ).limit(5).all()
    
    # Then find by keywords (excluding those already found by number)
    excluded_numbers = [std.standard_number for std in standards_by_number]
    
    # Apply exclusion via expanding bind parameter for SQL
    keyword_sql = """
                 SELECT DISTINCT s.standard_number, s.title
                 FROM standards s,
                      JSON_TABLE(
                              s.search_keywords,
                              '$.primary[*]' COLUMNS (value VARCHAR(100) PATH '$')
                      ) AS jp
                 WHERE jp.value LIKE :search_term
                 """

    params = {
        "search_term": f"{search_term}%",
        "limit_count": 7 - len(standards_by_number)
    }

    if excluded_numbers:
        keyword_sql += "AND s.standard_number NOT IN :excluded_list\n"
        params["excluded_list"] = excluded_numbers

    keyword_sql += "LIMIT :limit_count;"

    keyword_query = text(keyword_sql)

    if excluded_numbers:
        keyword_query = keyword_query.bindparams(bindparam("excluded_list", expanding=True))

    keyword_results = db.execute(keyword_query, params).fetchall()
    
    kw_numbers = [row[0] for row in keyword_results]
    standards_by_keyword = []
    if kw_numbers:
        standards_by_keyword = (
            db.query(standard_models.Standard)
            .filter(standard_models.Standard.standard_number.in_(kw_numbers))
            .all()
        ) 
    
    # Combine and format standards
    all_standards = standards_by_number + standards_by_keyword
    formatted_standards = [
        f"{std.standard_number} • {std.title}" for std in all_standards
    ]

    return {"subjects": subjects, "standards": formatted_standards}
