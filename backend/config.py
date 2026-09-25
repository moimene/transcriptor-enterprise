import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            ".env",
            "backend/.env",
            os.path.join(os.path.dirname(__file__), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # App
    APP_NAME: str = "Enterprise Transcriptor API"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    PORT: int = 8000
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    WHISPER_MODEL: str = "whisper-1"
    SUMMARY_MODEL: str = "gpt-4o-mini"

    # Audio Processing Settings
    MAX_UPLOAD_SIZE_MB: int = 1024  # 1 GB
    TARGET_BITRATE: str = "32k"    # 32 kbps voice optimized
    TARGET_SAMPLE_RATE: int = 16000 # 16 kHz Whisper native
    MAX_CHUNK_SIZE_MB: float = 24.0 # OpenAI limit is 25 MB; 24 MB safety margin
    SILENCE_THRESHOLD_DB: float = -30.0 # dB for silence detection
    MIN_SILENCE_DURATION_S: float = 0.5 # Min silence to consider a cut point

    # Cloudflare R2 / S3 Storage (Ephemeral 24h)
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "transcriptions-ephemeral"
    R2_ENDPOINT_URL: str = ""
    R2_REGION: str = "auto"
    PRESIGNED_EXPIRATION_SECONDS: int = 1800  # 30 mins

    # Security & Persistence
    INTERNAL_API_KEY: str = ""
    JOB_TTL_HOURS: int = 24
    OPENAI_TIMEOUT_SECONDS: float = 120.0
    FFMPEG_TIMEOUT_SECONDS: int = 600

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://transcriptor-portal.vercel.app"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v


settings = Settings()
