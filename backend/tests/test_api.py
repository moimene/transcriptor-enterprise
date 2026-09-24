from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["ffmpeg_available"] is True
    assert data["ffprobe_available"] is True
    assert data["whisper_model"] == "whisper-1"


def test_invalid_job_id():
    response = client.get("/api/jobs/non-existent-id")
    assert response.status_code == 404
