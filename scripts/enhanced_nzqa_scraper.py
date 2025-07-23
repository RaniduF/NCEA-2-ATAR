import sys
import os
import json
import re
import time
import pandas as pd
import requests
from bs4 import BeautifulSoup

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import Standard


def load_ue_subjects():
    """Load UE subjects mapping from CSV file"""
    ue_subjects_path = os.path.join(project_root, 'data', 'ue_subjects_2025-07-20.csv')
    ue_lookup = {}
    
    try:
        ue_df = pd.read_csv(ue_subjects_path)
        
        # Use the actual column names (with trailing spaces)
        subject_col = ue_df.columns[0]  # 'Approved Subject '
        standards_col = ue_df.columns[1]  # 'Achievement Standards '
        
        for index, row in ue_df.iterrows():
            subject_name = row[subject_col].strip()
            standards_cell = row[standards_col]
            
            if pd.notna(standards_cell):
                for std_num_str in str(standards_cell).split(','):
                    try:
                        std_num_int = int(std_num_str.strip())
                        ue_lookup[std_num_int] = subject_name
                    except ValueError:
                        pass
        
        print(f"Loaded UE subjects for {len(ue_lookup)} standards")
        return ue_lookup
    except FileNotFoundError:
        print(f"Warning: UE subjects file not found at {ue_subjects_path}")
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


def update_database_with_scraped_data():
    """Update all standards in database with scraped NZQA data"""
    print("=== Enhanced NZQA Database Update ===")
    
    # Load UE subjects mapping
    ue_lookup = load_ue_subjects()
    
    db = SessionLocal()
    try:
        # Get all standards that need updating
        standards = db.query(Standard).all()
        print(f"Found {len(standards)} standards to update")
        
        updated_count = 0
        failed_count = 0
        
        for standard in standards:
            std_num = standard.standard_number
            
            # Skip if already has detailed data (optional - remove if you want to re-scrape all)
            if standard.title != f"Standard {std_num}" and standard.credits > 0:
                print(f"  - Skipping {std_num} (already has data)")
                continue
            
            # Scrape data from NZQA
            scraped_data = scrape_nzqa_standard_enhanced(std_num)
            
            if scraped_data:
                # Update basic fields
                standard.title = scraped_data['title']
                standard.credits = scraped_data['credits']
                standard.assessment_type = scraped_data['assessment_type']
                standard.standards_type = scraped_data['standard_type']
                
                # Handle subject logic: UE subjects take priority, then first scraped subject
                if std_num in ue_lookup:
                    standard.subject = ue_lookup[std_num]
                    print(f"    - Using UE subject: {ue_lookup[std_num]}")
                elif scraped_data['subjects']:
                    standard.subject = scraped_data['subjects'][0]
                    print(f"    - Using scraped subject: {scraped_data['subjects'][0]}")
                
                updated_count += 1
                
                # Commit every 10 records to avoid losing progress
                if updated_count % 10 == 0:
                    db.commit()
                    print(f"  - Committed {updated_count} updates...")
                
            else:
                failed_count += 1
                print(f"    - Failed to scrape standard {std_num}")
            
            # Be respectful to the server
            time.sleep(0.3)
        
        # Final commit
        db.commit()
        
        print(f"\n=== Update Complete ===")
        print(f"Successfully updated: {updated_count} standards")
        print(f"Failed to scrape: {failed_count} standards")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    update_database_with_scraped_data() 