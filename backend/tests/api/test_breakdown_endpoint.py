import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use absolute imports as configured in the project
import os
from app.core.config import settings
from app.main import app
from app.db.session import get_db

# --- Test Database Setup ---
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", settings.DATABASE_URL)
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                   bind=engine)


def override_get_db():
    """
    Provide a SQLAlchemy Session connected to the test database and ensure it is closed after use.
    
    Returns:
        sqlalchemy.orm.Session: A database session bound to the test database, yielded for use by the caller and closed when finished.
    """
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_calculate_breakdown_success():
    payload = {
        "standards": [
            {"standard_number": 91393, "grade": "Excellence"},
            {"standard_number": 91390, "grade": "Achieved"},
            {"standard_number": 91387, "grade": "Excellence"},
            {"standard_number": 91391, "grade": "Merit"},
            {"standard_number": 91392, "grade": "Achieved"},
            {"standard_number": 91473, "grade": "Merit"},
            {"standard_number": 91475, "grade": "Excellence"},
            {"standard_number": 91478, "grade": "Excellence"},
            {"standard_number": 91472, "grade": "Achieved"},
            {"standard_number": 91575, "grade": "Excellence"},
            {"standard_number": 91577, "grade": "Excellence"},
            {"standard_number": 91578, "grade": "Excellence"},
            {"standard_number": 91579, "grade": "Merit"},
            {"standard_number": 91902, "grade": "Achieved"},
            {"standard_number": 91906, "grade": "Excellence"},
            {"standard_number": 91907, "grade": "Achieved"},
            {"standard_number": 91908, "grade": "Excellence"},
            {"standard_number": 91525, "grade": "Excellence"},
            {"standard_number": 91526, "grade": "Merit"},
            {"standard_number": 91523, "grade": "Merit"},
            {"standard_number": 91524, "grade": "Excellence"}
        ]
    }

    r = client.post("/api/v1/calculate-atar/breakdown", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert "years" in data and isinstance(data["years"], list)
    assert len(data["years"]) > 0

    # Check first year entry
    y0 = data["years"][0]
    assert {"year", "estimated_atar", "statistical_value", "best90", "totals", "excluded"}.issubset(y0.keys())
    totals = y0["totals"]
    assert totals["denominator_credits"] == 90
    assert totals["total_credits_used"] <= 90.0 + 1e-6

    # Statistical value should equal (sum(contribution)/90)
    calc_stat = sum(item["contribution"] for item in y0["best90"]) / 90.0
    assert abs(calc_stat - y0["statistical_value"]) < 1e-6

    # Subject caps should not exceed 24
    for _subj, used in (totals.get("subject_caps") or {}).items():
        assert used <= 24.0 + 1e-6

    # SSP section present
    assert "subjects" in data and isinstance(data["subjects"], list)
    # All SSP rows should have denominator 18
    for s in data["subjects"]:
        assert s["denominator_credits"] == 18


def test_calculate_breakdown_empty():
    """
    Verify the breakdown endpoint returns a 400 response when the request contains an empty standards list.
    
    Sends a POST to /api/v1/calculate-atar/breakdown with {"standards": []} and asserts the response status code is 400.
    """
    r = client.post("/api/v1/calculate-atar/breakdown", json={"standards": []})
    assert r.status_code == 400


