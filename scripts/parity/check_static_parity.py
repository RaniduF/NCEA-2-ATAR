"""
Parity check: FastAPI backend vs the client-side engine used by the static site.

Generates thousands of randomised requests (portfolios, search queries, ...), gets the
backend's answers through FastAPI's TestClient (real endpoints, real serialisation,
real database), runs the TypeScript engine on the same inputs under Node, and requires
the results to be identical - floats compared exactly.

Run after regenerating frontend/public/data with scripts/export_static_data.py:
    pip install -r backend/requirements.txt          # plus httpx for TestClient
    python scripts/parity/check_static_parity.py --db-host localhost --db-port 5432

Needs Node and the frontend's node_modules (npm ci in frontend/) for the TypeScript compiler.
"""

import argparse
import json
import os
import random
import string
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND = REPO_ROOT / "frontend"
DATA_DIR = FRONTEND / "public" / "data"
GRADES = ["Excellence", "Merit", "Achieved", "Not Achieved"]


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db-host", default="localhost")
    p.add_argument("--db-port", default="5432")
    p.add_argument("--db-name", default="ncea_atar")
    p.add_argument("--db-user", default="ncea_user")
    p.add_argument("--db-password", default="ncea_password")
    p.add_argument("--portfolios", type=int, default=2000)
    p.add_argument("--seed", type=int, default=20261019)
    p.add_argument("--failures-out", help="write every mismatch (input, expected, actual) to this JSON file")
    return p.parse_args()


def make_client(args):
    os.environ.update({
        "DB_HOST": args.db_host, "DB_PORT": str(args.db_port), "DB_NAME": args.db_name,
        "DB_USER": args.db_user, "DB_PASSWORD": args.db_password,
    })
    sys.path.insert(0, str(REPO_ROOT / "backend"))
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.limiter import limiter
    limiter.enabled = False  # /calculate-atar is rate limited to 10/min
    return TestClient(app)


# --------------------------------------------------------------------------- cases

def portfolio_cases(rng, standards, weightings, n):
    by_std = {}
    for w in weightings:
        by_std.setdefault(w["standard_number"], []).append(w)
    weighted = sorted(by_std)
    all_numbers = [s["standard_number"] for s in standards]
    by_subject = {}
    for s in standards:
        by_subject.setdefault(s["subject"], []).append(s["standard_number"])
    subjects = sorted(k for k in by_subject if k)

    def entry(num):
        e = {"standard_number": num, "grade": rng.choice(GRADES)}
        rows = by_std.get(num, [])
        r = rng.random()
        if rows and r < 0.45:
            e["year_achieved"] = rng.choice(rows)["academic_year"]
        elif r < 0.55:
            e["year_achieved"] = rng.randint(2017, 2027)
        r = rng.random()
        if rows and r < 0.3:
            pick = rng.choice(rows)
            e["standard_version"] = pick["standard_version"]
            if rng.random() < 0.5:
                e["year_achieved"] = pick["academic_year"]
        elif r < 0.38:
            e["standard_version"] = rng.randint(1, 12)
        return e

    cases = []
    for i in range(n):
        style = i % 4
        if style == 0:      # realistic: 4-7 subjects, most of each subject's standards
            nums = []
            for subj in rng.sample(subjects, rng.randint(4, 7)):
                pool = by_subject[subj]
                nums += rng.sample(pool, min(len(pool), rng.randint(2, 8)))
        elif style == 1:    # random weighted standards
            nums = rng.sample(weighted, rng.randint(1, 40))
        elif style == 2:    # anything, including standards without weightings / unknown numbers
            nums = rng.sample(all_numbers, rng.randint(1, 30)) + [rng.randint(1, 999999) for _ in range(rng.randint(0, 2))]
        else:               # small / edge portfolios
            nums = rng.sample(weighted, rng.randint(1, 4))
        portfolio = [entry(n) for n in nums]
        # duplicates of the same standard (re-sits, different years / grades)
        for _ in range(rng.randint(0, 3)):
            if portfolio:
                portfolio.append(entry(rng.choice(portfolio)["standard_number"]))
        rng.shuffle(portfolio)
        cases.append(portfolio)
    cases.append([])
    return cases


def typo(rng, s):
    if len(s) < 2:
        return s
    i = rng.randrange(len(s))
    op = rng.randrange(4)
    if op == 0:
        return s[:i] + s[i + 1:]
    if op == 1:
        return s[:i] + rng.choice(string.ascii_lowercase) + s[i:]
    if op == 2 and i < len(s) - 1:
        return s[:i] + s[i + 1] + s[i] + s[i + 2:]
    return s[:i] + rng.choice(string.ascii_lowercase) + s[i + 1:]


def query_cases(rng, standards, aliases):
    subjects = sorted({s["subject"] for s in standards if s["subject"]})
    keywords = sorted({k for s in standards for k in ((s["search_keywords"] or {}).get("primary") or [])})
    numbers = [str(s["standard_number"]) for s in standards]
    q = set()
    for subj in subjects:
        q.update([subj, subj.lower(), subj.upper(), f"  {subj}  ", subj[:2], subj[:3], subj[:5],
                  typo(rng, subj.lower()), typo(rng, typo(rng, subj.lower()))])
        q.add(subj.replace("ā", "a").replace("ū", "u").replace("ē", "e").replace("ō", "o").replace("ī", "i"))
        words = subj.split()
        if len(words) > 1:
            q.add(" ".join(reversed(words)))
            q.add(words[-1])
    q.update(aliases)
    q.update(a.upper() for a in aliases)
    q.update(rng.sample(keywords, min(600, len(keywords))))
    q.update(typo(rng, k) for k in rng.sample(keywords, min(300, len(keywords))))
    q.update(rng.sample(numbers, 300))
    q.update(n[:k] for n in rng.sample(numbers, 150) for k in (1, 2, 3, 4))
    q.update(["", " ", "a", "ab", "zz", "91", "9", "0", "00091027", "maths", "math", "calc", "chem",
              "physic", "bio", "english", "te reo maori", "te reo māori", "maori", "māori", "%", "_", "a%",
              "a_b", "\\", "50%", "x" * 150, "calculus" + " " * 120 + "x", "Café", "naïve", "e&m", "nga toi"])
    q.update("".join(rng.choice(string.ascii_lowercase + " ") for _ in range(rng.randint(2, 12))) for _ in range(150))
    return sorted(q)


# --------------------------------------------------------------------------- comparison

def same(a, b, path="$"):
    """Exact structural equality; ints and floats compare by value. Returns a diff path or None."""
    if isinstance(a, bool) or isinstance(b, bool):
        return None if a is b or (type(a) is type(b) and a == b) else path
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return None if a == b else f"{path}: {a!r} != {b!r}"
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a) != set(b):
            return f"{path}: keys {sorted(set(a) ^ set(b))}"
        for k in a:
            d = same(a[k], b[k], f"{path}.{k}")
            if d:
                return d
        return None
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return f"{path}: len {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            d = same(x, y, f"{path}[{i}]")
            if d:
                return d
        return None
    return None if a == b else f"{path}: {a!r} != {b!r}"


def main():
    args = parse_args()
    rng = random.Random(args.seed)
    client = make_client(args)
    from rapidfuzz import fuzz as rfuzz
    from thefuzz import utils as fuzz_utils

    with client:
        standards_file = json.loads((DATA_DIR / "standards.json").read_text(encoding="utf-8"))
        weightings_file = json.loads((DATA_DIR / "weightings.json").read_text(encoding="utf-8"))
        standards = [dict(zip(standards_file["columns"], r)) for r in standards_file["rows"]]
        weightings = [dict(zip(weightings_file["columns"], r)) for r in weightings_file["rows"]]

        cases, expected = [], []

        def add(kind, inp, exp):
            cases.append({"kind": kind, "input": inp})
            expected.append(exp)

        def api(method, url, **kw):
            r = getattr(client, method)(url, **kw)
            return r.json() if r.status_code == 200 else {"error": r.status_code}

        print("Collecting backend answers...")
        for p in portfolio_cases(rng, standards, weightings, args.portfolios):
            add("calculate", p, api("post", "/api/v1/calculate-atar/", json={"standards": p}))
            add("breakdown", p, api("post", "/api/v1/calculate-atar/breakdown", json={"standards": p}))

        queries = query_cases(rng, standards, list(standards_file["aliases"]))
        for q in queries:
            add("suggestions", q, api("get", "/api/v1/suggestions/", params={"q": q}))
            add("search", q, api("get", "/api/v1/standards/", params={"q": q}))

        versions_by_std = {}
        for w in weightings:
            versions_by_std.setdefault(w["standard_number"], set()).add(w["standard_version"])
        for s in standards:
            num = s["standard_number"]
            add("versions", num, api("get", f"/api/v1/standards/{num}/available-versions"))
            for v in [None, *sorted(versions_by_std.get(num, ())), 99]:
                params = {} if v is None else {"version": v}
                add("years", {"standard_number": num, "version": v},
                    api("get", f"/api/v1/standards/{num}/available-years", params=params))

        for year in [2021, *sorted({w["academic_year"] for w in weightings}), 2026]:
            golden = api("get", f"/api/v1/calculate-atar/distributions/{year}")
            add("distribution", {"year": year, "distribution": golden.get("distribution", [])}, golden)

        subjects_lower = sorted({s["subject"].lower() for s in standards if s["subject"]})
        processed_subjects = [fuzz_utils.full_process(s, force_ascii=True) for s in subjects_lower]
        for q in rng.sample(queries, min(400, len(queries))):
            pq = fuzz_utils.full_process(fuzz_utils.full_process(q), force_ascii=True)
            add("wratio", {"query": q, "choices": subjects_lower},
                [rfuzz.WRatio(pq, c) if pq and c else 0 for c in processed_subjects])

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        cases_path, out_path, engine_dir = tmp / "cases.json", tmp / "out.json", tmp / "engine"
        cases_path.write_text(json.dumps(cases), encoding="utf-8")
        tsc = FRONTEND / "node_modules" / "typescript" / "bin" / "tsc"
        engine_src = sorted(str(p) for p in (FRONTEND / "app" / "services" / "engine").glob("*.ts"))
        subprocess.run(["node", str(tsc), "--outDir", str(engine_dir), "--module", "commonjs", "--target", "es2020",
                        "--strict", "--skipLibCheck", "--esModuleInterop", *engine_src], check=True)
        print(f"Running engine on {len(cases)} cases...")
        subprocess.run(["node", str(Path(__file__).with_name("run_engine.cjs")), str(engine_dir),
                        str(DATA_DIR), str(cases_path), str(out_path)], check=True)
        result = json.loads(out_path.read_text(encoding="utf-8"))

    counts, failures, dump = {}, [], []
    for case, exp, got in zip(cases, expected, result["outputs"]):
        kind = case["kind"]
        counts[kind] = counts.get(kind, 0) + 1
        if isinstance(got, dict) and "exception" in got:
            failures.append((kind, case["input"], got["exception"]))
            continue
        if kind == "distribution":
            if "error" in exp:
                diff = None if got == {"error": 404} else "expected 404"
            else:
                diff = same(got["engine"], got["legacy"] | {k: exp[k] for k in (
                    "weighted_statnz_population", "nz_total_candidature", "participation_rate")})
        elif kind == "search" and exp.get("suggestion") and got.get("suggestion") and exp != got:
            # The backend scans a Python set, so equal-score ties resolve arbitrarily; accept a tie.
            term = case["input"].strip()[:100].lower()
            pq = fuzz_utils.full_process(fuzz_utils.full_process(term), force_ascii=True)
            score = lambda s: rfuzz.WRatio(pq, fuzz_utils.full_process(s.lower(), force_ascii=True))
            tie = score(exp["suggestion"]["value"]) == score(got["suggestion"]["value"])
            diff = None if tie else same(got, exp)
        else:
            diff = same(got, exp)
        if diff:
            failures.append((kind, case["input"], diff))
            if args.failures_out:
                dump.append({"kind": kind, "input": case["input"], "expected": exp, "actual": got, "diff": diff})

    if args.failures_out:
        Path(args.failures_out).write_text(json.dumps(dump, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Engine time: {result['ms']:.0f} ms for {len(cases)} cases")
    print("  " + ", ".join(f"{k}: {v:.0f} ms" for k, v in result["perKindMs"].items()))
    print("Cases: " + ", ".join(f"{k}={v}" for k, v in counts.items()))
    if failures:
        print(f"\n{len(failures)} MISMATCHES")
        for kind, inp, diff in failures[:25]:
            print(f"- [{kind}] {json.dumps(inp, ensure_ascii=False)[:300]}\n    {diff[:500]}")
        sys.exit(1)
    print("All results identical to the backend.")


if __name__ == "__main__":
    main()
