from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
import threading
import uuid
import json

from loguru import logger

from .file_parser import parse_file


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ParseJob:
    id: str
    status: str  # queued|running|done|error
    filename: str
    created_at: str
    updated_at: str
    extracted_text: str | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


_lock = threading.Lock()
_jobs: dict[str, ParseJob] = {}


def _jobs_dir() -> Path:
    # backend/app/services -> backend/app -> backend
    root = Path(__file__).resolve().parents[2]
    d = root / "uploads" / "parse_jobs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _persist(job: ParseJob) -> None:
    try:
        p = _jobs_dir() / f"{job.id}.json"
        p.write_text(json.dumps(job.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to persist parse job {job.id}: {e}")


def create_parse_job(filename: str, file_path: str | Path) -> ParseJob:
    job_id = uuid.uuid4().hex
    now = _utcnow_iso()
    job = ParseJob(id=job_id, status="queued", filename=filename, created_at=now, updated_at=now)

    with _lock:
        _jobs[job_id] = job
    _persist(job)

    thread = threading.Thread(target=_run_job, args=(job_id, Path(file_path)), daemon=True)
    thread.start()
    return job


def get_job(job_id: str) -> ParseJob | None:
    with _lock:
        return _jobs.get(job_id)


def _run_job(job_id: str, file_path: Path) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.status = "running"
        job.updated_at = _utcnow_iso()
        _persist(job)

    try:
        result = parse_file(file_path)
        extracted_text = result if isinstance(result, str) else ""
        extracted_text = extracted_text or ""

        with _lock:
            job = _jobs[job_id]
            job.status = "done"
            job.extracted_text = extracted_text
            job.updated_at = _utcnow_iso()
            _persist(job)
    except Exception as e:
        logger.exception(f"Parse job {job_id} failed")
        with _lock:
            job = _jobs[job_id]
            job.status = "error"
            job.error = str(e)
            job.updated_at = _utcnow_iso()
            _persist(job)
