# backend/app/api/standards.py

import json
import os
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func
from thefuzz import \
    process as fuzzy_process

# --- Path Setup & Imports ---
from ..db import session
from ..models import standard_models


# --- Load Manual Overrides ---
def load_manual_overrides():
    overrides_path = os.path.join(
        os.path.dirname(__file__), '..', '..', '..', 'scripts',
        'search_overrides.json'
    )
    try:
        with open(overrides_path, 'r') as f:
            overrides = json.load(f)
            alias_to_standard = {}
            for std_num, aliases in overrides.get("standard_aliases",
                                                  {}).items():
                for alias in aliases:
                    alias_to_standard[alias] = std_num
            return alias_to_standard
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


PRIMARY_ALIASES = load_manual_overrides()

# --- API Router Setup ---
router = APIRouter(
    prefix="/standards",
    tags=["Standards"]
)


# Dependency to get the database session
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
                           Search for NCEA standards by subject, alias/number, or keyword and return matching standards with related groups and optional suggestions.
                           
                           Performs a staged search: prefers exact subject matches, then alias/standard-number matches, then keyword matches, and finally offers a fuzzy-subject suggestion when nothing else matches.
                           
                           Parameters:
                               q (str | None): The user's search query; when None or empty, returns no results.
                           
                           Returns:
                               dict: A response object with the following keys:
                                   - direct_results (list[Standard]): Standards that directly match the query (empty if none).
                                   - related_groups (list[dict]): Each dict contains "name" (str) and "standards" (list[Standard]) for related subject groups.
                                   - suggestion (None | dict): `None` when no suggestion; otherwise an object like {"type": "subject", "value": "<Suggested Subject>"}.
                                   - subject_match (None | ...): Present (set to `None`) in responses returned after finding a top standard.
                           """
    if not q:
        return {"direct_results": [], "related_groups": [], "suggestion": None}

    search_term = q.lower().strip()

    # --- Cache the list of subjects for performance ---
    all_subjects_query = db.query(
        standard_models.Standard.subject).distinct().all()
    all_subjects = {s[0].lower() for s in all_subjects_query if s[0]}

    # --- 1. Subject Match ---
    if search_term in all_subjects:
        subject_standards = db.query(standard_models.Standard).filter(
            func.lower(standard_models.Standard.subject) == search_term
        ).all()
        internals = sorted(
            [s for s in subject_standards if s.assessment_type == 'Internal'],
            key=lambda x: x.standard_number)
        externals = sorted(
            [s for s in subject_standards if s.assessment_type == 'External'],
            key=lambda x: x.standard_number)
        related_groups_response = []
        if externals:
            related_groups_response.append(
                {"name": f"{q.title()} Externals", "standards": externals})
        if internals:
            related_groups_response.append(
                {"name": f"{q.title()} Internals", "standards": internals})
        return {"direct_results": [],
                "related_groups": related_groups_response, "suggestion": None}

    # --- 2. Alias or Standard Number Match ---
    top_standard = None
    standard_number_to_find = PRIMARY_ALIASES.get(search_term) or (
        search_term if search_term.isdigit() else None)
    if standard_number_to_find:
        top_standard = db.query(standard_models.Standard).filter(
            standard_models.Standard.standard_number == standard_number_to_find).first()

    # --- 3. Keyword Search ---
    if not top_standard:
        top_standard = db.query(standard_models.Standard).filter(
            func.json_contains(standard_models.Standard.search_keywords,
                               json.dumps([search_term]), '$.primary')
        ).first()

    # --- If a standard was found, return its data and related groups ---
    if top_standard:
        related_groups_response = []
        if top_standard.search_keywords and 'groups' in top_standard.search_keywords:
            subject_cache = {}
            for group_name in top_standard.search_keywords['groups']:
                # Skip general subject groups (like "Physics") and only include specific categories
                # (like "Physics Externals", "Physics Internals")
                if not (group_name.endswith(' Externals') or group_name.endswith(' Internals')):
                    continue
                    
                # Get all standards from the subject first
                subject_name = group_name.replace(' Externals', '').replace(' Internals', '')
                subject_lower = subject_name.lower()
                if subject_lower in subject_cache:
                    subject_standards = subject_cache[subject_lower]
                else:
                    subject_standards = db.query(standard_models.Standard).filter(
                        func.lower(standard_models.Standard.subject) == subject_lower
                    ).all()
                    subject_cache[subject_lower] = subject_standards
                
                # Filter by assessment type based on group name
                if group_name.endswith(' Externals'):
                    filtered_standards = [s for s in subject_standards if s.assessment_type == 'External']
                elif group_name.endswith(' Internals'):
                    filtered_standards = [s for s in subject_standards if s.assessment_type == 'Internal']
                else:
                    filtered_standards = subject_standards
                
                # Sort by standard number
                filtered_standards.sort(key=lambda x: x.standard_number)
                
                if filtered_standards:  # Only add if there are standards
                    related_groups_response.append(
                        {"name": group_name, "standards": filtered_standards})
        return {"direct_results": [top_standard],
                "related_groups": related_groups_response, "suggestion": None, "subject_match": None}

    # --- 4. Fuzzy Search for Suggestions (if all else fails) ---
    # Find the best match for the user's query from the list of all subjects.
    best_match = fuzzy_process.extractOne(search_term, all_subjects)
    if best_match and best_match[
        1] >= 75:  # best_match is a tuple: (match, score)
        return {"direct_results": [], "related_groups": [],
                "suggestion": {"type": "subject",
                               "value": best_match[0].title()}}

    # --- Final Fallback: No results and no suggestions ---
    return {"direct_results": [], "related_groups": [], "suggestion": None}


@router.get("/{standard_number}/available-years")  # noqa: B008
def get_available_years_for_standard(standard_number: int, version: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retrieve available academic years for a standard, optionally filtered by version.
    
    Parameters:
        standard_number (int): The identifier of the standard to query.
        version (int | None): If provided, restrict results to this standard version.
    
    Returns:
        dict: {
            "standard_number": standard_number,
            "version": version,
            "available_years": list[int]  # available academic years sorted descending
        }
    """
    query = db.query(standard_models.StandardWeighting.academic_year)\
        .filter(standard_models.StandardWeighting.standard_number == standard_number)
    
    if version is not None:
        query = query.filter(standard_models.StandardWeighting.standard_version == version)
    
    available_years = query.distinct()\
        .order_by(standard_models.StandardWeighting.academic_year.desc())\
        .all()
    
    years = [int(year[0]) for year in available_years]
    return {"standard_number": standard_number, "version": version, "available_years": years}

@router.get("/{standard_number}/available-versions")  # noqa: B008
def get_available_versions_for_standard(standard_number: int, db: Session = Depends(get_db)):
    """
    List available standard versions for a given standard number.
    
    Returns:
        dict: {"standard_number": int, "available_versions": List[int]} where "available_versions" is a list of available versions ordered descending.
    """
    available_versions = db.query(standard_models.StandardWeighting.standard_version)\
        .filter(standard_models.StandardWeighting.standard_number == standard_number)\
        .distinct()\
        .order_by(standard_models.StandardWeighting.standard_version.desc())\
        .all()
    
    versions = [version[0] for version in available_versions]
    return {"standard_number": standard_number, "available_versions": versions}
