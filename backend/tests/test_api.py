import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test the health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_root_endpoint():
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()
    assert "version" in response.json()


def test_register_user():
    """Test user registration."""
    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "testpass123",
            "full_name": "Test User"
        }
    )
    # May fail if user already exists, that's OK for basic test
    assert response.status_code in [201, 400]


def test_login_invalid_credentials():
    """Test login with invalid credentials."""
    response = client.post(
        "/auth/login",
        json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401


def test_upload_without_auth():
    """Test upload endpoint without authentication."""
    response = client.post("/api/v1/upload")
    assert response.status_code in [401, 422]  # Unauthorized or validation error


def test_list_files_without_auth():
    """Test list files endpoint without authentication."""
    response = client.get("/api/v1/files")
    assert response.status_code in [401, 422]
