import sys
import os
import json
import re
import nltk
from nltk.corpus import stopwords
import pandas as pd

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import Standard


# --- NLTK and Custom Stop Words Setup ---
def setup_nltk_and_stopwords():
    try:
        base_stopwords = set(stopwords.words('english'))
    except LookupError:
        print("Downloading NLTK 'stopwords'...")
        nltk.download('stopwords')
        base_stopwords = set(stopwords.words('english'))

    try:
        nltk.data.find('taggers/averaged_perceptron_tagger')
    except LookupError:
        print("Downloading NLTK 'averaged_perceptron_tagger'...")
        nltk.download('averaged_perceptron_tagger')

    # --- NEW: Custom list of common NCEA academic verbs to ignore ---
    academic_stop_words = {
        'demonstrate', 'understanding', 'apply', 'analyse', 'evaluate',
        'produce', 'develop', 'use', 'investigate', 'carry', 'conduct',
        'describe', 'complete', 'create', 'write', 'solve', 'meet',
        'leading', 'select', 'implement', 'examine', 'explore', 'methods'
    }

    return base_stopwords.union(academic_stop_words)


STOP_WORDS = setup_nltk_and_stopwords()


def load_manual_overrides(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"standard_aliases": {}, "subject_overrides": {}}
    except json.JSONDecodeError:
        return {"standard_aliases": {}, "subject_overrides": {}}


def enrich_database():
    print("Starting data enrichment process...")

    # --- Load Manual Curation Rules ---
    overrides_path = os.path.join(os.path.dirname(__file__),
                                  'search_overrides.json')
    overrides = load_manual_overrides(overrides_path)
    aliases = overrides.get("standard_aliases", {})
    subject_overrides = overrides.get("subject_overrides", {})
    print(
        f"Loaded {len(aliases)} aliases and {len(subject_overrides)} subject overrides.")

    # --- Database Enrichment Loop ---
    db_session = SessionLocal()
    try:
        all_my_standards = db_session.query(Standard).all()
        print(f"Found {len(all_my_standards)} standards to process.")

        for standard in all_my_standards:
            standard_number = str(standard.standard_number)
            assessment_type = str(standard.assessment_type)
            subject = subject_overrides.get(standard_number,
                                            str(standard.subject))

            # --- Group Identification Logic ---
            standard_groups = set()
            if pd.notna(subject) and pd.notna(assessment_type):
                primary_group = f"{subject} {assessment_type}s"
                standard_groups.add(primary_group)
                if "Externals" in primary_group:
                    standard_groups.add(
                        primary_group.replace("Externals", "Internals"))
                elif "Internals" in primary_group:
                    standard_groups.add(
                        primary_group.replace("Internals", "Externals"))

            # --- Keyword and JSON Construction ---
            primary_keywords = set()
            if standard_number in aliases:
                primary_keywords.update(aliases[standard_number])
            if pd.notna(subject):
                primary_keywords.add(subject.lower())
            primary_keywords.add(standard_number)

            cleaned_title = re.sub(r'[^a-z0-9\s]', '',
                                   str(standard.title).lower()).strip()
            words = cleaned_title.split()

            # Extract only the meaningful nouns and adjectives from the title
            for word in words:
                if word not in STOP_WORDS and len(word) > 2:
                    primary_keywords.add(word)

            # --- JSON structure ---
            search_json = {
                "primary": sorted(list(primary_keywords)),
                "groups": sorted(list(standard_groups))
            }
            standard.search_keywords = search_json

        print("Committing changes to the database...")
        db_session.commit()
        print("✅ Data enrichment and commit successful!")

    except Exception as e:
        print(f"❌ An error occurred during database processing: {e}")
        db_session.rollback()
    finally:
        print("Closing database session.")
        db_session.close()


if __name__ == "__main__":
    enrich_database()
