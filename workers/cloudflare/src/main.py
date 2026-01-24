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
from .local_pipeline import LocalVideoPipeline

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


@app.get("/debug/env")
async def debug_env():
    """Debug endpoint to check environment variables."""
    return {
        "has_openai_key": bool(os.getenv("OPENAI_API_KEY")),
        "has_r2_access_key": bool(os.getenv("R2_ACCESS_KEY_ID")),
        "has_r2_secret_key": bool(os.getenv("R2_SECRET_ACCESS_KEY")),
        "r2_endpoint": os.getenv("R2_ENDPOINT_URL", "NOT SET"),
        "r2_bucket": os.getenv("R2_BUCKET_NAME", "NOT SET"),
        "has_webhook_secret": bool(os.getenv("WEBHOOK_SECRET")),
        "has_supabase_url": bool(os.getenv("SUPABASE_URL")),
    }


@app.get("/debug/r2-test")
async def debug_r2_test():
    """Test R2 connectivity by listing files."""
    try:
        from .r2_client import get_r2_client
        client = get_r2_client()
        files = await client.list_files(prefix="sources/", max_keys=3)
        return {
            "status": "ok",
            "files_found": len(files),
            "sample_files": [f["key"] for f in files[:3]],
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
        }


@app.post("/debug/process-video-test")
async def debug_process_video_test(request: Request):
    """Debug endpoint to test video processing with detailed output."""
    import base64
    import tempfile
    from pathlib import Path

    try:
        video_bytes = await request.body()
        source_id = request.query_params.get("source_id", "test")

        if not video_bytes:
            return {"error": "No video data"}

        results = {
            "video_size": len(video_bytes),
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            video_path = str(Path(temp_dir) / "source.mp4")
            with open(video_path, "wb") as f:
                f.write(video_bytes)

            results["video_saved"] = True

            # Test scene detection
            from .scene_detect import SceneDetector
            detector = SceneDetector()
            try:
                scene_result = detector.detect_scenes(video_path)
                results["scene_detection"] = {
                    "success": True,
                    "total_scenes": scene_result.total_scenes,
                    "video_duration": scene_result.video_duration,
                    "fps": scene_result.fps,
                    "scenes": [
                        {
                            "start": s.start_time,
                            "end": s.end_time,
                            "duration": s.duration,
                        }
                        for s in scene_result.scenes
                    ],
                }
            except Exception as e:
                results["scene_detection"] = {
                    "success": False,
                    "error": str(e),
                }

            # Test clip creation
            if results.get("scene_detection", {}).get("success"):
                from .split_video import create_clip_definitions
                try:
                    clip_defs = create_clip_definitions(
                        scenes=scene_result.scenes,
                        transcript_segments=[],
                        min_duration=1.0,
                        max_duration=60.0,
                        source_id=source_id,
                    )
                    results["clip_definitions"] = {
                        "success": True,
                        "count": len(clip_defs),
                        "clips": [
                            {
                                "id": c.clip_id,
                                "start": c.start_time,
                                "end": c.end_time,
                            }
                            for c in clip_defs
                        ],
                    }
                except Exception as e:
                    results["clip_definitions"] = {
                        "success": False,
                        "error": str(e),
                    }

        return results

    except Exception as e:
        return {"error": str(e), "error_type": type(e).__name__}


@app.get("/debug/network-test")
async def debug_network_test():
    """Test general network connectivity from container."""
    import httpx
    results = {}

    # Test 1: Public internet (httpbin)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://httpbin.org/ip")
            results["httpbin"] = {
                "status": "ok",
                "response": resp.json(),
            }
    except Exception as e:
        results["httpbin"] = {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
        }

    # Test 2: Cloudflare's own endpoint
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://cloudflare.com/cdn-cgi/trace")
            results["cloudflare"] = {
                "status": "ok",
                "response": resp.text,
            }
    except Exception as e:
        results["cloudflare"] = {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__,
        }

    # Test 3: R2 endpoint directly with simple GET
    r2_endpoint = os.getenv("R2_ENDPOINT_URL", "")
    if r2_endpoint:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(r2_endpoint)
                results["r2_direct"] = {
                    "status": "reachable",
                    "status_code": resp.status_code,
                }
        except Exception as e:
            results["r2_direct"] = {
                "status": "error",
                "error": str(e),
                "error_type": type(e).__name__,
            }

    return results


@app.post("/process-local")
async def process_video_local(request: Request):
    """Process video bytes locally (no network access needed).

    This endpoint accepts video bytes directly from the Worker,
    processes them locally (scene detection, clip splitting),
    and returns the processed clips as base64-encoded data.

    The Worker is responsible for:
    - Downloading video from R2
    - Uploading clips to R2
    - Calling OpenAI for transcription
    - Calling webhooks
    """
    import base64

    try:
        # Get request body as bytes
        video_bytes = await request.body()

        if not video_bytes:
            return JSONResponse(
                status_code=400,
                content={"error": "No video data provided"},
            )

        # Get parameters from query string
        source_id = request.query_params.get("source_id", str(uuid.uuid4()))
        min_clip_duration = float(request.query_params.get("min_clip_duration", "3.0"))
        max_clip_duration = float(request.query_params.get("max_clip_duration", "20.0"))
        min_scene_length = float(request.query_params.get("min_scene_length", "1.5"))

        logger.info(
            "Received local processing request",
            source_id=source_id,
            video_size=len(video_bytes),
        )

        # Process video locally
        pipeline = LocalVideoPipeline()
        result = await pipeline.process_video_bytes(
            video_bytes=video_bytes,
            source_id=source_id,
            min_clip_duration=min_clip_duration,
            max_clip_duration=max_clip_duration,
            min_scene_length=min_scene_length,
        )

        if result.error:
            return JSONResponse(
                status_code=500,
                content={"error": result.error},
            )

        # Encode clips as base64 for JSON response
        clips_data = []
        for clip in result.clips:
            clips_data.append({
                "clip_id": clip.clip_id,
                "start_time": clip.start_time,
                "end_time": clip.end_time,
                "duration": clip.duration,
                "video_base64": base64.b64encode(clip.video_data).decode("utf-8"),
                "thumbnail_base64": base64.b64encode(clip.thumbnail_data).decode("utf-8") if clip.thumbnail_data else None,
            })

        # Encode audio for transcription by Worker
        audio_base64 = None
        if result.audio_data:
            audio_base64 = base64.b64encode(result.audio_data).decode("utf-8")

        return {
            "job_id": result.job_id,
            "total_duration": result.total_duration,
            "processing_time_seconds": result.processing_time_seconds,
            "total_clips": len(clips_data),
            "clips": clips_data,
            "audio_base64": audio_base64,
        }

    except Exception as e:
        logger.error("Local processing endpoint failed", error=str(e))
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


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
