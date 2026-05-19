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
| `NEXT_PUBLIC_API_BASE_URL` | No | `http://localhost:8000` | API base URL (build-time for Next.js) |

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
