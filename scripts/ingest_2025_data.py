"""
ingest_2025_data.py
===================
Ingests the 2025 academic year data into the database:

  1. Participation rate  : weighted_statnz_population=72054.4, nz_total_candidature=46017
  2. ATAR distributions  : data/atar_distributions_2026-05-29.csv
  3. Standard weightings : data/standard_weightings_2026-05-29.csv
     - Any standard number that does NOT already exist in the `standards` table
       will be created (using NZQA scraping to get title/credits/type/subject).

Usage (from project root):
    python scripts/ingest_2025_data.py

Dry-run mode (no DB writes):
    python scripts/ingest_2025_data.py --dry-run

Skip NZQA scraping (use placeholders for unknown standards):
    python scripts/ingest_2025_data.py --no-scrape
"""

import sys
import os
import re
import time
import argparse
import requests
import pandas as pd
from bs4 import BeautifulSoup

# --- Path Setup ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from sqlalchemy import text
from backend.app.db.session import SessionLocal
from backend.app.models.standard_models import (
    Standard,
    StandardWeighting,
    ATARDistribution,
    ParticipationRate,
)

# ============================================================================
# Configuration
# ============================================================================
ACADEMIC_YEAR = 2025
WEIGHTED_STATNZ_POPULATION = 72054.4  # stored as DECIMAL(20,10) in participation_rates
NZ_TOTAL_CANDIDATURE = 46017

DATA_DIR = os.path.join(project_root, "data")
WEIGHTS_CSV = os.path.join(DATA_DIR, "standard_weightings_2026-05-29.csv")
ATAR_CSV    = os.path.join(DATA_DIR, "atar_distributions_2026-05-29.csv")
STANDARD_DETAILS_CSV = os.path.join(DATA_DIR, "standard_details_2025-07-01.csv")
UE_SUBJECTS_CSV      = os.path.join(DATA_DIR, "ue_subjects_2025-07-20.csv")

SCRAPE_DELAY = 0.4   # seconds between NZQA requests


# ============================================================================
# Helpers
# ============================================================================

def load_ue_lookup():
    """Return {standard_number: subject_name} from UE subjects CSV."""
    try:
        df = pd.read_csv(UE_SUBJECTS_CSV)
        subject_col   = df.columns[0]
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
        print("  Warning: UE subjects file not found.")
        return {}


def load_standard_details_lookup():
    """Return {standard_number: dict} from local standard details CSV."""
    try:
        df = pd.read_csv(STANDARD_DETAILS_CSV)
        df.columns = [c.strip() for c in df.columns]
        lookup = {}
        for _, row in df.iterrows():
            try:
                std_num = int(row["standard"])
                lookup[std_num] = {
                    "title":           str(row["title"]).strip(),
                    "credits":         int(row["credits"]) if pd.notna(row["credits"]) else 0,
                    "assessment_type": str(row["assessment_type"]).strip() if pd.notna(row["assessment_type"]) else None,
                    "subject":         str(row["subject"]).strip() if pd.notna(row["subject"]) else None,
                }
            except (ValueError, KeyError):
                pass
        print(f"  Loaded local details for {len(lookup)} standards.")
        return lookup
    except FileNotFoundError:
        print("  Warning: Standard details CSV not found.")
        return {}


def scrape_nzqa_standard(standard_number):
    """Scrape a standard's details from the NZQA website."""
    url = (
        "https://www.nzqa.govt.nz/ncea/assessment/view-detailed.do"
        f"?standardNumber={standard_number}"
    )
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        title = None
        for h3 in soup.find_all("h3"):
            text_val = h3.text.strip()
            if "Search Standards" not in text_val and len(text_val) > 10:
                title = text_val
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
        cell_html  = str(value_cell).replace("<br>", "\n").replace("<br/>", "\n")
        lines      = [
            l.strip()
            for l in BeautifulSoup(cell_html, "html.parser").get_text().split("\n")
            if l.strip()
        ]

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
            a_text = a.text.strip()
            href   = a.get("href", "")
            if "Te Kete Ipurangi" in a_text or "ncea.tki.org.nz" in href:
                continue
            clean = re.sub(r"\s*\([^)]*\)", "", a_text).strip()
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
            "title":         title,
            "credits":       credits,
            "assessment_type": assessment_type,
            "subjects":      subjects,
            "standard_type": standard_type,
        }
    except Exception as exc:
        print(f"    Scrape error for {standard_number}: {exc}")
        return None


def ensure_standard_exists(db, std_num, ue_lookup, details_lookup,
                           dry_run, scrape_missing=True):
    """Create `std_num` in the standards table if it does not exist."""
    existing = (
        db.query(Standard.standard_number)
          .filter(Standard.standard_number == std_num)
          .first()
    )
    if existing:
        return True

    print(f"  -> New standard {std_num} - looking up details...")

    details = details_lookup.get(std_num)
    if details:
        title           = details["title"]
        credits         = details["credits"]
        assessment_type = details.get("assessment_type")
        standards_type  = None
        subject         = details.get("subject")
        print(f"     (local CSV) '{title[:60]}'")
    elif scrape_missing:
        print(f"     Not in local CSV - scraping NZQA...", end="", flush=True)
        scraped = scrape_nzqa_standard(std_num)
        time.sleep(SCRAPE_DELAY)
        if scraped:
            title           = scraped["title"]
            credits         = scraped["credits"]
            assessment_type = scraped["assessment_type"]
            standards_type  = scraped["standard_type"]
            subject         = scraped["subjects"][0] if scraped["subjects"] else None
            print(f" OK '{title[:60]}'")
        else:
            title = f"Standard {std_num}"
            credits = 0; assessment_type = None; standards_type = None; subject = None
            print(f" FAILED - using placeholder")
    else:
        title = f"Standard {std_num}"
        credits = 0; assessment_type = None; standards_type = None; subject = None
        print(f"     (no-scrape) placeholder")

    is_ue = std_num in ue_lookup
    if is_ue:
        subject = ue_lookup[std_num]

    if dry_run:
        print(f"     [DRY-RUN] Would insert standard {std_num}: '{title}'")
        return True

    new_std = Standard(
        standard_number=std_num,
        title=title,
        credits=credits,
        assessment_type=assessment_type,
        standards_type=standards_type,
        is_ue=is_ue,
        subject=subject,
        search_keywords={"primary": [str(std_num)], "groups": []},
    )
    db.add(new_std)
    db.flush()
    return True


# ============================================================================
# Main ingestion
# ============================================================================

def ingest_2025(dry_run=False, scrape=True):
    sep = "=" * 60
    print(f"\n{sep}")
    print(f" 2025 Data Ingestion {'(DRY RUN)' if dry_run else ''}")
    print(f"{sep}\n")

    # ---- 1. Load CSVs -------------------------------------------------------
    print("Loading CSV files...")

    # Row 0 = descriptive title, Row 1 = actual column headers
    weights_df = pd.read_csv(WEIGHTS_CSV, header=1)
    weights_df.columns = [c.strip() for c in weights_df.columns]
    col_map = {
        "Adjusted Not Achieved Percentile": "weight_not_achieved",
        "Adjusted  Achieved Percentile":    "weight_achieved",   # double-space
        "Adjusted Achieved Percentile":     "weight_achieved",   # single-space fallback
        "Adjusted Merit Percentile":        "weight_merit",
        "Adjusted Excellence Percentile":   "weight_excellence",
        "Standard Version":                 "Standard Version",
        "Standard Number":                  "Standard Number",
        "Academic Year":                    "Academic Year",
    }
    weights_df.rename(columns={c.strip(): v for c, v in col_map.items()}, inplace=True)
    weights_df = weights_df[weights_df["Academic Year"].astype(int) == ACADEMIC_YEAR].copy()
    weights_df["Standard Number"]  = weights_df["Standard Number"].astype(int)
    weights_df["Standard Version"] = weights_df["Standard Version"].astype(int)
    for col in ["weight_not_achieved", "weight_achieved", "weight_merit", "weight_excellence"]:
        weights_df[col] = weights_df[col].astype(float)
    print(f"  Loaded {len(weights_df)} weighting rows for {ACADEMIC_YEAR}.")

    atar_df = pd.read_csv(ATAR_CSV)
    atar_df.columns = [c.strip() for c in atar_df.columns]
    atar_df = atar_df[atar_df["Academic Year"].astype(int) == ACADEMIC_YEAR].copy()
    print(f"  Loaded {len(atar_df)} ATAR distribution rows for {ACADEMIC_YEAR}.")

    # ---- 2. Helper lookups --------------------------------------------------
    print("\nLoading helper data...")
    ue_lookup      = load_ue_lookup()
    details_lookup = load_standard_details_lookup()
    all_std_nums   = sorted(weights_df["Standard Number"].unique().tolist())
    print(f"  {len(all_std_nums)} unique standards in weightings file.")

    # ---- 3. DB work ---------------------------------------------------------
    db = SessionLocal()
    try:
        # ---- 3a. Participation rate -----------------------------------------
        print(f"\n[1/4] Participation rate for {ACADEMIC_YEAR}...")
        existing_pr = (
            db.query(ParticipationRate)
              .filter(ParticipationRate.academic_year == ACADEMIC_YEAR)
              .first()
        )
        if existing_pr:
            print(f"  Already exists ({existing_pr.weighted_statnz_population}, "
                  f"{existing_pr.nz_total_candidature}). Skipping.")
        else:
            if dry_run:
                print(f"  [DRY-RUN] Would insert ({ACADEMIC_YEAR}, "
                      f"{WEIGHTED_STATNZ_POPULATION}, {NZ_TOTAL_CANDIDATURE})")
            else:
                db.add(ParticipationRate(
                    academic_year=ACADEMIC_YEAR,
                    weighted_statnz_population=WEIGHTED_STATNZ_POPULATION,
                    nz_total_candidature=NZ_TOTAL_CANDIDATURE,
                ))
                db.commit()
                print("  OK - Inserted participation rate.")

        # ---- 3b. ATAR distributions -----------------------------------------
        print(f"\n[2/4] ATAR distributions for {ACADEMIC_YEAR}...")
        existing_atar = (
            db.query(ATARDistribution)
              .filter(ATARDistribution.academic_year == ACADEMIC_YEAR)
              .count()
        )
        if existing_atar > 0:
            print(f"  {existing_atar} rows already exist. Skipping.")
        else:
            if dry_run:
                print(f"  [DRY-RUN] Would insert {len(atar_df)} ATAR rows.")
            else:
                inserted = 0
                skipped  = 0
                # Use raw SQL INSERT ... ON CONFLICT DO NOTHING to safely
                # skip rows that map to the same DECIMAL(20,15) primary key.
                insert_sql = text(
                    "INSERT INTO atar_distributions "
                    "(academic_year, statistical_value, frequency) "
                    "VALUES (:yr, :sv, :fr) "
                    "ON CONFLICT DO NOTHING"
                )
                for _, row in atar_df.iterrows():
                    stat_val = float(str(row["Statistic Value"]).strip())
                    freq     = int(row["Frequency Count"])
                    result   = db.execute(insert_sql,
                                          {"yr": ACADEMIC_YEAR,
                                           "sv": stat_val,
                                           "fr": freq})
                    if result.rowcount == 1:
                        inserted += 1
                    else:
                        skipped += 1
                    if inserted > 0 and inserted % 5000 == 0:
                        db.commit()
                        print(f"    ...committed {inserted} ATAR rows...")
                db.commit()
                print(f"  OK - Inserted {inserted} ATAR rows "
                      f"({skipped} skipped as duplicates).")

        # ---- 3c. Ensure all standards exist ----------------------------------
        print(f"\n[3/4] Ensuring all {len(all_std_nums)} standards exist in DB...")
        new_stds = [
            n for n in all_std_nums
            if not db.query(Standard.standard_number)
                      .filter(Standard.standard_number == n)
                      .first()
        ]
        print(f"  {len(all_std_nums) - len(new_stds)} already in DB, "
              f"{len(new_stds)} are new.")

        for i, std_num in enumerate(new_stds):
            print(f"  [{i+1}/{len(new_stds)}] Standard {std_num}...")
            ensure_standard_exists(
                db, std_num, ue_lookup, details_lookup,
                dry_run, scrape_missing=scrape
            )
            if not dry_run and (i + 1) % 20 == 0:
                db.commit()
                print(f"    Committed {i+1} new standards so far...")

        if not dry_run and new_stds:
            db.commit()
            print(f"  OK - All {len(new_stds)} new standards committed.")

        # ---- 3d. Standard weightings ----------------------------------------
        print(f"\n[4/4] Standard weightings for {ACADEMIC_YEAR}...")
        existing_w = (
            db.query(StandardWeighting)
              .filter(StandardWeighting.academic_year == ACADEMIC_YEAR)
              .count()
        )
        if existing_w > 0:
            print(f"  {existing_w} weighting rows already exist. Skipping.")
        else:
            if dry_run:
                print(f"  [DRY-RUN] Would insert {len(weights_df)} weighting rows.")
            else:
                inserted = 0
                skipped  = 0
                # Gather existing standard numbers so we can skip orphans
                existing_stds = {
                    row[0]
                    for row in db.query(Standard.standard_number).all()
                }
                for _, row in weights_df.iterrows():
                    std_num = int(row["Standard Number"])
                    std_ver = int(row["Standard Version"])
                    if std_num not in existing_stds:
                        print(f"    SKIP weighting: standard {std_num} not in DB.")
                        skipped += 1
                        continue
                    db.add(StandardWeighting(
                        standard_number     = std_num,
                        academic_year       = ACADEMIC_YEAR,
                        standard_version    = std_ver,
                        weight_not_achieved = float(row["weight_not_achieved"]),
                        weight_achieved     = float(row["weight_achieved"]),
                        weight_merit        = float(row["weight_merit"]),
                        weight_excellence   = float(row["weight_excellence"]),
                    ))
                    inserted += 1
                    if inserted % 500 == 0:
                        db.commit()
                        print(f"    ...committed {inserted} weighting rows...")
                db.commit()
                print(f"  OK - Inserted {inserted} weighting rows "
                      f"({skipped} skipped).")

        print(f"\n{sep}")
        print(f" {'DRY RUN ' if dry_run else ''}Ingestion complete!")
        print(f"{sep}\n")

    except Exception as exc:
        print(f"\nFATAL ERROR: {exc}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


# ============================================================================
# Entry point
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest 2025 NCEA-ATAR data into the database."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would happen without writing to the DB."
    )
    parser.add_argument(
        "--no-scrape", action="store_true",
        help="Skip NZQA scraping; use placeholder titles for new standards."
    )
    args = parser.parse_args()
    ingest_2025(dry_run=args.dry_run, scrape=not args.no_scrape)
