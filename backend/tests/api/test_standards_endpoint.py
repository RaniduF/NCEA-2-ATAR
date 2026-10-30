# backend/tests/test_standards_endpoint.py

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
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False,
                                   bind=engine)


# --- Dependency Override ---
# This ensures that tests use a separate, clean database session.
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


# --- Test Cases for the New API Logic ---

def test_search_by_subject_returns_groups():
    """
    Tests that searching for a full subject name returns no direct results,
    but returns two related groups: Internals and Externals.
    """
    response = client.get("/api/v1/standards?q=Physics")
    assert response.status_code == 200
    data = response.json()

    assert "direct_results" in data
    assert "related_groups" in data

    # A subject search should return groups, not a single direct result
    assert len(data["direct_results"]) == 0
    assert len(data[
                   "related_groups"]) >= 1  # Should have at least one group (Internals or Externals)

    group_names = {group["name"] for group in data["related_groups"]}
    assert "Physics Externals" in group_names
    assert "Physics Internals" in group_names

    # Check that the groups contain standards
    for group in data["related_groups"]:
        assert len(group["standards"]) > 0
        # Check that all standards in the group are for the correct subject
        for standard in group["standards"]:
            assert standard["subject"] == "Physics"


def test_search_by_alias():
    """
    Tests that searching for a primary alias (e.g., 'inter') returns one
    direct result and its related groups.
    """
    response = client.get("/api/v1/standards?q=inter")
    assert response.status_code == 200
    data = response.json()

    assert len(data["direct_results"]) == 1
    assert data["direct_results"][0]["standard_number"] == 91579

    # Check that the related calculus groups are returned
    assert len(data["related_groups"]) > 0
    group_names = {group["name"] for group in data["related_groups"]}
    assert "Calculus Externals" in group_names
    assert "Calculus Internals" in group_names


def test_search_by_standard_number():
    """
    Tests that searching for a standard number returns one direct result
    and its related groups.
    """
    response = client.get("/api/v1/standards?q=91523")  # Physics Wave Systems
    assert response.status_code == 200
    data = response.json()

    assert len(data["direct_results"]) == 1
    assert data["direct_results"][0]["standard_number"] == 91523

    # Check that the related physics groups are returned
    assert len(data["related_groups"]) > 0
    group_names = {group["name"] for group in data["related_groups"]}
    assert "Physics Externals" in group_names
    assert "Physics Internals" in group_names


def test_search_by_primary_keyword():
    """
    Tests searching for a primary keyword from a title.
    """
    response = client.get("/api/v1/standards?q=mechanics")
    assert response.status_code == 200
    data = response.json()

    assert len(data["direct_results"]) == 1
    assert data["direct_results"][0]["standard_number"] == 91524


def test_search_no_results():
    """
    Tests a search query that should return no results.
    """
    response = client.get("/api/v1/standards?q=nonexistentsearchterm123")
    assert response.status_code == 200
    data = response.json()
    assert len(data["direct_results"]) == 0
    assert len(data["related_groups"]) == 0


def test_search_empty_query():
    """
    Tests the behavior when no query is provided.
    """
    response = client.get("/api/v1/standards")
    assert response.status_code == 200
    data = response.json()
    assert data["direct_results"] == []
    assert data["related_groups"] == []


def test_search_extremely_long_query():
    """
    Tests that a very long search query is truncated and handled safely.
    """
    long_query = "x" * 200
    response = client.get(f"/api/v1/standards?q={long_query}")
    assert response.status_code == 200
    data = response.json()
    assert data["direct_results"] == []


def test_get_years_invalid_standard_or_version():
    """
    Tests that available-years returns 400 when standard number or version is out of bounds.
    """
    # Standard number too large
    res = client.get("/api/v1/standards/1000000/available-years")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid standard number"

    # Version too large
    res = client.get("/api/v1/standards/91523/available-years?version=101")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid version number"


def test_get_versions_invalid_standard():
    """
    Tests that available-versions returns 400 when standard number is out of bounds.
    """
    res = client.get("/api/v1/standards/-1/available-versions")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid standard number"


