import os
import re
import time
import pandas as pd
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# 1. Determine paths relative to the current working directory
CWD = os.getcwd()
DATA_DIR = os.path.join(CWD, 'resources')
INPUT_CSV = os.path.join(DATA_DIR, 'standards_di_20240327.csv')
OUTPUT_CSV = os.path.join(DATA_DIR, 'standards_full.csv')

# Debug: show where we’re running
print("Current working directory:", os.getcwd())
print("Resource directory       :", DATA_DIR)
print("Expecting input CSV at   :", INPUT_CSV)
print("Will write output CSV to :", OUTPUT_CSV)
print()

# 2. Ensure resources folder exists
os.makedirs(DATA_DIR, exist_ok=True)


# 3. Utility: remove parenthesized text
def clean_parentheses(text: str) -> str:
    return re.sub(r'\s*\([^)]*\)', '', text).strip()


def scrape_standard(std_no: str) -> dict:
    url = f"https://www.nzqa.govt.nz/ncea/assessment/view-detailed.do?standardNumber={std_no}"
    try:
        # Use a local file for debugging if it exists
        html_path = f"Standard {std_no}.html"
        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8') as f:
                res_text = f.read()
        else:
            res = requests.get(url, timeout=5)
            res.raise_for_status()
            # Explicitly set encoding to handle special characters correctly
            res.encoding = 'utf-8'
            res_text = res.text
    except requests.RequestException:
        return None

    soup = BeautifulSoup(res_text, 'html.parser')

    # Metadata table = first table.noHover
    meta_table = soup.select_one('table.noHover')
    if not meta_table:
        return None

    # The title is the h3 immediately preceding the metadata table
    title_h3 = meta_table.find_previous_sibling('h3')
    title = title_h3.get_text(strip=True) if title_h3 else 'UNKNOWN'

    # Initialize with default values
    data = {
        'credits': 'UNKNOWN',
        'assessment_type': 'UNKNOWN',
        'subject': 'UNKNOWN'
    }

    # Get all text from the value cell, split into lines
    value_cell = meta_table.find('td').find_next_sibling('td')
    if not value_cell:
        return None  # Cannot proceed if the table structure is unexpected

    lines = [line.strip() for line in value_cell.get_text('\n').split('\n') if
             line.strip()]

    # Extract data based on labels
    labels = [strong.get_text(strip=True).lower() for strong in
              meta_table.find_all('strong')]

    try:
        if 'credits:' in labels:
            data['credits'] = lines[labels.index('credits:')]
        if 'assessment:' in labels:
            # Assessment type is the text before the first '-'
            raw_assessment = lines[labels.index('assessment:')]
            data['assessment_type'] = raw_assessment.split('-')[0].strip()
    except (ValueError, IndexError):
        # Handle cases where a label exists but its corresponding value line is missing
        pass

    # Subject is the last link in the 'Belongs to' section
    subject_links = value_cell.find_all('a')
    if subject_links:
        # The last link is usually the main subject
        raw_subject = subject_links[-1].get_text(strip=True)
        data['subject'] = clean_parentheses(raw_subject)

    return {
        'standard': std_no,
        'title': title,
        'credits': data['credits'],
        'assessment_type': data['assessment_type'],
        'subject': data['subject']
    }


def main():
    df = pd.read_csv(INPUT_CSV)
    unique_stds = df['Standard'].dropna().astype(str).unique()
    print(f"Found {len(unique_stds)} unique standards to fetch.\n")

    records = []
    # Use tqdm for a progress bar
    for std in tqdm(unique_stds, desc="Scraping standards"):
        rec = scrape_standard(std)
        if rec:
            records.append(rec)
        time.sleep(0.1)  # Be polite to the server

    # Write output
    out_df = pd.DataFrame(records)
    # Save with 'utf-8-sig' encoding to correctly handle special characters
    out_df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8-sig')
    abs_out = os.path.abspath(OUTPUT_CSV)
    print(f"\nDone! Wrote {len(out_df)} rows to:\n   {abs_out}\n")

    # List files in the folder so you can see it
    print("Contents of resources/ directory:")
    for fname in sorted(os.listdir(DATA_DIR)):
        print("  -", fname)

if __name__ == '__main__':
    main()