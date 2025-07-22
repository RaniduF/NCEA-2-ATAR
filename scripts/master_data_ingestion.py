import sys
import os
import json
import re
import time
import pandas as pd
import requests
from bs4 import BeautifulSoup
from unidecode import unidecode
import nltk
from nltk.corpus import stopwords

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import Standard, StandardWeighting


# --- NLTK and Custom Stop Words Setup ---
def setup_nltk_and_stopwords():
    try:
        base_stopwords = set(stopwords.words('english'))
    except LookupError:
        print("Downloading NLTK 'stopwords'...")
        nltk.download('stopwords')
        base_stopwords = set(stopwords.words('english'))

    academic_stop_words = {
        'demonstrate', 'understanding', 'apply', 'analyse', 'evaluate',
        'produce',
        'develop', 'use', 'investigate', 'carry', 'conduct', 'describe',
        'complete',
        'create', 'write', 'solve', 'meet', 'leading', 'select', 'implement',
        'examine', 'explore', 'methods', 'aspects', 'contexts', 'problems'
    }
    return base_stopwords.union(academic_stop_words)


STOP_WORDS = setup_nltk_and_stopwords()


def normalize_text(text: str) -> str:
    if not isinstance(text, str): return ""
    return unidecode(str(text)).lower()


def load_manual_overrides(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def scrape_nzqa_standard(standard_number):
    """Scrapes the NZQA website for details of a single standard."""
    print(f"  - Scraping details for {standard_number}...")
    try:
        url = f"https://www.nzqa.govt.nz/ncea/assessment/search.do?query={standard_number}&view=details"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        details = {}
        details_table = soup.find('table', class_='ncea-table')
        if not details_table: return None

        details['title'] = details_table.find('th',
                                              text='Title').find_next_sibling(
            'td').text.strip()
        subjects_raw = details_table.find('th',
                                          text='Subject').find_next_sibling(
            'td').text.strip()
        subjects_cleaned = [re.sub(r'\s*\(.*\)\s*', '', s).strip() for s in
                            subjects_raw.split(',')]
        details['subjects'] = subjects_cleaned
        assessment_td = details_table.find('th',
                                           text='Assessment').find_next_sibling(
            'td')
        details[
            'assessment_type'] = "Internal" if "internal" in assessment_td.text.lower() else "External"
        type_tr = details_table.find('tr', class_='dataHighlight')
        details[
            'standard_type'] = "Achievement Standard" if "achievement" in type_tr.text.lower() else "Unit Standard"
        credits_td = details_table.find('th',
                                        text='Credits').find_next_sibling('td')
        details['credits'] = int(credits_td.text.strip())
        time.sleep(0.2)
        return details
    except Exception as e:
        print(f"    - Scraping failed for {standard_number}: {e}")
        return None


def master_ingest():
    print("--- Starting Master Data Ingestion V3 ---")

    # --- 1. Load All Source Files ---
    print("Loading source files...")
    try:
        data_dir = os.path.join(project_root, 'data')
        old_weights_path = os.path.join(data_dir,
                                        'standard_weightings_2024-03-27.csv')
        new_weights_path = os.path.join(data_dir,
                                        'standard_weights_2024-2022.csv')
        ue_subjects_path = os.path.join(data_dir, 'ue_subjects_2025-07-20.csv')
        overrides_path = os.path.join(project_root, 'scripts',
                                      'search_overrides.json')

        old_weights_df = pd.read_csv(old_weights_path)
        new_weights_df = pd.read_csv(new_weights_path)
        ue_subjects_df = pd.read_csv(ue_subjects_path)
        overrides = load_manual_overrides(overrides_path)
    except FileNotFoundError as e:
        print(f"Error loading source file: {e}")
        return

    # --- 2. Merge Weighting Data ---
    print("Merging and cleaning weighting data...")
    old_weights_df = old_weights_df[
        old_weights_df['Academic Year'] <= 2021].copy()
    new_weights_df = new_weights_df[
        new_weights_df['Academic Year'] >= 2022].copy()

    old_weights_df.rename(columns={'Standard': 'Standard Number',
                                   'Standard Version': 'Standard Version ',
                                   'Adjusted Not Achieved Percentile': 'weight_not_achieved',
                                   'Adjusted Achieved Percentile': 'weight_achieved',
                                   'Adjusted Merit Percentile': 'weight_merit',
                                   'Adjusted Excellence Percentile': 'weight_excellence'},
                          inplace=True)
    new_weights_df.rename(columns={'Standard Number': 'Standard Number',
                                   'Standard Version ': 'Standard Version ',
                                   'Adjusted Not Achieved Percentile': 'weight_not_achieved',
                                   'Adjusted  Achieved Percentile': 'weight_achieved',
                                   'Adjusted Merit Percentile': 'weight_merit',
                                   'Adjusted Excellence Percentile': 'weight_excellence'},
                          inplace=True)

    merged_weights_df = pd.concat([old_weights_df, new_weights_df],
                                  ignore_index=True)
    all_standard_numbers = sorted(
        list(merged_weights_df['Standard Number'].unique()))
    print(f"Found {len(all_standard_numbers)} unique standards to process.")

    # --- Prepare UE Lookup ---
    ue_lookup = {}
    ue_subjects_df.columns = [col.strip() for col in ue_subjects_df.columns]
    subject_col_name = ue_subjects_df.columns[0]
    standards_col_name = ue_subjects_df.columns[1]
    for index, row in ue_subjects_df.iterrows():
        subject_name = row[subject_col_name]
        standards_cell = row[standards_col_name]
        if pd.notna(standards_cell):
            for std_num_str in str(standards_cell).split(','):
                try:
                    std_num_int = int(std_num_str.strip())
                    ue_lookup[std_num_int] = subject_name.strip()
                except ValueError:
                    pass

    db = SessionLocal()
    try:
        # --- 3. Wipe Existing Data ---
        print("Wiping existing data...")
        db.query(StandardWeighting).delete()
        db.query(Standard).delete()
        db.commit()

        # --- 4. Process and Insert All Standards ---
        for std_num in all_standard_numbers:
            scraped_data = scrape_nzqa_standard(std_num)
            if not scraped_data: continue

            main_subject = scraped_data['subjects'][0] if scraped_data[
                'subjects'] else None
            is_ue = std_num in ue_lookup
            if is_ue:
                main_subject = ue_lookup[std_num]
            if str(std_num) in overrides.get("subject_overrides", {}):
                main_subject = overrides["subject_overrides"][str(std_num)]

            primary_keywords = set()
            if str(std_num) in overrides.get("standard_aliases", {}):
                primary_keywords.update(
                    overrides["standard_aliases"][str(std_num)])
            primary_keywords.add(str(std_num))
            if main_subject:
                primary_keywords.add(normalize_text(main_subject))

            title_norm = normalize_text(scraped_data['title'])
            title_words = title_norm.split()
            prominent_words = [word for word in title_words if
                               word not in STOP_WORDS and len(word) > 2]
            primary_keywords.update(prominent_words)

            new_standard = Standard(
                standard_number=std_num,
                title=scraped_data['title'],
                credits=scraped_data['credits'],
                subject=main_subject,
                assessment_type=scraped_data['assessment_type'],
                standard_type=scraped_data['standard_type'],
                is_ue=is_ue,
                search_keywords={"primary": sorted(list(primary_keywords)),
                                 "groups": []}
            )
            db.add(new_standard)

        print("Committing standards to database...")
        db.commit()

        # --- 5. Final Pass to Build Groups ---
        all_standards_from_db = db.query(Standard).all()
        for standard in all_standards_from_db:
            standard_groups = set()
            if standard.subject and standard.assessment_type:
                primary_group = f"{standard.subject} {standard.assessment_type}s"
                standard_groups.add(primary_group)
                if standard.standard_type == 'Achievement Standard':
                    if "Externals" in primary_group:
                        standard_groups.add(
                            primary_group.replace("Externals", "Internals"))
                    elif "Internals" in primary_group:
                        standard_groups.add(
                            primary_group.replace("Internals", "Externals"))

            current_keywords = standard.search_keywords
            current_keywords['groups'] = sorted(list(standard_groups))
            standard.search_keywords = current_keywords

        print("Committing group data...")
        db.commit()

        # --- 6. Process and Insert Weightings ---
        print("Processing and inserting weighting data...")

        # --- FIX: Clean the DataFrame before inserting ---
        weight_cols = ['weight_not_achieved', 'weight_achieved',
                       'weight_merit', 'weight_excellence']
        merged_weights_df.dropna(subset=['Standard Number', 'Academic Year',
                                         'Standard Version '] + weight_cols,
                                 inplace=True)

        # --- FIX: Ensure correct data types ---
        merged_weights_df['Standard Number'] = merged_weights_df[
            'Standard Number'].astype(int)
        merged_weights_df['Academic Year'] = merged_weights_df[
            'Academic Year'].astype(int)
        merged_weights_df['Standard Version '] = merged_weights_df[
            'Standard Version '].astype(int)
        for col in weight_cols:
            merged_weights_df[col] = merged_weights_df[col].astype(float)

        for index, row in merged_weights_df.iterrows():
            new_weighting = StandardWeighting(
                standard_number=row['Standard Number'],
                academic_year=row['Academic Year'],
                standard_version=row['Standard Version '],
                weight_not_achieved=row['weight_not_achieved'],
                weight_achieved=row['weight_achieved'],
                weight_merit=row['weight_merit'],
                weight_excellence=row['weight_excellence']
            )
            db.add(new_weighting)

        print("Committing weighting data...")
        db.commit()

        print("✅ Master data ingestion complete!")
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    master_ingest()
