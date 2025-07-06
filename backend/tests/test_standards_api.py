import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.main import app
from app.api.standards import get_db

TEST_DATABASE_URL = settings.DATABASE_URL

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Apply the override to the FastAPI app
app.dependency_overrides[get_db] = override_get_db

# Create a TestClient instance.
client = TestClient(app)

# --- Test Cases ---

def test_search_by_standard_number():
    """
    Tests searching for a specific standard by its number.
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
    """
    response = client.get("/api/v1/standards?q=Physics")
    assert response.status_code == 200
    data = response.json()
    # Check for multiple results and correct subject
    assert len(data) > 1
    for standard in data:
        assert standard["subject"] == "Physics"

def test_search_by_keyword():
    """
    Tests searching for a keyword in the standard title.
    """
    response = client.get("/api/v1/standards?q=waves")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    # Check that the keyword appears in the title of result
    for standard in data:
        assert "waves" in standard["title"].lower()

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
    # API should return an empty list if the query is empty
    assert data == []
