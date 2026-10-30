"""
Export the NCEA-ATAR Postgres database to static JSON for the GitHub Pages build.

The static site has no backend: the browser loads these files and runs the same
calculations the FastAPI backend does (see frontend/app/services/engine/).
Re-run this whenever the database changes (i.e. the yearly data intake), then
commit the regenerated files in frontend/public/data/.

Usage (database running locally, e.g. `docker compose up database` with the port exposed):
    python scripts/export_static_data.py --db-url postgresql+psycopg2://ncea_user:ncea_password@localhost:5432/ncea_atar

Exactness notes:
  * Floats are written with Python's repr (shortest round-trip), so every
    float64 weight / statistical value is reproduced bit-for-bit in JS.
  * Rows are exported in physical (ctid) order. Several backend queries have no
    ORDER BY and Postgres returns them in that order (seq / bitmap heap scans);
    the JS port relies on this to break ties identically.
  * The 145K-row ATAR distribution is not shipped. ATAR is a step function of the
    statistical value, so per year we precompute the (at most ~2000) steps using
    the backend's own ATARCalculator._atar_for_rank, and verify the table against
    ATARCalculator._estimate_atar_from_stat before writing anything.
"""

import argparse
import json
import math
import os
import random
import sys
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.core import data_cache  # noqa: E402
from app.services.atar_engine import ATARCalculator  # noqa: E402

OUT_DIR = REPO_ROOT / "frontend" / "public" / "data"
EPSILON = 1e-12           # must match _estimate_atar_from_stat
HISTOGRAM_BIN_SIZE = 0.005  # must match the histogram in components/ATARResults.tsx


def write_json(name: str, payload) -> None:
    path = OUT_DIR / name
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    print(f"  wrote {path.relative_to(REPO_ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


def export_standards(db) -> None:
    rows = db.execute(text(
        "SELECT standard_number, title, credits, assessment_type, standards_type, "
        "is_ue, subject, search_keywords FROM standards ORDER BY ctid"
    )).fetchall()
    # Same alias table backend/app/api/standards.py loads at import time.
    with open(REPO_ROOT / "backend" / "app" / "data" / "search_overrides.json", encoding="utf-8") as f:
        overrides = json.load(f)
    aliases = {}
    for std_num, alias_list in overrides.get("standard_aliases", {}).items():
        for alias in alias_list:
            aliases[alias] = std_num

    write_json("standards.json", {
        "aliases": aliases,
        "columns": ["standard_number", "title", "credits", "assessment_type",
                    "standards_type", "is_ue", "subject", "search_keywords"],
        "rows": [[r[0], r[1], r[2], r[3], r[4], bool(r[5]), r[6], r[7]] for r in rows],
    })


def export_weightings(db) -> None:
    rows = db.execute(text(
        "SELECT standard_number, academic_year, standard_version, weight_not_achieved, "
        "weight_achieved, weight_merit, weight_excellence FROM standard_weightings ORDER BY ctid"
    )).fetchall()

    def f(v):
        return None if v is None else float(v)

    write_json("weightings.json", {
        "latest_year": data_cache.get_latest_weight_year(),
        "columns": ["standard_number", "academic_year", "standard_version", "weight_not_achieved",
                    "weight_achieved", "weight_merit", "weight_excellence"],
        "rows": [[r[0], r[1], r[2], f(r[3]), f(r[4]), f(r[5]), f(r[6])] for r in rows],
    })


def build_bands(distribution: list, rate: dict | None) -> list | None:
    """
    Run-length table of ATAR per distribution entry, as [[min_value_of_run, atar], ...]
    in descending value order. A statistical value s maps to the first run r with
    s >= min_value_of_run - EPSILON, mirroring the rank scan in _estimate_atar_from_stat.
    """
    if not rate or rate["population"] <= 0 or rate["candidature"] <= 0:
        return None

    p = (rate["candidature"] / rate["population"]) * 100.0
    n = sum(entry["count"] for entry in distribution)

    bands: list = []
    user_rank = 1
    for entry in distribution:  # descending by value
        atar = ATARCalculator._atar_for_rank(user_rank, n, p)
        if bands and bands[-1][1] == atar:
            bands[-1][0] = entry["value"]
        else:
            bands.append([entry["value"], atar])
        user_rank += entry["count"]
    return bands


def lookup(bands: list, min_value: float, stat: float) -> float:
    """Python twin of lookupAtar() in frontend/app/services/engine/atar-engine.ts."""
    if stat < min_value:
        return 0.0
    lo, hi = 0, len(bands) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if stat >= bands[mid][0] - EPSILON:
            hi = mid
        else:
            lo = mid + 1
    return bands[lo][1]


def verify_bands(calc: ATARCalculator, year: int, distribution: list, bands: list, samples: int) -> int:
    min_value = distribution[-1]["value"]
    max_value = distribution[0]["value"]
    rng = random.Random(year)

    probes = [min_value, min_value - EPSILON / 2, min_value - 1e-9, 0.0, max_value, max_value + 1.0]
    boundary_runs = bands if len(bands) <= samples else rng.sample(bands, samples)
    for run_min, _ in boundary_runs:
        edge = run_min - EPSILON
        probes += [run_min, edge, math.nextafter(edge, -math.inf), math.nextafter(edge, math.inf)]
    probes += [rng.uniform(min_value, max_value) for _ in range(samples)]

    for stat in probes:
        expected = calc._estimate_atar_from_stat(stat, year)
        got = lookup(bands, min_value, stat)
        if expected != got:
            raise SystemExit(f"ATAR table mismatch for {year} at stat={stat!r}: backend={expected} table={got}")
    return len(probes)


def bin_histogram(distribution: list) -> dict:
    """Pre-bins the distribution exactly as ATARResults.tsx used to client-side."""
    bins: dict = {}
    for entry in distribution:
        key = math.floor(entry["value"] / HISTOGRAM_BIN_SIZE) * HISTOGRAM_BIN_SIZE
        bins[key] = bins.get(key, 0) + entry["count"]
    values = [entry["value"] for entry in distribution]
    return {
        "bins": [[float(k), v] for k, v in sorted(bins.items())],
        "min_value": min(values),
        "max_value": max(values),
        "total_frequency": sum(entry["count"] for entry in distribution),
    }


def export_atar(db, verify_samples: int) -> None:
    calc = ATARCalculator(db, [])  # uses the primed data_cache
    distributions = data_cache.get_distributions()
    rates = data_cache.get_participation_rates()

    years = {}
    for year, dist in distributions.items():
        distribution = dist["distribution"]
        rate = rates.get(year)
        bands = build_bands(distribution, rate)
        if bands is not None:
            checked = verify_bands(calc, year, distribution, bands, verify_samples)
            print(f"  {year}: {len(distribution)} distribution rows -> {len(bands)} ATAR steps ({checked} probes verified)")

        population = rate["population"] if rate else None
        candidature = rate["candidature"] if rate else None
        participation_rate = None
        if population and candidature and population > 0:
            participation_rate = candidature / population

        years[str(year)] = {
            "min_value": distribution[-1]["value"],
            "bands": bands,
            "weighted_statnz_population": population,
            "nz_total_candidature": candidature,
            "participation_rate": participation_rate,
            "histogram": bin_histogram(distribution),
        }

    write_json("atar.json", {"epsilon": EPSILON, "years": years})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db-url", default=os.environ.get(
        "DATABASE_URL", "postgresql+psycopg2://ncea_user:ncea_password@localhost:5432/ncea_atar"))
    parser.add_argument("--verify-samples", type=int, default=300,
                        help="ATAR step boundaries / random values to cross-check per year")
    args = parser.parse_args()

    engine = create_engine(args.db_url)
    db = sessionmaker(bind=engine)()
    try:
        data_cache.prime(db)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Exporting to {OUT_DIR.relative_to(REPO_ROOT)}")
        export_standards(db)
        export_weightings(db)
        export_atar(db, args.verify_samples)
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main()
