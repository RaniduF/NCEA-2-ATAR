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


def scrape_nzqa_standard_enhanced(standard_number):
    """Enhanced scraping function for NZQA standards"""
    url = f"https://www.nzqa.govt.nz/ncea/assessment/view-detailed.do?standardNumber={standard_number}"
    
    try:
        print(f"  - Scraping standard {standard_number}...")
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract title - h3 tag that contains the standard title
        title_h3 = soup.find('h3')
        if not title_h3 or 'Search Standards' in title_h3.text:
            # Try to find the actual content h3, not the search form h3
            all_h3s = soup.find_all('h3')
            title_h3 = None
            for h3 in all_h3s:
                if 'Search Standards' not in h3.text and len(h3.text.strip()) > 10:
                    title_h3 = h3
                    break
        
        if not title_h3:
            print(f"    - No title found for standard {standard_number}")
            return None
            
        title = title_h3.text.strip()
        
        # Find the main data table
        data_table = soup.find('table', class_='noHover')
        if not data_table:
            print(f"    - No data table found for standard {standard_number}")
            return None
        
        # Extract data from the table
        table_rows = data_table.find_all('tr')
        if len(table_rows) < 1:
            print(f"    - Invalid table structure for standard {standard_number}")
            return None
        
        # Get the second cell which contains all the values
        value_cell = table_rows[0].find_all('td')[1] if len(table_rows[0].find_all('td')) > 1 else None
        if not value_cell:
            print(f"    - No value cell found for standard {standard_number}")
            return None
        
        # Split the cell content by <br> tags to get individual values
        cell_content = str(value_cell).replace('<br>', '\n').replace('<br/>', '\n')
        cell_soup = BeautifulSoup(cell_content, 'html.parser')
        lines = [line.strip() for line in cell_soup.get_text().split('\n') if line.strip()]
        
        if len(lines) < 4:
            print(f"    - Insufficient data lines for standard {standard_number}")
            return None
        
        # Extract credits (first line)
        try:
            credits = int(lines[0])
        except (ValueError, IndexError):
            credits = 0
            print(f"    - Could not parse credits for standard {standard_number}")
        
        # Extract assessment type (second line) - only Internal or External
        assessment_type = None
        if len(lines) > 1:
            assessment_line = lines[1].lower()
            if 'internal' in assessment_line:
                assessment_type = 'Internal'
            elif 'external' in assessment_line:
                assessment_type = 'External'
        
        # Extract subjects from links in the "Belongs to" section
        # Need to skip the "Te Kete Ipurangi" link for Internal assessments
        subject_links = value_cell.find_all('a')
        subjects = []
        
        for link in subject_links:
            subject_text = link.text.strip()
            
            # Skip the Te Kete Ipurangi link (appears in Internal assessments)
            if 'Te Kete Ipurangi' in subject_text or 'ncea.tki.org.nz' in link.get('href', ''):
                continue
            
            # Clean up subject text (remove parenthetical content)
            subject_clean = re.sub(r'\s*\([^)]*\)', '', subject_text).strip()
            if subject_clean and subject_clean not in subjects:
                subjects.append(subject_clean)
        
        # Extract standard type from the dataHighlight row
        standard_type = None
        highlight_row = soup.find('tr', class_='dataHighlight')
        if highlight_row:
            highlight_text = highlight_row.text.lower()
            if 'unit standard' in highlight_text:
                standard_type = 'Unit'
            elif 'achievement standard' in highlight_text:
                standard_type = 'Achievement'
        
        result = {
            'title': title,
            'credits': credits,
            'assessment_type': assessment_type,
            'subjects': subjects,
            'standard_type': standard_type
        }
        
        print(f"    - Successfully scraped: {title[:50]}...")
        return result
        
    except Exception as e:
        print(f"    - Error scraping standard {standard_number}: {e}")
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
    # Use older file for 2018-2021, newer file for 2022-2024 (avoid duplication)
    old_weights_df = old_weights_df[
        old_weights_df['Academic Year'] <= 2021].copy()
    new_weights_df = new_weights_df[
        new_weights_df['Academic Year'] >= 2022].copy()
    
    print(f"Old weights file (2018-2021): {len(old_weights_df)} records")
    print(f"New weights file (2022-2024): {len(new_weights_df)} records")

    # Fix column names and handle missing 'Standard Version' in old file
    old_weights_df.rename(columns={'Standard': 'Standard Number',
                                   'Adjusted Not Achieved Percentile': 'weight_not_achieved',
                                   'Adjusted Achieved Percentile': 'weight_achieved',
                                   'Adjusted Merit Percentile': 'weight_merit',
                                   'Adjusted Excellence Percentile': 'weight_excellence'},
                          inplace=True)
    
    # Add missing Standard Version column to old file with unique versions
    if 'Standard Version ' not in old_weights_df.columns:
        # Create unique version numbers for each standard+year combination
        old_weights_df['Standard Version '] = old_weights_df.groupby(['Standard Number', 'Academic Year']).cumcount() + 1
        print("Added incremental 'Standard Version ' column to old weights data")
    
    new_weights_df.rename(columns={'Standard Number': 'Standard Number',
                                   'Standard Version': 'Standard Version ',  # Note: new file has no trailing space
                                   'Adjusted Not Achieved Percentile': 'weight_not_achieved',
                                   'Adjusted Achieved Percentile': 'weight_achieved',  # Fixed space issue
                                   'Adjusted Merit Percentile': 'weight_merit',
                                   'Adjusted Excellence Percentile': 'weight_excellence'},
                          inplace=True)

    merged_weights_df = pd.concat([old_weights_df, new_weights_df],
                                  ignore_index=True)
    all_standard_numbers = sorted(
        list(merged_weights_df['Standard Number'].unique()))
    
    # Debug information
    print(f"Merged weights data coverage:")
    print(f"  - Years: {sorted(merged_weights_df['Academic Year'].unique())}")
    print(f"  - Total weighting records: {len(merged_weights_df)}")
    print(f"  - Unique standards: {len(all_standard_numbers)}")
    
    # Verify we have 2018-2024 coverage
    expected_years = list(range(2018, 2025))
    actual_years = sorted(merged_weights_df['Academic Year'].unique())
    missing_years = set(expected_years) - set(actual_years)
    if missing_years:
        print(f"  - WARNING: Missing years: {sorted(missing_years)}")
    else:
        print(f"  - ✅ Complete 2018-2024 coverage!")

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

        # --- 4. Create Basic Standard Records First ---
        print("Creating basic standard records from CSV data...")
        for std_num in all_standard_numbers:
            # Convert numpy types to Python types
            std_num = int(std_num)
            
            # Create basic standard record with minimal data
            is_ue = std_num in ue_lookup
            main_subject = ue_lookup[std_num] if is_ue else None
            
            # Apply subject overrides
            if str(std_num) in overrides.get("subject_overrides", {}):
                main_subject = overrides["subject_overrides"][str(std_num)]

            # Create basic keywords
            primary_keywords = set()
            if str(std_num) in overrides.get("standard_aliases", {}):
                primary_keywords.update(overrides["standard_aliases"][str(std_num)])
            primary_keywords.add(str(std_num))
            if main_subject:
                primary_keywords.add(normalize_text(main_subject))

            new_standard = Standard(
                standard_number=std_num,
                title=f"Standard {std_num}",  # Default title, will be updated if scraping succeeds
                credits=0,  # Default, will be updated if scraping succeeds
                subject=main_subject,
                assessment_type=None,  # Will be updated if scraping succeeds
                standards_type=None,  # Will be updated if scraping succeeds
                is_ue=is_ue,
                search_keywords={"primary": sorted(list(primary_keywords)), "groups": []}
            )
            db.add(new_standard)

        print("Committing basic standards to database...")
        db.commit()

        # --- 5. Enhanced Standards with Scraped Data ---
        print("Enhancing standards with improved NZQA scraping...")
        enhanced_count = 0
        failed_count = 0
        
        for std_num in all_standard_numbers:
            # Convert numpy types to Python types
            std_num = int(std_num)
            
            scraped_data = scrape_nzqa_standard_enhanced(std_num)
            if scraped_data:
                # Update the existing standard with scraped data
                standard = db.query(Standard).filter(Standard.standard_number == std_num).first()
                if standard:
                    standard.title = scraped_data['title']
                    standard.credits = scraped_data['credits']
                    standard.assessment_type = scraped_data['assessment_type']
                    standard.standards_type = scraped_data['standard_type']
                    
                    # Handle subject logic: UE subjects take priority, then first scraped subject
                    if std_num in ue_lookup:
                        standard.subject = ue_lookup[std_num]
                    elif scraped_data['subjects']:
                        standard.subject = scraped_data['subjects'][0]
                    
                    # Update keywords with scraped title
                    current_keywords = standard.search_keywords
                    title_norm = normalize_text(scraped_data['title'])
                    title_words = title_norm.split()
                    prominent_words = [word for word in title_words if 
                                     word not in STOP_WORDS and len(word) > 2]
                    current_keywords['primary'].extend(prominent_words)
                    current_keywords['primary'] = sorted(list(set(current_keywords['primary'])))
                    standard.search_keywords = current_keywords
                    
                    enhanced_count += 1
            else:
                failed_count += 1
            
            # Be respectful to the server
            time.sleep(0.3)

        print(f"Enhanced {enhanced_count} standards with scraped data.")
        print(f"Failed to scrape {failed_count} standards (kept basic records).")
        print("Committing enhanced standards to database...")
        db.commit()

        # --- 6. Final Pass to Build Groups ---
        print("Building search groups...")
        all_standards_from_db = db.query(Standard).all()
        for standard in all_standards_from_db:
            standard_groups = set()
            if standard.subject and standard.assessment_type:
                primary_group = f"{standard.subject} {standard.assessment_type}s"
                standard_groups.add(primary_group)
                if standard.standards_type == 'Achievement Standard':
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

        # --- 7. Process and Insert Weightings ---
        print("Processing and inserting weighting data...")

        # Clean the DataFrame before inserting
        weight_cols = ['weight_not_achieved', 'weight_achieved',
                       'weight_merit', 'weight_excellence']
        merged_weights_df.dropna(subset=['Standard Number', 'Academic Year',
                                         'Standard Version '] + weight_cols,
                                 inplace=True)

        # Ensure correct data types
        merged_weights_df['Standard Number'] = merged_weights_df[
            'Standard Number'].astype(int)
        merged_weights_df['Academic Year'] = merged_weights_df[
            'Academic Year'].astype(int)
        merged_weights_df['Standard Version '] = merged_weights_df[
            'Standard Version '].astype(int)
        for col in weight_cols:
            merged_weights_df[col] = merged_weights_df[col].astype(float)

        print(f"Final weighting data before insertion:")
        print(f"  - Records: {len(merged_weights_df)}")
        print(f"  - Years: {sorted(merged_weights_df['Academic Year'].unique())}")
        print(f"  - Year counts: {merged_weights_df['Academic Year'].value_counts().sort_index().to_dict()}")

        for index, row in merged_weights_df.iterrows():
            new_weighting = StandardWeighting(
                standard_number=int(row['Standard Number']),
                academic_year=int(row['Academic Year']),
                standard_version=int(row['Standard Version ']),
                weight_not_achieved=float(row['weight_not_achieved']),
                weight_achieved=float(row['weight_achieved']),
                weight_merit=float(row['weight_merit']),
                weight_excellence=float(row['weight_excellence'])
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
