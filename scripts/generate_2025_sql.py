"""
generate_2025_sql.py
====================
Generates SQL files for the 2025 academic year data:

  1. database/08-2025-participation-rate.sql
  2. database/09-2025-atar-distributions.sql
  3. database/10-2025-standard-weightings.sql
  4. database/11-2025-new-standards.sql  (new standards scraped from NZQA)

Usage (from project root):
    python scripts/generate_2025_sql.py

The generated SQL files use INSERT ... ON CONFLICT DO NOTHING so they are
safe to re-run and can be added to the Docker init sequence.

After generation, add the new SQL files to docker-compose.dev.yml and
docker-compose.yml volumes, then restart Docker.

To skip NZQA scraping (faster, uses placeholder titles for unknowns):
    python scripts/generate_2025_sql.py --no-scrape
"""

import sys
import os
import re
import time
import argparse
import requests
import pandas as pd
from bs4 import BeautifulSoup
from decimal import Decimal

# ── Configuration ──────────────────────────────────────────────────────────────
ACADEMIC_YEAR = 2025
WEIGHTED_STATNZ_POPULATION = "72054.4"
NZ_TOTAL_CANDIDATURE = 46017

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(project_root, "data")
DB_DIR = os.path.join(project_root, "database")

WEIGHTS_CSV = os.path.join(DATA_DIR, "standard_weightings_2026-05-29.csv")
ATAR_CSV = os.path.join(DATA_DIR, "atar_distributions_2026-05-29.csv")
STANDARD_DETAILS_CSV = os.path.join(DATA_DIR, "standard_details_2025-07-01.csv")
UE_SUBJECTS_CSV = os.path.join(DATA_DIR, "ue_subjects_2025-07-20.csv")

# Existing standards SQL (to know which standards already have records)
EXISTING_STANDARDS_SQL = os.path.join(DB_DIR, "02-standards-data.sql")

SCRAPE_DELAY = 0.4  # seconds between NZQA requests


# ── Helpers ─────────────────────────────────────────────────────────────────────

def escape_sql_string(s: str) -> str:
    """Escape a string for SQL insertion."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def load_ue_lookup() -> dict:
    try:
        df = pd.read_csv(UE_SUBJECTS_CSV)
        subject_col = df.columns[0]
        standards_col = df.columns[1]
        lookup = {}
        for _, row in df.iterrows():
            if pd.notna(row[standards_col]):
                for s in str(row[standards_col]).split(","):
                    try:
                        lookup[int(s.strip())] = str(row[subject_col]).strip()
                    except ValueError:
                        pass
        print(f"  Loaded UE lookup for {len(lookup)} standards.")
        return lookup
    except FileNotFoundError:
        print(f"  Warning: UE subjects file not found.")
        return {}


def load_standard_details_lookup() -> dict:
    try:
        df = pd.read_csv(STANDARD_DETAILS_CSV)
        df.columns = [c.strip() for c in df.columns]
        lookup = {}
        for _, row in df.iterrows():
            try:
                std_num = int(row["standard"])
                lookup[std_num] = {
                    "title": str(row["title"]).strip(),
                    "credits": int(row["credits"]) if pd.notna(row["credits"]) else 0,
                    "assessment_type": str(row["assessment_type"]).strip() if pd.notna(row["assessment_type"]) else None,
                    "subject": str(row["subject"]).strip() if pd.notna(row["subject"]) else None,
                }
            except (ValueError, KeyError):
                pass
        print(f"  Loaded local details for {len(lookup)} standards.")
        return lookup
    except FileNotFoundError:
        print(f"  Warning: Standard details CSV not found.")
        return {}


def load_existing_standard_numbers() -> set:
    """Parse existing standards from the SQL file to avoid re-inserting them."""
    existing = set()
    try:
        with open(EXISTING_STANDARDS_SQL, "r", encoding="utf-8") as f:
            content = f.read()
        # Extract standard numbers from INSERT statements.
        # Existing SQL uses one `INSERT ... VALUES (n,'…'),(n,'…'),…` per statement,
        # so match every `(NUMBER,'` tuple — not just the one after VALUES.
        for match in re.finditer(r"\((\d+),'", content):
            existing.add(int(match.group(1)))
        print(f"  Found {len(existing)} existing standards in {os.path.basename(EXISTING_STANDARDS_SQL)}.")
    except FileNotFoundError:
        print(f"  Warning: {EXISTING_STANDARDS_SQL} not found – assuming no existing standards.")
    return existing


def scrape_nzqa_standard(standard_number: int) -> dict | None:
    """Scrape a standard's details from the NZQA website."""
    url = f"https://www.nzqa.govt.nz/ncea/assessment/view-detailed.do?standardNumber={standard_number}"
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        title = None
        for h3 in soup.find_all("h3"):
            text = h3.text.strip()
            if "Search Standards" not in text and len(text) > 10:
                title = text
                break
        if not title:
            return None

        data_table = soup.find("table", class_="noHover")
        if not data_table:
            return None

        rows = data_table.find_all("tr")
        if not rows:
            return None

        tds = rows[0].find_all("td")
        if len(tds) < 2:
            return None

        value_cell = tds[1]
        cell_html = str(value_cell).replace("<br>", "\n").replace("<br/>", "\n")
        lines = [l.strip() for l in BeautifulSoup(cell_html, "html.parser").get_text().split("\n") if l.strip()]

        credits = 0
        if lines:
            try:
                credits = int(lines[0])
            except ValueError:
                pass

        assessment_type = None
        if len(lines) > 1:
            al = lines[1].lower()
            if "internal" in al:
                assessment_type = "Internal"
            elif "external" in al:
                assessment_type = "External"

        subjects = []
        for a in value_cell.find_all("a"):
            text = a.text.strip()
            href = a.get("href", "")
            if "Te Kete Ipurangi" in text or "ncea.tki.org.nz" in href:
                continue
            clean = re.sub(r"\s*\([^)]*\)", "", text).strip()
            if clean and clean not in subjects:
                subjects.append(clean)

        standard_type = None
        hl_row = soup.find("tr", class_="dataHighlight")
        if hl_row:
            hl = hl_row.text.lower()
            if "unit standard" in hl:
                standard_type = "Unit"
            elif "achievement standard" in hl:
                standard_type = "Achievement"

        return {
            "title": title,
            "credits": credits,
            "assessment_type": assessment_type,
            "subjects": subjects,
            "standard_type": standard_type,
        }
    except Exception as exc:
        print(f"    ✗ Scrape error for {standard_number}: {exc}")
        return None


# ── SQL generation ───────────────────────────────────────────────────────────────

def generate_participation_rate_sql() -> str:
    lines = [
        "-- 2025 participation rate data",
        "-- weighted_statnz_population = 72,054.4  |  nz_total_candidature = 46,017",
        f"INSERT INTO participation_rates (academic_year, weighted_statnz_population, nz_total_candidature)",
        f"VALUES ({ACADEMIC_YEAR},{WEIGHTED_STATNZ_POPULATION},{NZ_TOTAL_CANDIDATURE})",
        f"ON CONFLICT (academic_year) DO NOTHING;",
    ]
    return "\n".join(lines) + "\n"


def generate_atar_distributions_sql() -> str:
    df = pd.read_csv(ATAR_CSV)
    df.columns = [c.strip() for c in df.columns]
    df = df[df["Academic Year"].astype(int) == ACADEMIC_YEAR].copy()
    print(f"  {len(df)} ATAR distribution rows loaded.")

    chunks = []
    chunk_size = 1000
    rows = []
    for _, row in df.iterrows():
        stat_val = str(row["Statistic Value"]).strip()
        freq = int(row["Frequency Count"])
        rows.append(f"({ACADEMIC_YEAR},{stat_val},{freq})")

    header = "-- 2025 ATAR distribution data\n"
    header += "INSERT INTO atar_distributions (academic_year, statistical_value, frequency)\nVALUES\n"

    result_parts = [header]
    for i in range(0, len(rows), chunk_size):
        batch = rows[i:i+chunk_size]
        result_parts.append(",\n".join(batch))
        result_parts.append("\nON CONFLICT DO NOTHING;\n")
        if i + chunk_size < len(rows):
            result_parts.append("\nINSERT INTO atar_distributions (academic_year, statistical_value, frequency)\nVALUES\n")

    return "".join(result_parts)


def generate_standard_weightings_sql() -> str:
    # Row 0 = descriptive title, Row 1 = actual headers
    df = pd.read_csv(WEIGHTS_CSV, header=1)
    df.columns = [c.strip() for c in df.columns]
    col_map = {
        "Adjusted Not Achieved Percentile": "w_na",
        "Adjusted  Achieved Percentile": "w_a",
        "Adjusted Achieved Percentile": "w_a",
        "Adjusted Merit Percentile": "w_m",
        "Adjusted Excellence Percentile": "w_e",
        "Standard Version": "ver",
        "Standard Number": "std_num",
        "Academic Year": "year",
    }
    df.rename(columns={c.strip(): v for c, v in col_map.items()}, inplace=True)
    df = df[df["year"].astype(int) == ACADEMIC_YEAR].copy()
    print(f"  {len(df)} standard weighting rows loaded.")

    rows = []
    for _, row in df.iterrows():
        std_num = int(row["std_num"])
        ver = int(row["ver"])
        w_na = float(row["w_na"])
        w_a = float(row["w_a"])
        w_m = float(row["w_m"])
        w_e = float(row["w_e"])
        rows.append(
            f"({std_num},{ACADEMIC_YEAR},{ver},"
            f"{repr(w_na)},{repr(w_a)},{repr(w_m)},{repr(w_e)})"
        )

    chunk_size = 500
    header = (
        "-- 2025 standard weightings data\n"
        "INSERT INTO standard_weightings "
        "(standard_number,academic_year,standard_version,"
        "weight_not_achieved,weight_achieved,weight_merit,weight_excellence)\nVALUES\n"
    )

    result_parts = [header]
    for i in range(0, len(rows), chunk_size):
        batch = rows[i:i+chunk_size]
        result_parts.append(",\n".join(batch))
        result_parts.append("\nON CONFLICT DO NOTHING;\n")
        if i + chunk_size < len(rows):
            result_parts.append(
                "\nINSERT INTO standard_weightings "
                "(standard_number,academic_year,standard_version,"
                "weight_not_achieved,weight_achieved,weight_merit,weight_excellence)\nVALUES\n"
            )

    return "".join(result_parts)


def generate_new_standards_sql(scrape_missing: bool = True) -> str:
    # Row 0 = descriptive title, Row 1 = actual headers
    df = pd.read_csv(WEIGHTS_CSV, header=1)
    df.columns = [c.strip() for c in df.columns]
    df.rename(columns={"Standard Number": "std_num"}, inplace=True)
    all_std_nums = sorted(df["std_num"].astype(int).unique().tolist())

    existing = load_existing_standard_numbers()
    ue_lookup = load_ue_lookup()
    details_lookup = load_standard_details_lookup()

    new_stds = [n for n in all_std_nums if n not in existing]
    print(f"  {len(all_std_nums)} standards in weighting file, {len(existing)} already in DB, "
          f"{len(new_stds)} are new.")

    if not new_stds:
        return "-- No new standards to insert for 2025\n"

    rows = []
    for i, std_num in enumerate(new_stds):
        print(f"  [{i+1}/{len(new_stds)}] Processing standard {std_num}…", end="")

        # Try local details first
        details = details_lookup.get(std_num)
        if details:
            title = details["title"]
            credits = details["credits"]
            assessment_type = details.get("assessment_type")
            standards_type = None
            subject = details.get("subject")
            print(f" (local CSV) '{title[:50]}'")
        elif scrape_missing:
            print(f" (scraping NZQA)…", end="", flush=True)
            scraped = scrape_nzqa_standard(std_num)
            time.sleep(SCRAPE_DELAY)
            if scraped:
                title = scraped["title"]
                credits = scraped["credits"]
                assessment_type = scraped["assessment_type"]
                standards_type = scraped["standard_type"]
                subject = scraped["subjects"][0] if scraped["subjects"] else None
                print(f" ✓ '{title[:50]}'")
            else:
                title = f"Standard {std_num}"
                credits = 0
                assessment_type = None
                standards_type = None
                subject = None
                print(f" ✗ placeholder")
        else:
            title = f"Standard {std_num}"
            credits = 0
            assessment_type = None
            standards_type = None
            subject = None
            print(f" (no-scrape) placeholder")

        # UE overrides subject
        is_ue = std_num in ue_lookup
        if is_ue:
            subject = ue_lookup[std_num]

        keywords_json = '{{"primary": ["{0}"], "groups": []}}'.format(std_num)

        rows.append(
            f"({std_num},"
            f"{escape_sql_string(title)},"
            f"{credits},"
            f"{escape_sql_string(assessment_type)},"
            f"{escape_sql_string(standards_type)},"
            f"{'TRUE' if is_ue else 'FALSE'},"
            f"{escape_sql_string(subject)},"
            f"'{keywords_json}'::jsonb)"
        )

    header = (
        f"-- New standards introduced in {ACADEMIC_YEAR} data\n"
        f"INSERT INTO standards "
        f"(standard_number,title,credits,assessment_type,standards_type,is_ue,subject,search_keywords)\n"
        f"VALUES\n"
    )

    chunk_size = 100
    result_parts = [header]
    for i in range(0, len(rows), chunk_size):
        batch = rows[i:i+chunk_size]
        result_parts.append(",\n".join(batch))
        result_parts.append("\nON CONFLICT (standard_number) DO NOTHING;\n")
        if i + chunk_size < len(rows):
            result_parts.append(
                "\nINSERT INTO standards "
                "(standard_number,title,credits,assessment_type,standards_type,is_ue,subject,search_keywords)\n"
                "VALUES\n"
            )

    return "".join(result_parts)


# ── Main ─────────────────────────────────────────────────────────────────────────

def main(scrape: bool = True):
    print(f"\n{'='*60}")
    print(f" Generating SQL files for {ACADEMIC_YEAR} data")
    print(f"{'='*60}\n")

    os.makedirs(DB_DIR, exist_ok=True)

    # 1. Participation rate
    print("[1/4] Generating participation rate SQL…")
    pr_sql = generate_participation_rate_sql()
    pr_path = os.path.join(DB_DIR, "08-2025-participation-rate.sql")
    with open(pr_path, "w", encoding="utf-8") as f:
        f.write(pr_sql)
    print(f"  ✓ Written to {os.path.basename(pr_path)}")

    # 2. ATAR distributions
    print("\n[2/4] Generating ATAR distributions SQL…")
    atar_sql = generate_atar_distributions_sql()
    atar_path = os.path.join(DB_DIR, "09-2025-atar-distributions.sql")
    with open(atar_path, "w", encoding="utf-8") as f:
        f.write(atar_sql)
    print(f"  ✓ Written to {os.path.basename(atar_path)}")

    # 3. New standards (must come before weightings due to FK)
    print(f"\n[3/4] Generating new standards SQL{' (NZQA scraping enabled)' if scrape else ' (no scraping)'}…")
    new_std_sql = generate_new_standards_sql(scrape_missing=scrape)
    new_std_path = os.path.join(DB_DIR, "10-2025-new-standards.sql")
    with open(new_std_path, "w", encoding="utf-8") as f:
        f.write(new_std_sql)
    print(f"  ✓ Written to {os.path.basename(new_std_path)}")

    # 4. Standard weightings
    print("\n[4/4] Generating standard weightings SQL…")
    weights_sql = generate_standard_weightings_sql()
    weights_path = os.path.join(DB_DIR, "11-2025-standard-weightings.sql")
    with open(weights_path, "w", encoding="utf-8") as f:
        f.write(weights_sql)
    print(f"  ✓ Written to {os.path.basename(weights_path)}")

    print(f"\n{'='*60}")
    print(f" Done! SQL files generated in database/")
    print(f"{'='*60}")
    print("""
Next steps:
  1. Add the new SQL files to docker-compose.dev.yml and docker-compose.yml:
       - ./database/10-2025-new-standards.sql:/docker-entrypoint-initdb.d/10-2025-new-standards.sql:ro
       - ./database/11-2025-standard-weightings.sql:/docker-entrypoint-initdb.d/11-2025-standard-weightings.sql:ro
       - ./database/08-2025-participation-rate.sql:/docker-entrypoint-initdb.d/08-2025-participation-rate.sql:ro
       - ./database/09-2025-atar-distributions.sql:/docker-entrypoint-initdb.d/09-2025-atar-distributions.sql:ro
  
  2. If Docker is already running with existing data, run the SQL files directly:
       docker exec -i ncea-database-dev psql -U ncea_user -d ncea_atar < database/10-2025-new-standards.sql
       docker exec -i ncea-database-dev psql -U ncea_user -d ncea_atar < database/11-2025-standard-weightings.sql
       docker exec -i ncea-database-dev psql -U ncea_user -d ncea_atar < database/08-2025-participation-rate.sql
       docker exec -i ncea-database-dev psql -U ncea_user -d ncea_atar < database/09-2025-atar-distributions.sql
""")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate SQL files for 2025 NCEA-ATAR data.")
    parser.add_argument(
        "--no-scrape",
        action="store_true",
        help="Skip NZQA scraping for new standards (uses placeholder titles).",
    )
    args = parser.parse_args()
    main(scrape=not args.no_scrape)
