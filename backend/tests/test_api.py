import os
import uuid
from fastapi.testclient import TestClient
from main import app
from config import settings
import database

client = TestClient(app)
database.init_db()


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["ffmpeg_available"] is True
    assert data["ffprobe_available"] is True
    assert data["whisper_model"] == "whisper-1"
    assert data["database_persistence"] is True
    assert data["summary_types"] == ["reuniones", "general", "podcast", "interrogatorios"]


def test_invalid_job_id():
    response = client.get("/api/jobs/non-existent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Trabajo no encontrado."


def test_auth_enforcement_with_internal_key():
    original_key = settings.INTERNAL_API_KEY
    try:
        settings.INTERNAL_API_KEY = "secret-token-123"

        # Without header -> 401
        res_no_auth = client.get("/api/jobs/some-job")
        assert res_no_auth.status_code == 401
        assert "No autorizado" in res_no_auth.json()["detail"]

        # With wrong key -> 401
        res_wrong_auth = client.get("/api/jobs/some-job", headers={"X-API-Key": "wrong-token"})
        assert res_wrong_auth.status_code == 401

        # With correct X-API-Key -> 404 (authorized, job doesn't exist)
        res_correct_header = client.get("/api/jobs/some-job", headers={"X-API-Key": "secret-token-123"})
        assert res_correct_header.status_code == 404

        # With correct Bearer token -> 404 (authorized)
        res_correct_bearer = client.get("/api/jobs/some-job", headers={"Authorization": "Bearer secret-token-123"})
        assert res_correct_bearer.status_code == 404

        # Health endpoint remains public without key -> 200
        res_health = client.get("/health")
        assert res_health.status_code == 200

    finally:
        settings.INTERNAL_API_KEY = original_key


def test_storage_path_traversal_blocked():
    original_key = settings.INTERNAL_API_KEY
    try:
        settings.INTERNAL_API_KEY = ""

        # Outside uploads/ prefix -> 400
        res_bad_prefix = client.post(
            "/api/transcribe/from-storage",
            json={"object_key": "private/customer_audio.wav"}
        )
        assert res_bad_prefix.status_code == 400

        # Directory traversal attempt -> 400
        res_traversal = client.post(
            "/api/transcribe/from-storage",
            json={"object_key": "uploads/../../etc/passwd"}
        )
        assert res_traversal.status_code == 400

    finally:
        settings.INTERNAL_API_KEY = original_key


def test_database_persistence_and_cleanup():
    database.init_db()
    test_id = str(uuid.uuid4())
    filename = "meeting_test.mp3"

    # Create
    created = database.create_job(job_id=test_id, filename=filename, expires_in_hours=24)
    assert created["id"] == test_id
    assert created["status"] == "pending"

    # Retrieve
    retrieved = database.get_job(test_id)
    assert retrieved is not None
    assert retrieved["filename"] == filename

    # Update
    updated = database.update_job(
        job_id=test_id,
        status="completed",
        stage="completed",
        progress=100,
        result={"text": "Transcripción de prueba"}
    )
    assert updated["status"] == "completed"
    assert updated["progress"] == 100
    assert updated["result"]["text"] == "Transcripción de prueba"

    # List jobs
    jobs = database.list_jobs(limit=10)
    assert any(j["id"] == test_id for j in jobs)

    # Expire and cleanup
    from datetime import datetime, timedelta, timezone
    with database.get_db_connection() as conn:
        past_str = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        conn.cursor().execute("UPDATE jobs SET expires_at = ? WHERE id = ?", (past_str, test_id))
        conn.commit()

    deleted_count = database.cleanup_expired_jobs()
    assert deleted_count >= 1
    assert database.get_job(test_id) is None


def test_pipeline_summary_type_dispatch():
    from unittest.mock import patch, MagicMock
    from main import run_pipeline

    with patch("main.audio_processor.probe_media") as mock_probe, \
         patch("main.audio_processor.prepare_audio_for_transcription") as mock_prep, \
         patch("main.transcription_service.transcribe_and_merge") as mock_transcribe, \
         patch("main.summarizer_service.generate_summary") as mock_summary:

        mock_probe.return_value = {
            "has_audio": True,
            "duration": 60.0,
            "has_video": False,
            "format": "mp3"
        }
        mock_prep.return_value = ["/tmp/fake_chunk.mp3"]
        mock_transcribe.return_value = {
            "text": "Transcripción de una reunión de planificación.",
            "language": "es",
            "duration": 60.0,
            "segments": [{"id": 0, "start": 0.0, "end": 1.0, "text": "Hola"}],
            "srt": "1\n00:00:00,000 --> 00:00:01,000\nHola",
            "vtt": "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHola",
            "txt": "Hola"
        }
        mock_summary.return_value = {
            "summary_type": "podcast",
            "title": "Episodio de Prueba",
            "summary": "Sinopsis del episodio",
            "key_points": ["Punto 1"],
            "quotes": [{"quote": "Cita clave", "speaker": "Invitado"}],
            "takeaways": ["Lección 1"],
            "action_items": [],
            "decisions": []
        }

        # Call with summary_type="podcast"
        result = run_pipeline(
            input_path="/tmp/fake_input.mp3",
            summary_type="podcast"
        )

        assert result["status"] == "completed"
        assert result["summary"]["summary_type"] == "podcast"
        assert result["summary"]["quotes"][0]["quote"] == "Cita clave"
        mock_summary.assert_called_once_with(
            transcript_text="Transcripción de una reunión de planificación.",
            summary_type="podcast",
            language="es"
        )

