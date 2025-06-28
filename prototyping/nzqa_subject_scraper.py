import os
import re
import time
import pandas as pd
import requests
from bs4 import BeautifulSoup

# 1. Determine paths relative to this script
HERE       = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(HERE, 'resources')
INPUT_CSV  = os.path.join(DATA_DIR, 'standards_di_20240327.csv')
OUTPUT_CSV = os.path.join(DATA_DIR, 'standards_full.csv')

# Debug: show where we’re running
print("Current working directory:", os.getcwd())
print("Script file location       :", HERE)
print("Expecting input CSV at     :", INPUT_CSV)
print("Will write output CSV to   :", OUTPUT_CSV)
print()

# 2. Ensure resources folder exists
os.makedirs(DATA_DIR, exist_ok=True)

# 3. Utility: remove parenthesized text
def clean_parentheses(text: str) -> str:
    return re.sub(r'\s*\([^)]*\)', '', text).strip()

# 4. Scraper function
def scrape_standard(std_no: str) -> dict:
    url = f"https://www.nzqa.govt.nz/ncea/assessment/view-detailed.do?standardNumber={std_no}"
    print(f"→ Fetching {std_no}", end="", flush=True)
    try:
        res = requests.get(url, timeout=5)
        res.raise_for_status()
    except Exception as e:
        print(f"  ⚠️  FAILED ({e.__class__.__name__})")
        return None

    soup = BeautifulSoup(res.text, 'html.parser')

    # Title = first <h3> under #mainPage
    h3 = soup.select_one('#mainPage h3')
    title = h3.get_text(strip=True) if h3 else 'UNKNOWN'

    # Metadata table = first table.noHover
    meta_cells = soup.select_one('table.noHover').find_all('td')
    meta_lines = [
        line.strip()
        for line in meta_cells[1].get_text("\n").split("\n")
        if line.strip()
    ]
    credits         = meta_lines[0] if len(meta_lines) > 0 else 'UNKNOWN'
    raw_assess      = meta_lines[1] if len(meta_lines) > 1 else ''
    assessment_type = raw_assess.split('-', 1)[0].strip()

    # Subjects = re-parse same cell’s <a> links
    raw_subjects = [a.get_text(strip=True) for a in meta_cells[1].find_all('a')]
    cleaned_subj = [clean_parentheses(s) for s in raw_subjects]
    subject      = cleaned_subj[-1] if cleaned_subj else 'UNKNOWN'

    print("  ✅")
    return {
        'standard':       std_no,
        'title':          title,
        'credits':        credits,
        'assessment_type': assessment_type,
        'subject':         subject
    }

def main():
    df = pd.read_csv(INPUT_CSV)
    unique_stds = df['Standard'].dropna().astype(str).unique()
    print(f"Found {len(unique_stds)} unique standards to fetch.\n")

    records = []
    for std in unique_stds:
        rec = scrape_standard(std)
        if rec:
            records.append(rec)

    # Write output
    out_df = pd.DataFrame(records)
    out_df.to_csv(OUTPUT_CSV, index=False)
    abs_out = os.path.abspath(OUTPUT_CSV)
    print(f"\nDone! Wrote {len(out_df)} rows to:\n   {abs_out}\n")

    # List files in the folder so you can see it
    print("Contents of resources/ directory:")
    for fname in sorted(os.listdir(DATA_DIR)):
        print("  -", fname)

if __name__ == '__main__':
    main()
