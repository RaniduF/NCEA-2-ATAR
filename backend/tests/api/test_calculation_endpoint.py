import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use absolute imports as configured in the project
from app.core.config import settings
from app.main import app
from app.api.calculation import get_db

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

def test_calculate_atar_success():
    """
    Tests the main ATAR calculation logic with a sample set of user data.
    """
    # --- !!! PLACEHOLDER: REPLACE WITH YOUR NCEA LEVEL 3 DATA !!! ---
    # Provide a list of standards and the grades you achieved.
    # The more standards you include, the more accurate the test will be.
    user_standards_payload = {
        "standards": [
            {"standard_number": 91577, "grade": "Excellence"},
            # Calculus - Complex Numbers
            {"standard_number": 91578, "grade": "Excellence"},
            # Calculus - Differentiation
            {"standard_number": 91579, "grade": "Merit"},
            # Calculus - Integration
            {"standard_number": 91523, "grade": "Excellence"},
            # Physics - Wave Systems
            {"standard_number": 91524, "grade": "Merit"},
            # Physics - Mechanical Systems
            {"standard_number": 91526, "grade": "Achieved"},
            # Physics - Electrical Systems
            {"standard_number": 91605, "grade": "Excellence"}
            # Biology - Evolutionary Processes
            # Add more standards here...
        ]
    }
    # ----------------------------------------------------------------

    response = client.post("/api/v1/calculate-atar",
                           json=user_standards_payload)

    assert response.status_code == 200
    data = response.json()

    assert "results" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) > 0  # Should get results for multiple years

    # Check the structure of the first result
    first_result = data["results"][0]
    assert "year" in first_result
    assert "estimated_atar" in first_result
    assert "statistical_value" in first_result

    # Check that the values are of the correct type and in a reasonable range
    assert isinstance(first_result["year"], int)
    assert isinstance(first_result["estimated_atar"], float)
    assert 0.0 <= first_result["estimated_atar"] <= 99.95


def test_calculate_atar_no_standards_provided():
    """Tests that sending an empty list of standards returns a 400 error."""
    response = client.post("/api/v1/calculate-atar", json={"standards": []})
    assert response.status_code == 400
    assert "No standards provided" in response.json()["detail"]


def test_calculate_atar_invalid_grade():
    """
    Tests that providing an invalid grade string results in a 422 Unprocessable Entity error.
    This is handled automatically by FastAPI's Pydantic validation.
    """
    payload = {
        "standards": [
            {"standard_number": 91577, "grade": "Exellent"}
            # Typo in "Excellence"
        ]
    }
    response = client.post("/api/v1/calculate-atar", json=payload)
    assert response.status_code == 422  # Unprocessable Entity