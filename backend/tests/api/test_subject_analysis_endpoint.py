import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.db.session import get_db

# --- Test Database Setup ---
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", settings.DATABASE_URL)
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Dependency Override ---
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# ===================================================================
# Tests for Subject Analysis and Distribution Validation
# ===================================================================

def test_get_subject_rankings_validation():
    """Tests rankings endpoint with valid and invalid parameter values."""
    # Valid year
    res = client.get("/api/v1/subject-analysis/rankings/2024")
    assert res.status_code in (200, 404) # 404 is allowed if data not found, but 400 is error

    # Invalid years
    res = client.get("/api/v1/subject-analysis/rankings/1999")
    assert res.status_code == 400
    assert res.json()["detail"] == "Academic year must be between 2000 and 2100"

    res = client.get("/api/v1/subject-analysis/rankings/2101")
    assert res.status_code == 400

    # Invalid top_n
    res = client.get("/api/v1/subject-analysis/rankings/2024?top_n=-1")
    assert res.status_code == 400
    res = client.get("/api/v1/subject-analysis/rankings/2024?top_n=1001")
    assert res.status_code == 400

    # Invalid min_score
    res = client.get("/api/v1/subject-analysis/rankings/2024?min_score=-0.1")
    assert res.status_code == 400
    res = client.get("/api/v1/subject-analysis/rankings/2024?min_score=1.1")
    assert res.status_code == 400


def test_get_subject_trends_validation():
    """Tests trends endpoint with valid and invalid min_years."""
    res = client.get("/api/v1/subject-analysis/trends?min_years=0")
    assert res.status_code == 400
    res = client.get("/api/v1/subject-analysis/trends?min_years=51")
    assert res.status_code == 400


def test_get_ssp_rankings_validation():
    """Tests ssp rankings endpoint with invalid year."""
    res = client.get("/api/v1/subject-analysis/ssp/1999")
    assert res.status_code == 400
    res = client.get("/api/v1/subject-analysis/ssp/2101")
    assert res.status_code == 400


def test_get_detailed_subject_analysis_validation():
    """Tests detailed subject analysis endpoint validation."""
    # Invalid year
    res = client.get("/api/v1/subject-analysis/subject/Physics/1999")
    assert res.status_code == 400

    # Invalid subject name (too long)
    long_subject = "A" * 101
    res = client.get(f"/api/v1/subject-analysis/subject/{long_subject}/2024")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid subject name"


def test_get_subjects_validation():
    """Tests subjects endpoint validation."""
    res = client.get("/api/v1/subject-analysis/subjects?year=1999")
    assert res.status_code == 400


def test_get_distributions_validation():
    """Tests distributions endpoint validation in calculation router."""
    res = client.get("/api/v1/calculate-atar/distributions/1999")
    assert res.status_code == 400
    res = client.get("/api/v1/calculate-atar/distributions/2101")
    assert res.status_code == 400
