"""FastAPI application for video processing pipeline."""

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import structlog
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .models import (
    HealthResponse,
    ProcessingStatus,
    ProcessVideoRequest,
    ProcessVideoResponse,
)
from .pipeline import VideoPipeline

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

# Track active jobs
active_jobs: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting video processing pipeline", version=__version__)
    yield
    logger.info("Shutting down video processing pipeline")


app = FastAPI(
    title="Video Processing Pipeline",
    description="Cloudflare Container-based video processing pipeline for clip extraction and tagging",
    version=__version__,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(
        "Unhandled exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version=__version__,
        timestamp=datetime.utcnow(),
    )


@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint."""
    # Check if required environment variables are set
    required_vars = ["OPENAI_API_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Missing required environment variables: {missing}",
        )

    return {"status": "ready"}


@app.post("/process", response_model=ProcessVideoResponse)
async def process_video(
    request: ProcessVideoRequest,
    background_tasks: BackgroundTasks,
):
    """Start video processing job.

    Accepts a video URL from R2 and processes it asynchronously.
    Calls the webhook URL when processing completes.
    """
    job_id = str(uuid.uuid4())

    logger.info(
        "Received processing request",
        job_id=job_id,
        source_id=request.source_id,
        video_url=request.video_url,
    )

    # Track the job
    active_jobs[job_id] = {
        "source_id": request.source_id,
        "status": ProcessingStatus.PENDING,
        "started_at": datetime.utcnow(),
    }

    # Start processing in background
    background_tasks.add_task(
        run_pipeline,
        job_id=job_id,
        source_id=request.source_id,
        video_url=request.video_url,
        webhook_url=str(request.webhook_url),
        min_clip_duration=request.min_clip_duration,
        max_clip_duration=request.max_clip_duration,
        min_scene_length=request.min_scene_length,
    )

    return ProcessVideoResponse(
        job_id=job_id,
        source_id=request.source_id,
        status=ProcessingStatus.PENDING,
        message="Video processing job started",
    )


async def run_pipeline(
    job_id: str,
    source_id: str,
    video_url: str,
    webhook_url: str,
    min_clip_duration: float,
    max_clip_duration: float,
    min_scene_length: float,
):
    """Run the video processing pipeline."""
    try:
        active_jobs[job_id]["status"] = ProcessingStatus.DOWNLOADING

        pipeline = VideoPipeline()
        await pipeline.process_video(
            source_id=source_id,
            video_url=video_url,
            webhook_url=webhook_url,
            min_clip_duration=min_clip_duration,
            max_clip_duration=max_clip_duration,
            min_scene_length=min_scene_length,
        )

        active_jobs[job_id]["status"] = ProcessingStatus.COMPLETED
        active_jobs[job_id]["completed_at"] = datetime.utcnow()

    except Exception as e:
        logger.error("Pipeline failed", job_id=job_id, error=str(e))
        active_jobs[job_id]["status"] = ProcessingStatus.FAILED
        active_jobs[job_id]["error"] = str(e)
        active_jobs[job_id]["completed_at"] = datetime.utcnow()


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a processing job."""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    return active_jobs[job_id]


@app.get("/jobs")
async def list_jobs(
    status: Optional[ProcessingStatus] = None,
    limit: int = 50,
):
    """List processing jobs."""
    jobs = list(active_jobs.items())

    if status:
        jobs = [(jid, job) for jid, job in jobs if job.get("status") == status]

    # Sort by started_at descending
    jobs.sort(key=lambda x: x[1].get("started_at", datetime.min), reverse=True)

    return {
        "jobs": [{"job_id": jid, **job} for jid, job in jobs[:limit]],
        "total": len(jobs),
    }


@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a processing job (removes from tracking, but cannot stop running process)."""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = active_jobs[job_id]
    if job["status"] in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]:
        del active_jobs[job_id]
        return {"message": "Job removed from tracking"}

    # Cannot actually cancel running job in this implementation
    # Would need more sophisticated job management with cancellation tokens
    raise HTTPException(
        status_code=400,
        detail="Cannot cancel running job. Job is still processing.",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8080")),
        reload=os.getenv("ENVIRONMENT") == "development",
    )
