from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy import bindparam
from sqlalchemy import func

from ..db.session import get_db
from ..models import standard_models

# --- API Router Setup ---
router = APIRouter(
    prefix="/suggestions",
    tags=["Suggestions"]
)


@router.get("/")
async def get_search_suggestions(q: str | None = None,
                                 db: Session = Depends(get_db)):
    if not q or len(q) < 2:
        return {"subjects": [], "standards": []}

    search_term = q.lower().strip()

    # --- 1. Find matching subjects ---
    subject_matches = db.query(standard_models.Standard.subject).filter(
        func.lower(standard_models.Standard.subject).like(f"{search_term}%")
    ).distinct().all()

    scored_subjects = []
    for subject_tuple in subject_matches:
        if subject_tuple[0]:
            subject = subject_tuple[0]
            subject_lower = subject.lower()

            length_penalty = len(subject)
            match_ratio = len(search_term) / len(subject)

            word_bonus = 0
            if subject_lower.startswith(search_term):
                word_bonus = -10

            score = length_penalty - (match_ratio * 50) + word_bonus
            scored_subjects.append((score, subject))

    scored_subjects.sort(key=lambda x: x[0])
    subjects = [subject for score, subject in scored_subjects[:3]]

    # --- 2. Find matching standards by keywords or standard numbers ---
    standards_by_number = []
    if search_term.isdigit():
        standards_by_number = db.query(standard_models.Standard).filter(
            standard_models.Standard.standard_number.like(f"{search_term}%")
        ).limit(5).all()

    remaining_slots = max(0, 7 - len(standards_by_number))
    excluded_numbers = [std.standard_number for std in standards_by_number]

    keyword_results = []
    if remaining_slots > 0:
        keyword_sql = """
                     SELECT DISTINCT s.standard_number, s.title
                     FROM standards s,
                          jsonb_array_elements_text(s.search_keywords->'primary') AS jp(value)
                     WHERE jp.value LIKE :search_term
                     """

        params = {
            "search_term": f"{search_term}%",
            "limit_count": remaining_slots
        }

        if excluded_numbers:
            keyword_sql += "AND s.standard_number NOT IN :excluded_list\n"
            params["excluded_list"] = excluded_numbers

        keyword_sql += "ORDER BY s.standard_number LIMIT :limit_count;"

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

    all_standards = standards_by_number + standards_by_keyword
    formatted_standards = [
        f"{std.standard_number} • {std.title}" for std in all_standards
    ]

    return {"subjects": subjects, "standards": formatted_standards}
