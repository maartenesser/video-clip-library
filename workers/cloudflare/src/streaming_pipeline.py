"""Streaming video processing pipeline for large files (500MB+).

This pipeline is designed to handle large video files without memory overflow:
- Streams video download directly to disk (never loads full video in memory)
- Uses chunked transcription for audio files >25MB
- Uploads clips directly to R2 from container (bypasses Worker)
- Sends only metadata to webhook (R2 keys instead of base64 data)

Memory Budget (with 12GB container):
- Streaming buffer: 100MB
- FFmpeg processing: 2-4GB
- PySceneDetect: 1GB
- Total: ~6GB (50% headroom)
"""

import asyncio
import hashlib
import hmac
import os
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import httpx
import structlog

from .models import (
    ClipDefinition,
    ClipResult,
    TranscriptResult,
    TranscriptSegment,
)
from .r2_client import R2Client, get_r2_client
from .scene_detect import SceneDetector
from .split_video import VideoSplitter, create_clip_definitions
from .transcribe import Transcriber

logger = structlog.get_logger(__name__)

# Download settings
DOWNLOAD_CHUNK_SIZE = 8192  # 8KB chunks for streaming download
DOWNLOAD_TIMEOUT = 1800.0  # 30 minutes timeout for large files
CONNECT_TIMEOUT = 60.0  # 60 seconds connection timeout


@dataclass
class StreamingClipMetadata:
    """Metadata for a clip uploaded to R2 (no base64 data)."""

    clip_id: str
    start_time: float
    end_time: float
    duration: float
    video_key: str  # R2 key, not URL or base64
    thumbnail_key: Optional[str] = None
    transcript: Optional[str] = None


@dataclass
class StreamingPipelineResult:
    """Result of streaming pipeline (metadata only, no binary data)."""

    job_id: str
    source_id: str
    status: str
    total_duration: float
    total_clips: int
    clips: list[StreamingClipMetadata]
    processing_time_seconds: float
    transcript: Optional[TranscriptResult] = None
    error: Optional[str] = None


async def stream_download_to_disk(
    url: str,
    dest_path: str,
    timeout: float = DOWNLOAD_TIMEOUT,
) -> int:
    """Stream video directly to disk - never hold full file in memory.

    Args:
        url: URL to download from (presigned R2 URL)
        dest_path: Local path to save the file
        timeout: Download timeout in seconds (default 30 min)

    Returns:
        Total bytes downloaded

    Raises:
        httpx.HTTPError: On download failure
        asyncio.TimeoutError: On timeout
    """
    logger.info(
        "Starting streaming download",
        url=url[:100] + "..." if len(url) > 100 else url,
        dest_path=dest_path,
    )

    total_bytes = 0

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=CONNECT_TIMEOUT),
        follow_redirects=True,
    ) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()

            # Get expected size if available
            content_length = response.headers.get("content-length")
            expected_size = int(content_length) if content_length else None

            if expected_size:
                logger.info(
                    "Download started",
                    expected_size_mb=round(expected_size / (1024 * 1024), 2),
                )

            with open(dest_path, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=DOWNLOAD_CHUNK_SIZE):
                    f.write(chunk)
                    total_bytes += len(chunk)

                    # Log progress every 50MB
                    if total_bytes % (50 * 1024 * 1024) < DOWNLOAD_CHUNK_SIZE:
                        logger.info(
                            "Download progress",
                            downloaded_mb=round(total_bytes / (1024 * 1024), 2),
                            expected_mb=round(expected_size / (1024 * 1024), 2) if expected_size else "unknown",
                        )

    logger.info(
        "Download completed",
        total_bytes=total_bytes,
        size_mb=round(total_bytes / (1024 * 1024), 2),
    )

    return total_bytes


class StreamingVideoPipeline:
    """Process large videos without memory overflow.

    This pipeline:
    1. Streams video download to disk (100MB buffer max)
    2. Extracts and transcribes audio (chunked if >25MB)
    3. Detects scenes using PySceneDetect
    4. Splits video into clips
    5. Uploads clips directly to R2 (parallel uploads)
    6. Calls webhook with metadata only (no base64)
    """

    def __init__(
        self,
        r2_client: Optional[R2Client] = None,
        openai_api_key: Optional[str] = None,
    ):
        """Initialize the streaming pipeline.

        Args:
            r2_client: R2 client for uploads (uses singleton if not provided)
            openai_api_key: OpenAI API key for transcription
        """
        self.r2_client = r2_client or get_r2_client()
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")

        self.scene_detector = SceneDetector()
        self.video_splitter = VideoSplitter()

        if self.openai_api_key:
            self.transcriber = Transcriber(api_key=self.openai_api_key)
        else:
            self.transcriber = None
            logger.warning("OPENAI_API_KEY not set, transcription will be skipped")

    async def process_and_upload(
        self,
        video_url: str,
        source_id: str,
        webhook_url: Optional[str] = None,
        min_clip_duration: float = 3.0,
        max_clip_duration: float = 20.0,
        min_scene_length: float = 1.5,
        webhook_secret: Optional[str] = None,
    ) -> StreamingPipelineResult:
        """Process large video with streaming - no memory limits.

        Args:
            video_url: Presigned URL to download video
            source_id: Source video identifier
            webhook_url: URL to call with results (optional)
            min_clip_duration: Minimum clip duration in seconds
            max_clip_duration: Maximum clip duration in seconds
            min_scene_length: Minimum scene length for detection
            webhook_secret: Secret for HMAC webhook signature

        Returns:
            StreamingPipelineResult with clip metadata
        """
        job_id = str(uuid.uuid4())
        start_time = time.time()

        logger.info(
            "Starting streaming pipeline",
            job_id=job_id,
            source_id=source_id,
            min_clip_duration=min_clip_duration,
            max_clip_duration=max_clip_duration,
        )

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                video_path = Path(temp_dir) / "source.mp4"

                # Step 1: Stream download video to disk
                logger.info("Step 1: Streaming download to disk", job_id=job_id)
                await stream_download_to_disk(video_url, str(video_path))

                # Step 2: Transcribe audio (chunked if >25MB)
                logger.info("Step 2: Transcribing audio", job_id=job_id)
                transcript_result = await self._transcribe_video(str(video_path))
                transcript_segments = transcript_result.segments if transcript_result else []

                # Step 3: Detect scenes
                logger.info("Step 3: Detecting scenes", job_id=job_id)
                self.scene_detector.min_scene_len = min_scene_length
                scene_result = self.scene_detector.detect_scenes(str(video_path))

                logger.info(
                    "Scenes detected",
                    job_id=job_id,
                    total_scenes=scene_result.total_scenes,
                    video_duration=scene_result.video_duration,
                )

                # Step 4: Create clip definitions
                logger.info("Step 4: Creating clip definitions", job_id=job_id)
                clip_definitions = create_clip_definitions(
                    scenes=scene_result.scenes,
                    transcript_segments=transcript_segments,
                    min_duration=min_clip_duration,
                    max_duration=max_clip_duration,
                    source_id=source_id,
                )

                if not clip_definitions:
                    logger.warning("No clips created, creating single clip for entire video")
                    clip_definitions = [
                        ClipDefinition(
                            clip_id=f"{source_id}_clip_0000",
                            start_time=0.0,
                            end_time=min(scene_result.video_duration, max_clip_duration),
                            transcript="",
                        )
                    ]

                logger.info(
                    "Clip definitions created",
                    job_id=job_id,
                    clip_count=len(clip_definitions),
                )

                # Step 5: Split video into clips
                logger.info("Step 5: Splitting video into clips", job_id=job_id)
                output_dir = str(Path(temp_dir) / "clips")
                clip_results = await self.video_splitter.split_video(
                    str(video_path),
                    clip_definitions,
                    output_dir,
                )

                logger.info(
                    "Video split completed",
                    job_id=job_id,
                    clips_created=len(clip_results),
                )

                # Step 6: Upload clips to R2 (parallel)
                logger.info("Step 6: Uploading clips to R2", job_id=job_id)
                clip_metadata = await self._upload_clips_parallel(
                    clip_results,
                    source_id,
                    transcript_segments,
                )

                logger.info(
                    "Clips uploaded to R2",
                    job_id=job_id,
                    clips_uploaded=len(clip_metadata),
                )

                processing_time = time.time() - start_time

                result = StreamingPipelineResult(
                    job_id=job_id,
                    source_id=source_id,
                    status="completed",
                    total_duration=scene_result.video_duration,
                    total_clips=len(clip_metadata),
                    clips=clip_metadata,
                    processing_time_seconds=processing_time,
                    transcript=transcript_result,
                )

                # Step 7: Call webhook with metadata
                if webhook_url:
                    logger.info("Step 7: Calling webhook", job_id=job_id)
                    await self._call_webhook(
                        webhook_url,
                        result,
                        webhook_secret,
                    )

                logger.info(
                    "Streaming pipeline completed",
                    job_id=job_id,
                    source_id=source_id,
                    total_clips=len(clip_metadata),
                    processing_time=processing_time,
                )

                return result

        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(
                "Streaming pipeline failed",
                job_id=job_id,
                error=str(e),
                processing_time=processing_time,
            )

            # Call webhook with error if URL provided
            if webhook_url:
                error_result = StreamingPipelineResult(
                    job_id=job_id,
                    source_id=source_id,
                    status="failed",
                    total_duration=0.0,
                    total_clips=0,
                    clips=[],
                    processing_time_seconds=processing_time,
                    error=str(e),
                )
                await self._call_webhook(webhook_url, error_result, webhook_secret)

            return StreamingPipelineResult(
                job_id=job_id,
                source_id=source_id,
                status="failed",
                total_duration=0.0,
                total_clips=0,
                clips=[],
                processing_time_seconds=processing_time,
                error=str(e),
            )

    async def _transcribe_video(self, video_path: str) -> Optional[TranscriptResult]:
        """Transcribe video with chunking support.

        Args:
            video_path: Path to video file

        Returns:
            TranscriptResult or None if transcription fails/skipped
        """
        if not self.transcriber:
            logger.warning("Transcription skipped - no API key")
            return None

        try:
            # Use chunked transcription that handles >25MB audio files
            result = await self.transcriber.transcribe_video_chunked(video_path)
            logger.info(
                "Transcription completed",
                segments=len(result.segments),
                duration=result.duration,
            )
            return result
        except Exception as e:
            logger.error("Transcription failed", error=str(e))
            return None

    async def _upload_clips_parallel(
        self,
        clip_results: list[ClipResult],
        source_id: str,
        transcript_segments: list[TranscriptSegment],
    ) -> list[StreamingClipMetadata]:
        """Upload clips to R2 in parallel.

        Args:
            clip_results: List of clip extraction results
            source_id: Source video identifier
            transcript_segments: Transcript segments for clip transcript extraction

        Returns:
            List of clip metadata with R2 keys
        """
        async def upload_single_clip(clip: ClipResult) -> Optional[StreamingClipMetadata]:
            try:
                # R2 keys
                video_key = f"clips/{source_id}/{clip.clip_id}.mp4"
                thumbnail_key = f"clips/{source_id}/{clip.clip_id}_thumb.jpg"

                # Upload video
                await self.r2_client.upload_file_streaming(
                    clip.video_path,
                    video_key,
                )

                # Upload thumbnail if exists
                thumbnail_uploaded = None
                if clip.thumbnail_path and Path(clip.thumbnail_path).exists():
                    await self.r2_client.upload_file_streaming(
                        clip.thumbnail_path,
                        thumbnail_key,
                    )
                    thumbnail_uploaded = thumbnail_key

                # Get transcript for this clip's time range
                clip_transcript = self._get_transcript_for_clip(
                    transcript_segments,
                    clip.start_time,
                    clip.end_time,
                )

                return StreamingClipMetadata(
                    clip_id=clip.clip_id,
                    start_time=clip.start_time,
                    end_time=clip.end_time,
                    duration=clip.duration,
                    video_key=video_key,
                    thumbnail_key=thumbnail_uploaded,
                    transcript=clip_transcript,
                )
            except Exception as e:
                logger.error(
                    "Failed to upload clip",
                    clip_id=clip.clip_id,
                    error=str(e),
                )
                return None

        # Upload all clips in parallel (max 5 concurrent)
        semaphore = asyncio.Semaphore(5)

        async def upload_with_semaphore(clip: ClipResult) -> Optional[StreamingClipMetadata]:
            async with semaphore:
                return await upload_single_clip(clip)

        tasks = [upload_with_semaphore(clip) for clip in clip_results]
        results = await asyncio.gather(*tasks)

        # Filter out failed uploads
        successful = [r for r in results if r is not None]

        if len(successful) < len(clip_results):
            logger.warning(
                "Some clip uploads failed",
                successful=len(successful),
                total=len(clip_results),
            )

        return successful

    def _get_transcript_for_clip(
        self,
        segments: list[TranscriptSegment],
        start_time: float,
        end_time: float,
    ) -> Optional[str]:
        """Get transcript text for a specific time range.

        Args:
            segments: Transcript segments
            start_time: Clip start time
            end_time: Clip end time

        Returns:
            Transcript text or None
        """
        if not segments:
            return None

        overlapping_segments = [
            seg for seg in segments
            if seg.end > start_time and seg.start < end_time
        ]

        if not overlapping_segments:
            return None

        text = " ".join(seg.text.strip() for seg in overlapping_segments)
        return text.strip() or None

    async def _call_webhook(
        self,
        webhook_url: str,
        result: StreamingPipelineResult,
        secret: Optional[str] = None,
    ) -> bool:
        """Call webhook with processing results.

        Args:
            webhook_url: URL to call
            result: Pipeline result
            secret: Optional HMAC secret for signature

        Returns:
            True if webhook call succeeded
        """
        try:
            # Build webhook payload
            payload = {
                "source_id": result.source_id,
                "status": result.status,
                "job_id": result.job_id,
                "duration_seconds": result.total_duration,
                "processing_time_seconds": result.processing_time_seconds,
                "clips": [
                    {
                        "clip_id": clip.clip_id,
                        "start_time_seconds": clip.start_time,
                        "end_time_seconds": clip.end_time,
                        "file_key": clip.video_key,
                        "thumbnail_key": clip.thumbnail_key,
                        "transcript_segment": clip.transcript,
                    }
                    for clip in result.clips
                ],
            }

            if result.error:
                payload["error_message"] = result.error

            import json
            body = json.dumps(payload)

            headers = {"Content-Type": "application/json"}

            # Add HMAC signature if secret provided
            if secret:
                signature = hmac.new(
                    secret.encode(),
                    body.encode(),
                    hashlib.sha256,
                ).hexdigest()
                headers["x-webhook-signature"] = signature

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    webhook_url,
                    content=body,
                    headers=headers,
                )

                if response.status_code >= 400:
                    logger.error(
                        "Webhook call failed",
                        status_code=response.status_code,
                        response=response.text[:500],
                    )
                    return False

                logger.info("Webhook called successfully", status_code=response.status_code)
                return True

        except Exception as e:
            logger.error("Webhook call error", error=str(e))
            return False
