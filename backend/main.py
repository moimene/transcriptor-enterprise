import logging
import os
import shutil
import tempfile
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from audio_processor import AudioProcessor, AudioProcessorError
from config import settings
from storage import StorageService
from summarizer import SummarizerService
from transcriber import TranscriptionService

# Setup Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("transcriptor")

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise Audio/Video Transcription & Summarization API",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
audio_processor = AudioProcessor()
transcription_service = TranscriptionService()
summarizer_service = SummarizerService()
storage_service = StorageService()

# In-memory Job store (for background jobs)
JOBS: Dict[str, Dict[str, Any]] = {}


class PresignRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


class TranscribeStorageRequest(BaseModel):
    object_key: str
    language: Optional[str] = None
    prompt: Optional[str] = None
    generate_summary: bool = True
    delete_source_after: bool = True


@app.get("/health")
def health_check():
    """Diagnostic health check validating environment, FFmpeg and API keys."""
    ffmpeg_ok = shutil.which("ffmpeg") is not None
    ffprobe_ok = shutil.which("ffprobe") is not None
    openai_ok = bool(settings.OPENAI_API_KEY)
    storage_ok = storage_service.is_configured()

    return {
        "status": "healthy" if (ffmpeg_ok and ffprobe_ok) else "degraded",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "ffmpeg_available": ffmpeg_ok,
        "ffprobe_available": ffprobe_ok,
        "openai_configured": openai_ok,
        "storage_configured": storage_ok,
        "whisper_model": settings.WHISPER_MODEL,
        "summary_model": settings.SUMMARY_MODEL
    }


@app.post("/api/upload/presign")
def get_presigned_upload_url(payload: PresignRequest):
    """
    Returns a Presigned S3/R2 URL so large files (up to 1GB) can be uploaded
    directly from the browser without passing through Vercel or saturating Railway.
    """
    if not storage_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="El almacenamiento Cloudflare R2 / S3 no está configurado en las variables de entorno."
        )

    try:
        data = storage_service.generate_presigned_upload_url(
            filename=payload.filename,
            content_type=payload.content_type
        )
        return data
    except Exception as e:
        logger.error(f"Error generando presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def run_pipeline(
    input_path: str,
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    generate_summary: bool = True,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """Core synchronous processing pipeline."""
    work_dir = tempfile.mkdtemp(prefix="transcriptor_")
    start_time = time.time()

    def update_job(stage: str, progress: int, extra: Optional[Dict[str, Any]] = None):
        if job_id and job_id in JOBS:
            JOBS[job_id]["stage"] = stage
            JOBS[job_id]["progress"] = progress
            if extra:
                JOBS[job_id].update(extra)

    try:
        update_job("analyzing_media", 10)
        logger.info(f"Iniciando pipeline para: {input_path}")
        probe = audio_processor.probe_media(input_path)

        if not probe.get("has_audio"):
            raise AudioProcessorError("El archivo multimedia no contiene ninguna pista de audio.")

        update_job("compressing_and_chunking", 25)
        logger.info(f"Extrayendo y comprimiendo audio (duración estimada: {probe.get('duration', 0):.1f}s)...")
        chunks = audio_processor.prepare_audio_for_transcription(input_path, work_dir)

        update_job("transcribing", 50, {"total_chunks": len(chunks)})
        logger.info(f"Transcribiendo con OpenAI Whisper-1 ({len(chunks)} chunk/s)...")
        transcript_result = transcription_service.transcribe_and_merge(
            chunks=chunks,
            language=language,
            prompt=prompt
        )

        summary_data = None
        if generate_summary and transcript_result.get("text"):
            update_job("summarizing", 80)
            logger.info("Generando minuta ejecutiva con gpt-4o-mini...")
            summary_data = summarizer_service.generate_meeting_notes(
                transcript_text=transcript_result["text"],
                language=transcript_result.get("language", "es")
            )

        elapsed = round(time.time() - start_time, 2)
        total_audio_mins = round(probe.get("duration", 0) / 60, 2)
        estimated_whisper_cost = round(total_audio_mins * 0.006, 4)  # $0.006 / min Whisper

        result = {
            "status": "completed",
            "elapsed_seconds": elapsed,
            "media_info": {
                "duration_seconds": round(probe.get("duration", 0), 2),
                "duration_minutes": total_audio_mins,
                "has_video": probe.get("has_video", False),
                "format": probe.get("format_name", "unknown"),
                "estimated_api_cost_usd": estimated_whisper_cost
            },
            "transcription": transcript_result,
            "summary": summary_data
        }

        update_job("completed", 100, {"result": result})
        return result

    except Exception as e:
        logger.exception(f"Error procesando pipeline: {str(e)}")
        if job_id and job_id in JOBS:
            JOBS[job_id]["status"] = "failed"
            JOBS[job_id]["error"] = str(e)
        raise
    finally:
        # Enforce Zero Data Retention locally: delete temporary workspace immediately
        shutil.rmtree(work_dir, ignore_errors=True)


@app.post("/api/transcribe/file")
async def transcribe_uploaded_file(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    generate_summary: bool = Form(True)
):
    """
    Direct upload endpoint. Best for audio-extracted files (<50MB) or fast testing.
    Processes the file and returns full transcript, SRT, VTT, and executive summary.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = run_pipeline(
            input_path=tmp_path,
            language=language,
            prompt=prompt,
            generate_summary=generate_summary
        )
        return result
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def background_storage_worker(
    job_id: str,
    object_key: str,
    language: Optional[str],
    prompt: Optional[str],
    generate_summary: bool,
    delete_source_after: bool
):
    """Worker task executed in background for large storage files."""
    local_download_path = tempfile.mktemp(prefix="s3_download_")
    try:
        JOBS[job_id]["stage"] = "downloading_from_storage"
        JOBS[job_id]["progress"] = 5
        storage_service.download_file(object_key, local_download_path)

        run_pipeline(
            input_path=local_download_path,
            language=language,
            prompt=prompt,
            generate_summary=generate_summary,
            job_id=job_id
        )

        if delete_source_after:
            storage_service.delete_file(object_key)
    except Exception as e:
        logger.exception(f"Error en background worker para job {job_id}: {str(e)}")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)
    finally:
        if os.path.exists(local_download_path):
            os.remove(local_download_path)


@app.post("/api/transcribe/from-storage")
def transcribe_from_storage(
    payload: TranscribeStorageRequest,
    background_tasks: BackgroundTasks
):
    """
    Triggers transcription for an object uploaded to S3/R2 storage.
    Runs asynchronously and returns a job ID to monitor progress.
    """
    if not storage_service.is_configured():
        raise HTTPException(status_code=503, detail="Storage service no disponible.")

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "object_key": payload.object_key,
        "status": "processing",
        "stage": "queued",
        "progress": 0,
        "created_at": time.time(),
        "result": None,
        "error": None
    }

    background_tasks.add_task(
        background_storage_worker,
        job_id=job_id,
        object_key=payload.object_key,
        language=payload.language,
        prompt=payload.prompt,
        generate_summary=payload.generate_summary,
        delete_source_after=payload.delete_source_after
    )

    return {"job_id": job_id, "status": "processing", "message": "Tarea iniciada en segundo plano."}


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """Polls the status of an asynchronous transcription job."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job no encontrado.")
    return JOBS[job_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=settings.DEBUG)
