# backend/tests/test_standards_api.py

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- FIX: Import the settings object from your config file ---
from app.core.config import settings
from app.main import app
from app.api.standards import get_db

# --- Test Database Setup ---
# Use the DATABASE_URL from your settings object, which is loaded from the .env file.
# This ensures your tests connect to the same database as your main application.
TEST_DATABASE_URL = settings.DATABASE_URL

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Dependency Override ---
# This function will be used to override the `get_db` dependency in your API
# during testing, ensuring tests use the testing database session.
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Apply the override to the FastAPI app
app.dependency_overrides[get_db] = override_get_db

# Create a TestClient instance. This client will make requests to your app in tests.
client = TestClient(app)

# --- Test Cases ---

def test_search_by_standard_number():
    """
    Tests searching for a specific standard by its number.
    Assumes standard 91523 exists in your database.
    """
    response = client.get("/api/v1/standards?q=91523")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["standard_number"] == 91523
    assert "Physics" in data[0]["subject"]

def test_search_by_subject():
    """
    Tests searching for all standards within a subject.
    Assumes 'Calculus' is a subject in your database.
    """
    response = client.get("/api/v1/standards?q=Calculus")
    assert response.status_code == 200
    data = response.json()
    # Check that we got multiple results and they are all for the correct subject
    assert len(data) > 1
    for standard in data:
        assert standard["subject"] == "Calculus"

def test_search_by_keyword():
    """
    Tests searching for a keyword in the standard title.
    Assumes standards with 'aspects' in the title exist.
    """
    response = client.get("/api/v1/standards?q=aspects")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    # Check that the keyword appears in the title of each result
    for standard in data:
        assert "aspects" in standard["title"].lower()

def test_search_no_results():
    """
    Tests a search query that should return no results.
    """
    response = client.get("/api/v1/standards?q=nonexistentsearchterm123")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0

def test_search_empty_query():
    """
    Tests the behavior when no query is provided.
    """
    response = client.get("/api/v1/standards")
    assert response.status_code == 200
    data = response.json()
    # Your API should return an empty list if the query is empty
    assert data == []
