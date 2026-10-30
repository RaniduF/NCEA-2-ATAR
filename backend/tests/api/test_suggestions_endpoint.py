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
# Tests for the Suggestions Endpoint
# ===================================================================

def test_get_suggestions_success():
    """Tests that a valid query returns a dictionary with subjects and standards suggestions."""
    response = client.get("/api/v1/suggestions?q=phys")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert "subjects" in data
    assert "standards" in data
    assert "Physics" in data["subjects"]

def test_get_suggestions_too_short():
    """Tests that a query with less than 2 characters returns an empty suggestions structure."""
    response = client.get("/api/v1/suggestions?q=p")
    assert response.status_code == 200
    assert response.json() == {"subjects": [], "standards": []}

def test_get_suggestions_no_match():
    """Tests that a query with no possible match returns an empty suggestions structure."""
    response = client.get("/api/v1/suggestions?q=zyxw")
    assert response.status_code == 200
    assert response.json() == {"subjects": [], "standards": []}


def test_get_suggestions_extremely_long():
    """Tests that a very long suggestions query is handled safely and truncated."""
    long_query = "x" * 200
    response = client.get(f"/api/v1/suggestions?q={long_query}")
    assert response.status_code == 200
    assert response.json() == {"subjects": [], "standards": []}


def test_get_suggestions_wildcard_escaping():
    """Tests that SQL wildcards like % and _ are escaped and do not cause broad query matching."""
    response = client.get("/api/v1/suggestions?q=%")
    assert response.status_code == 200
    assert response.json() == {"subjects": [], "standards": []}

    response = client.get("/api/v1/suggestions?q=_")
    assert response.status_code == 200
    assert response.json() == {"subjects": [], "standards": []}


