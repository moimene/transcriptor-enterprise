"""
Database persistence layer using SQLite for job management and audit trailing.
Ensures jobs and transcription results survive restarts and are pruned according
to retention policy (Zero Data Retention compliant TTL).
"""
import os
import json
import sqlite3
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

logger = logging.getLogger("transcriptor.db")

DB_DIR = os.getenv("DATA_DIR", os.path.dirname(__file__))
DB_PATH = os.getenv("DATABASE_PATH", os.path.join(DB_DIR, "transcriptor.db"))


@contextmanager
def get_db_connection():
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initializes tables and WAL mode for high concurrency."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                status TEXT NOT NULL,
                stage TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                duration REAL,
                language TEXT,
                result_json TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);")
        conn.commit()
    logger.info(f"Database initialized at {DB_PATH}")


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    if d.get("result_json"):
        try:
            d["result"] = json.loads(d["result_json"])
        except Exception:
            d["result"] = None
    else:
        d["result"] = None
    del d["result_json"]
    return d


def create_job(job_id: str, filename: str, expires_in_hours: int = 24) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=expires_in_hours)
    now_str = now.isoformat()
    exp_str = expires_at.isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO jobs (id, filename, status, stage, progress, created_at, updated_at, expires_at)
            VALUES (?, ?, 'pending', 'uploading', 0, ?, ?, ?)
        """, (job_id, filename, now_str, now_str, exp_str))
        conn.commit()

    return {
        "id": job_id,
        "filename": filename,
        "status": "pending",
        "stage": "uploading",
        "progress": 0,
        "duration": None,
        "language": None,
        "result": None,
        "error": None,
        "created_at": now_str,
        "updated_at": now_str,
        "expires_at": exp_str
    }


def update_job(
    job_id: str,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    progress: Optional[int] = None,
    duration: Optional[float] = None,
    language: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    now_str = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    values = [now_str]

    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if stage is not None:
        fields.append("stage = ?")
        values.append(stage)
    if progress is not None:
        fields.append("progress = ?")
        values.append(int(progress))
    if duration is not None:
        fields.append("duration = ?")
        values.append(float(duration))
    if language is not None:
        fields.append("language = ?")
        values.append(language)
    if result is not None:
        fields.append("result_json = ?")
        values.append(json.dumps(result))
    if error is not None:
        fields.append("error = ?")
        values.append(error)

    values.append(job_id)
    query = f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, tuple(values))
        conn.commit()

    return get_job(job_id)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return _row_to_dict(row)


def list_jobs(limit: int = 50) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


def cleanup_expired_jobs() -> int:
    """Deletes jobs that passed their expires_at timestamp."""
    now_str = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM jobs WHERE expires_at < ?", (now_str,))
        count = cursor.rowcount
        conn.commit()
    if count > 0:
        logger.info(f"Cleaned up {count} expired transcription jobs from SQLite.")
    return count
