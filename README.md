# NCEA → ATAR Estimator

Calculate your Australian Tertiary Admission Rank (ATAR) from New Zealand NCEA results. Search for subjects and standards, assign grades, and receive an estimated ATAR with confidence intervals across multiple academic years.

## Architecture

| Service | Stack | Directory |
|---------|-------|-----------|
| **Frontend** | Next.js · TypeScript · Tailwind CSS | `frontend/` |
| **Backend** | FastAPI · Python | `backend/` |
| **Database** | PostgreSQL 15 | `database/` |
| **Reverse Proxy** | Nginx (rate limiting + routing) | `nginx/` |

All services are orchestrated with Docker Compose.

## Directory Structure

```
NCEA-2-ATAR/
├── backend/           # FastAPI application
│   ├── app/           # Source code (api, core, db, models, schemas, services)
│   └── tests/         # API endpoint tests
├── frontend/          # Next.js application
│   ├── app/           # Pages, hooks, providers, services
│   └── components/    # Reusable UI components
├── database/          # SQL schema & seed data for Docker init
├── data/              # Source CSV datasets (standards, weightings, distributions)
├── docs/              # Project documentation & reference materials
├── nginx/             # Nginx reverse proxy configuration
├── scripts/           # Utility scripts (scrapers, analysers, setup)
└── visualisations/    # Generated analysis charts
```

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend:** http://localhost:3000 (hot reload)
- **Backend API:** http://localhost:8000 (auto reload)
- **API Docs:** http://localhost:8000/docs

### Production (Local)

```bash
docker compose up --build
```

- **Application:** http://localhost (via Nginx)

See [docs/docker-setup.md](docs/docker-setup.md) for detailed setup instructions and troubleshooting.

### Static site (GitHub Pages)

The frontend runs without a backend: the read-only database ships as JSON in
`frontend/public/data/` (~340 KB gzipped) and the calculator, search and breakdowns run in
the browser (`frontend/app/services/engine/`, a line-for-line port of the FastAPI code).
`.github/workflows/deploy-pages.yml` builds and deploys it on pushes to `main`
(enable it under *Settings → Pages → Source: GitHub Actions*).

```bash
cd frontend && npm ci && npm run build   # static site in frontend/out
```

**Yearly data intake.** After adding the new SQL files to `database/` (and `docker-compose.yml`):

1. Start the database with its port exposed, e.g. a `docker compose up database` with `ports: ["127.0.0.1:5432:5432"]` uncommented.
2. `python scripts/export_static_data.py --db-url postgresql+psycopg2://ncea_user:ncea_password@localhost:5432/ncea_atar`
   regenerates `frontend/public/data/*.json` (it cross-checks its ATAR lookup tables against the backend engine and aborts on any difference).
3. `python scripts/parity/check_static_parity.py --db-port 5432` compares the browser engine against the
   backend on ~25,000 randomised requests; every result must be identical.
4. Commit the regenerated JSON.

If you change `backend/app/services/atar_engine.py` or the search endpoints, make the same change in
`frontend/app/services/engine/` and re-run step 3.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | — | PostgreSQL hostname |
| `DB_PORT` | Yes | — | PostgreSQL port |
| `DB_NAME` | Yes | — | Database name |
| `DB_USER` | Yes | — | Database username |
| `DB_PASSWORD` | Yes | — | Database password |
| `CORS_ORIGINS` | No | `localhost:3000` | JSON array of allowed origins |
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | Public URL for SEO metadata / sitemap |
| `NEXT_PUBLIC_BASE_PATH` | No | `""` | URL prefix for GitHub Pages project sites, e.g. `/NCEA-2-ATAR` (set by the Pages workflow) |

Docker Compose files set sensible defaults for all variables.

## Testing

### Backend

```bash
# Run from within the backend container or with a local venv
pip install -r requirements-dev.txt
pytest
```

### Database Schema

The database schema is documented visually in [docs/ncea2atar_schema_2025-07-01.svg](docs/ncea2atar_schema_2025-07-01.svg).

## Scripts

Utility scripts live in `scripts/`:

| Script | Purpose |
|--------|---------|
| `setup.sh` / `setup.ps1` | Interactive Docker setup wizard |
| `export_static_data.py` | Export the database to `frontend/public/data` for the static site |
| `parity/check_static_parity.py` | Verify the in-browser engine matches the backend exactly |
| `master_data_ingestion.py` | Ingest raw data into database format |
| `nzqa_subject_scraper.py` | Scrape NZQA subject listings |
| `enhanced_nzqa_scraper.py` | Extended scraper with more detail |
| `populate_search_keywords.py` | Generate search keywords for standards |
| `update_ue_status.py` | Update University Entrance status flags |
| `enhanced_subject_analyser.py` | Subject performance analysis |
| `subject_weight_analyser.py` | Standard weighting analysis |
| `subject_visualiser.py` | Generate visualisation charts |
| `analyze_high_atar_stability.py` | High-ATAR stability analysis |
| `fix_maori_encoding.py` | Fix macron encoding in data files |

## Licence

See [LICENSE](LICENSE) for details.
