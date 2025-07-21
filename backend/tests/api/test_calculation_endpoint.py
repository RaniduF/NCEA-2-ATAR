import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use absolute imports as configured in the project
from app.core.config import settings
from app.main import app
from app.api.calculation import get_db
# Import the model needed for the diagnostic query
from app.models.standard_models import ParticipationRate

# --- Test Database Setup ---
TEST_DATABASE_URL = settings.DATABASE_URL
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                   bind=engine)


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
# Tests for the ATAR Calculation Endpoint
# ===================================================================

def test_calculate_atar_success_with_diagnostics():
    """
    Tests the main ATAR calculation logic and prints detailed diagnostic
    information for each year's result.
    """
    # --- !!! PLACEHOLDER: REPLACE WITH YOUR NCEA LEVEL 3 DATA !!! ---
    user_standards_payload = {
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
    # ----------------------------------------------------------------

    response = client.post("/api/v1/calculate-atar",
                           json=user_standards_payload)

    assert response.status_code == 200
    data = response.json()

    assert "results" in data
    assert len(data["results"]) > 0

    # --- NEW: Diagnostic Information Section ---
    print("\n\n--- ATAR Calculation Diagnostics ---")

    # Fetch the participation rates to calculate the band sizes for diagnostics
    db = TestingSessionLocal()
    rates = db.query(ParticipationRate).all()
    participation_rates = {r.academic_year: r.weighted_statnz_population for r
                           in rates}
    db.close()

    for result in data["results"]:
        year = result["year"]
        estimated_atar = result["estimated_atar"]
        stat_value = result["statistical_value"]

        population = participation_rates.get(year)
        if population:
            students_per_band = round(float(population) * 0.0005)
        else:
            students_per_band = "N/A"

        print("\n------------------------------------")
        print(f"YEAR: {year}")
        print("------------------------------------")
        print(f"  - Students per ATAR Band: {students_per_band}")
        print(f"  - Calculated Statistical Value: {stat_value:.6f}")
        print(f"  - Final Estimated ATAR: {estimated_atar:.2f}")

    print("\n--- End of Diagnostics ---\n")
    # -----------------------------------------


def test_calculate_atar_no_standards_provided():
    """Tests that sending an empty list of standards returns a 400 error."""
    response = client.post("/api/v1/calculate-atar", json={"standards": []})
    assert response.status_code == 400


def test_calculate_atar_invalid_grade():
    """
    Tests that providing an invalid grade string results in a 422 Unprocessable Entity error.
    """
    payload = {"standards": [{"standard_number": 91577, "grade": "Exellent"}]}
    response = client.post("/api/v1/calculate-atar", json=payload)
    assert response.status_code == 422
