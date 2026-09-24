import os
import subprocess
import tempfile
import pytest
from audio_processor import AudioProcessor
from transcriber import format_timestamp_srt, format_timestamp_vtt, TranscriptionService


@pytest.fixture
def sample_audio_file():
    """Generates a 3-second synthetic audio wave with silence using FFmpeg."""
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp_path = tmp.name
    tmp.close()

    # Generate 1 sec tone, 1 sec silence, 1 sec tone
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=1",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]",
        "-map", "[out]",
        "-t", "3",
        tmp_path
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    yield tmp_path

    if os.path.exists(tmp_path):
        os.remove(tmp_path)


def test_timestamp_formatting():
    # 0 seconds
    assert format_timestamp_srt(0.0) == "00:00:00,000"
    assert format_timestamp_vtt(0.0) == "00:00:00.000"

    # 65.432 seconds (1 min 5 sec 432 ms)
    assert format_timestamp_srt(65.432) == "00:01:05,432"
    assert format_timestamp_vtt(65.432) == "00:01:05.432"

    # 3661.050 seconds (1 hr 1 min 1 sec 50 ms)
    assert format_timestamp_srt(3661.050) == "01:01:01,050"
    assert format_timestamp_vtt(3661.050) == "01:01:01.050"


def test_audio_probe(sample_audio_file):
    processor = AudioProcessor()
    probe = processor.probe_media(sample_audio_file)
    assert probe["has_audio"] is True
    assert probe["duration"] > 2.0


def test_audio_compression(sample_audio_file):
    processor = AudioProcessor()
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as out_tmp:
        out_path = out_tmp.name

    try:
        res = processor.extract_and_compress(sample_audio_file, out_path)
        assert os.path.exists(out_path)
        assert res["duration"] > 2.0
        assert res["size_bytes"] > 0
    finally:
        if os.path.exists(out_path):
            os.remove(out_path)


def test_srt_generation():
    service = TranscriptionService(api_key="mock_key")
    segments = [
        {"id": 0, "start": 0.5, "end": 2.2, "text": "Hola bienvenidos a la reunión."},
        {"id": 1, "start": 3.0, "end": 5.8, "text": "Vamos a revisar el estado del proyecto."}
    ]
    srt = service.generate_srt(segments)
    assert "00:00:00,500 --> 00:00:02,200" in srt
    assert "Hola bienvenidos a la reunión." in srt
    assert "00:00:03,000 --> 00:00:05,800" in srt


def test_vtt_generation():
    service = TranscriptionService(api_key="mock_key")
    segments = [
        {"id": 0, "start": 1.12, "end": 3.45, "text": "Subtítulo para vídeo web."}
    ]
    vtt = service.generate_vtt(segments)
    assert "WEBVTT" in vtt
    assert "00:00:01.120 --> 00:00:03.450" in vtt
