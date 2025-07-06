# scripts/populate_search_keywords.py

import sys
import os
import requests
import re
import time

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# --- FIX: Import create_engine and sessionmaker directly ---
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.config import settings
from backend.app.models.standard_models import Standard


engine = create_engine(
    settings.DATABASE_URL,
    isolation_level="AUTOCOMMIT"
)
ScriptSessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                  bind=engine)


def enrich_database():
    """
    A one-time script to populate the 'search_keywords' column in the standards table.
    """
    print("Starting data enrichment process...")
    YEAR_TO_FETCH = 2024

    # --- API Fetching Logic (No changes here) ---
    print(f"Fetching list of all subjects for {YEAR_TO_FETCH} from UOA API...")
    try:
        subjects_url = f"https://apis.auckland.ac.nz/rsc/v2/subjects/ncea/search-by-year?year={YEAR_TO_FETCH}"
        response = requests.get(subjects_url)
        response.raise_for_status()
        response_data = response.json()
        subjects_list = response_data.get("message")
        if not isinstance(subjects_list, list):
            print("Error: API response for subjects was not a list.")
            return
    except requests.exceptions.RequestException as e:
        print(f"Error fetching UOA subjects list: {e}")
        return

    print(f"Found {len(subjects_list)} subjects to process.")

    uoa_subjects_lookup = {}
    for subject_info in subjects_list:
        subject_code = subject_info.get("subjectCode")
        if not subject_code: continue
        try:
            standards_url = f"https://apis.auckland.ac.nz/rsc/v2/standards/search-by-subject-year?year={YEAR_TO_FETCH}&subjectCode={subject_code}"
            response = requests.get(standards_url)
            response.raise_for_status()
            standards_data = response.json()
            if standards_data.get("message", {}).get("standardSuggestions"):
                for standard_info in standards_data["message"][
                    "standardSuggestions"]:
                    standard_code = standard_info.get("standardCode")
                    if not standard_code: continue
                    if standard_code not in uoa_subjects_lookup:
                        uoa_subjects_lookup[standard_code] = set()
                    for s_info in standard_info.get("subjects", []):
                        subject_name = s_info.get("subjectName")
                        if subject_name:
                            uoa_subjects_lookup[standard_code].add(
                                subject_name)
            time.sleep(0.1)
        except requests.exceptions.RequestException as e:
            print(
                f"  - Could not fetch standards for subject code {subject_code}. Error: {e}")

    print(
        f"\nPrepared lookup for {len(uoa_subjects_lookup)} unique standards from UOA data.")

    # --- Database Enrichment Loop ---
    db_session = ScriptSessionLocal()  # Use our new script-specific session
    try:
        all_my_standards = db_session.query(Standard).all()
        print(
            f"Found {len(all_my_standards)} standards in the local database to process.")

        for standard in all_my_standards:
            # ... (keyword generation logic is unchanged) ...
            keywords = set()
            uoa_subjects = uoa_subjects_lookup.get(
                str(standard.standard_number))
            if uoa_subjects:
                for subject in uoa_subjects:
                    main_subject = subject.split('/')[0].strip()
                    keywords.add(main_subject)
            if not keywords and standard.subject:
                keywords.add(standard.subject)
            keywords.add(standard.title)
            keywords.add(str(standard.standard_number))
            final_keyword_string_list = []
            for keyword in keywords:
                cleaned_keyword = re.sub(r'[^a-z0-9\s]', '',
                                         str(keyword).lower()).strip()
                if cleaned_keyword:
                    final_keyword_string_list.extend(cleaned_keyword.split())
            final_keyword_string = " ".join(
                sorted(list(set(final_keyword_string_list))))
            standard.search_keywords = final_keyword_string

        print("Attempting to commit changes to the database...")
        db_session.commit()
        print("✅ Commit successful!")

    except Exception as e:
        print(f"❌ An error occurred during database processing: {e}")
        db_session.rollback()
    finally:
        print("Closing database session.")
        db_session.close()


if __name__ == "__main__":
    enrich_database()
