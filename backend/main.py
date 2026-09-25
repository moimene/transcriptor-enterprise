import logging
import os
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from audio_processor import AudioProcessor, AudioProcessorError
from config import settings
import database
from storage import StorageService
from summarizer import SummarizerService
from transcriber import TranscriptionService

# Setup Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("transcriptor")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes the database and runs startup routines."""
    database.init_db()
    deleted = database.cleanup_expired_jobs()
    if deleted:
        logger.info(f"Limpieza de inicio: eliminados {deleted} trabajos expirados.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise Audio/Video Transcription & Summarization API",
    version="1.1.0",
    lifespan=lifespan
)

# CORS setup with strict domain whitelist
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Services
audio_processor = AudioProcessor()
transcription_service = TranscriptionService()
summarizer_service = SummarizerService()
storage_service = StorageService()


# Security Dependency
def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None)
) -> bool:
    """
    Validates requests using an internal API key (via X-API-Key or Bearer token).
    If INTERNAL_API_KEY is not configured, allows requests for local development.
    """
    required_key = settings.INTERNAL_API_KEY.strip() if settings.INTERNAL_API_KEY else ""
    if not required_key:
        return True

    if x_api_key and x_api_key.strip() == required_key:
        return True

    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1] == required_key:
            return True

    logger.warning("Intento de acceso no autorizado rechazado.")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autorizado: clave de acceso corporativa inválida o ausente."
    )


class PresignRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


class TranscribeStorageRequest(BaseModel):
    object_key: str = Field(..., description="Clave del objeto en storage (debe iniciar con 'uploads/')")
    language: Optional[str] = None
    prompt: Optional[str] = None
    generate_summary: bool = True
    delete_source_after: bool = True


@app.get("/health")
def health_check():
    """Diagnostic health check validating environment, FFmpeg, and services."""
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
        "database_persistence": True,
        "whisper_model": settings.WHISPER_MODEL,
        "summary_model": settings.SUMMARY_MODEL
    }


@app.post("/api/upload/presign", dependencies=[Depends(verify_api_key)])
def get_presigned_upload_url(payload: PresignRequest):
    """
    Returns a Presigned S3/R2 URL so large files (up to 1GB) can be uploaded
    directly from the browser without passing through Vercel or saturating Railway.
    """
    if not storage_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El almacenamiento Cloudflare R2 / S3 no está configurado."
        )

    try:
        data = storage_service.generate_presigned_upload_url(
            filename=payload.filename,
            content_type=payload.content_type
        )
        return data
    except Exception as e:
        logger.error(f"Error generando presigned URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generando el enlace de subida segura."
        )


def run_pipeline(
    input_path: str,
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    generate_summary: bool = True,
    job_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Core synchronous processing pipeline.
    Runs in background worker threads so the main event loop is never blocked.
    """
    work_dir = tempfile.mkdtemp(prefix="transcriptor_")
    start_time = time.time()

    def notify(stage: str, progress: int, extra: Optional[Dict[str, Any]] = None):
        if job_id:
            database.update_job(
                job_id=job_id,
                stage=stage,
                progress=progress,
                **(extra or {})
            )

    try:
        notify("analyzing_media", 10)
        logger.info(f"Iniciando pipeline para: {input_path}")
        probe = audio_processor.probe_media(input_path)

        if not probe.get("has_audio"):
            raise AudioProcessorError("El archivo multimedia no contiene ninguna pista de audio.")

        notify("compressing_and_chunking", 25)
        logger.info(f"Extrayendo y comprimiendo audio (duración estimada: {probe.get('duration', 0):.1f}s)...")
        chunks = audio_processor.prepare_audio_for_transcription(input_path, work_dir)

        notify("transcribing", 50)
        logger.info(f"Transcribiendo con OpenAI Whisper-1 ({len(chunks)} chunk/s)...")
        transcript_result = transcription_service.transcribe_and_merge(
            chunks=chunks,
            language=language,
            prompt=prompt
        )

        summary_data = None
        if generate_summary and transcript_result.get("text"):
            notify("summarizing", 80)
            logger.info("Generando minuta ejecutiva con gpt-4o-mini...")
            summary_data = summarizer_service.generate_meeting_notes(
                transcript_text=transcript_result["text"],
                language=transcript_result.get("language", "es")
            )

        elapsed = round(time.time() - start_time, 2)
        total_audio_mins = round(probe.get("duration", 0) / 60, 2)
        estimated_whisper_cost = round(total_audio_mins * 0.006, 4)

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

        if job_id:
            database.update_job(
                job_id=job_id,
                status="completed",
                stage="completed",
                progress=100,
                duration=probe.get("duration"),
                language=transcript_result.get("language"),
                result=result
            )

        return result

    except Exception as e:
        logger.exception(f"Error procesando pipeline: {e}")
        if job_id:
            database.update_job(
                job_id=job_id,
                status="failed",
                stage="failed",
                error=str(e)
            )
        raise
    finally:
        # Enforce Zero Data Retention locally: delete temporary workspace immediately
        shutil.rmtree(work_dir, ignore_errors=True)


@app.post("/api/transcribe/file", dependencies=[Depends(verify_api_key)])
def transcribe_uploaded_file(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    generate_summary: bool = Form(True)
):
    """
    Direct upload endpoint.
    Defined as synchronous 'def' so FastAPI delegates execution to the anyio threadpool,
    ensuring the uvicorn event loop is never frozen by FFmpeg or OpenAI calls.
    Persists job metadata in SQLite.
    """
    job_id = str(uuid.uuid4())
    filename = file.filename or "audio_file"
    database.create_job(job_id=job_id, filename=filename, expires_in_hours=settings.JOB_TTL_HOURS)

    ext = os.path.splitext(filename)[1]
    fd, tmp_path = tempfile.mkstemp(prefix="transcribe_upload_", suffix=ext)
    os.close(fd)

    try:
        with open(tmp_path, "wb") as f_out:
            shutil.copyfileobj(file.file, f_out)

        # Check maximum file size limit
        file_size_mb = os.path.getsize(tmp_path) / (1024 * 1024)
        if file_size_mb > settings.MAX_UPLOAD_SIZE_MB:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo ({file_size_mb:.1f} MB) excede el tamaño máximo permitido de {settings.MAX_UPLOAD_SIZE_MB} MB."
            )

        result = run_pipeline(
            input_path=tmp_path,
            language=language,
            prompt=prompt,
            generate_summary=generate_summary,
            job_id=job_id
        )
        result["job_id"] = job_id
        return result
    except HTTPException:
        raise
    except AudioProcessorError as e:
        logger.error(f"Error procesando audio: {e}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.exception(f"Error interno durante la transcripción: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al procesar el archivo audiovisual."
        )
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
    """Worker task executed in background threadpool for large storage files."""
    fd, local_download_path = tempfile.mkstemp(prefix="s3_download_")
    os.close(fd)

    try:
        database.update_job(job_id=job_id, stage="downloading_from_storage", progress=5)
        storage_service.download_file(object_key, local_download_path)

        run_pipeline(
            input_path=local_download_path,
            language=language,
            prompt=prompt,
            generate_summary=generate_summary,
            job_id=job_id
        )
    except Exception as e:
        logger.exception(f"Error en worker asíncrono para job {job_id}: {e}")
        database.update_job(
            job_id=job_id,
            status="failed",
            stage="failed",
            error="Error en el procesamiento del archivo desde el almacenamiento."
        )
    finally:
        if delete_source_after:
            try:
                storage_service.delete_file(object_key)
            except Exception as e:
                logger.warning(f"No se pudo eliminar el archivo temporal de storage {object_key}: {e}")

        if os.path.exists(local_download_path):
            os.remove(local_download_path)


@app.post("/api/transcribe/from-storage", dependencies=[Depends(verify_api_key)])
def transcribe_from_storage(
    payload: TranscribeStorageRequest,
    background_tasks: BackgroundTasks
):
    """
    Triggers transcription for an object uploaded to S3/R2 storage.
    Validates object key strictly to prevent unauthorized access or directory traversal.
    """
    if not storage_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de almacenamiento no está disponible."
        )

    # Security validation: object_key must start with uploads/ and contain no dangerous path characters
    clean_key = payload.object_key.strip()
    if not clean_key.startswith("uploads/") or ".." in clean_key or "\\" in clean_key or clean_key.startswith("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ruta de almacenamiento no permitida. Los archivos deben residir en 'uploads/'."
        )

    job_id = str(uuid.uuid4())
    filename = os.path.basename(clean_key)
    database.create_job(job_id=job_id, filename=filename, expires_in_hours=settings.JOB_TTL_HOURS)
    database.update_job(job_id=job_id, status="processing", stage="queued", progress=0)

    background_tasks.add_task(
        background_storage_worker,
        job_id=job_id,
        object_key=clean_key,
        language=payload.language,
        prompt=payload.prompt,
        generate_summary=payload.generate_summary,
        delete_source_after=payload.delete_source_after
    )

    return {
        "job_id": job_id,
        "status": "processing",
        "stage": "queued",
        "message": "Tarea iniciada en segundo plano."
    }


@app.get("/api/jobs/{job_id}", dependencies=[Depends(verify_api_key)])
def get_job_status(job_id: str):
    """Polls the status of an asynchronous transcription job from persistent SQLite storage."""
    job = database.get_job(job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trabajo no encontrado.")
    return job


@app.get("/api/jobs", dependencies=[Depends(verify_api_key)])
def list_recent_jobs(limit: int = 20):
    """Returns the list of recent transcription jobs for the current environment."""
    return database.list_jobs(limit=min(limit, 100))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=settings.DEBUG)
