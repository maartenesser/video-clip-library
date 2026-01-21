"""Local video processing pipeline - no network access required.

This pipeline runs entirely locally within the Cloudflare Container,
which has no outbound network access. All external operations (R2, OpenAI, webhooks)
must be handled by the Worker.
"""

import asyncio
import base64
import os
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import structlog

from .scene_detect import SceneDetector
from .split_video import VideoSplitter, create_clip_definitions

logger = structlog.get_logger(__name__)


@dataclass
class LocalClipResult:
    """Result of local clip processing."""
    clip_id: str
    start_time: float
    end_time: float
    duration: float
    video_data: bytes  # Base64 encoded video
    thumbnail_data: bytes  # Base64 encoded thumbnail


@dataclass
class LocalProcessingResult:
    """Result of local video processing."""
    job_id: str
    total_duration: float
    clips: list[LocalClipResult]
    processing_time_seconds: float
    error: Optional[str] = None


class LocalVideoPipeline:
    """Pipeline that processes video locally without network access."""

    def __init__(self):
        self.scene_detector = SceneDetector()
        self.video_splitter = VideoSplitter()

    async def process_video_bytes(
        self,
        video_bytes: bytes,
        source_id: str,
        min_clip_duration: float = 3.0,
        max_clip_duration: float = 20.0,
        min_scene_length: float = 1.5,
    ) -> LocalProcessingResult:
        """Process video from bytes.

        Args:
            video_bytes: Raw video file bytes
            source_id: Source video identifier
            min_clip_duration: Minimum clip duration in seconds
            max_clip_duration: Maximum clip duration in seconds
            min_scene_length: Minimum scene length for detection

        Returns:
            LocalProcessingResult with clip data
        """
        job_id = str(uuid.uuid4())
        start_time = time.time()

        logger.info(
            "Starting local video processing",
            job_id=job_id,
            source_id=source_id,
            video_size=len(video_bytes),
        )

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Save video to temp file
                video_path = str(Path(temp_dir) / "source.mp4")
                with open(video_path, "wb") as f:
                    f.write(video_bytes)

                logger.info("Video saved to temp file", path=video_path)

                # Detect scenes
                logger.info("Detecting scenes", job_id=job_id)
                self.scene_detector.min_scene_len = min_scene_length
                scene_result = self.scene_detector.detect_scenes(video_path)

                logger.info(
                    "Scenes detected",
                    job_id=job_id,
                    scene_count=len(scene_result.scenes),
                    duration=scene_result.video_duration,
                )

                # Create clip definitions (without transcript for now)
                # We'll create clips based on scenes only
                clip_definitions = create_clip_definitions(
                    scenes=scene_result.scenes,
                    transcript_segments=[],  # No transcript in container
                    min_duration=min_clip_duration,
                    max_duration=max_clip_duration,
                    source_id=source_id,
                )

                if not clip_definitions:
                    logger.warning("No clips created, creating single clip for entire video")
                    # Create a single clip for the entire video
                    from .models import ClipDefinition
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

                # Split video into clips
                output_dir = str(Path(temp_dir) / "clips")
                clip_results = await self.video_splitter.split_video(
                    video_path,
                    clip_definitions,
                    output_dir,
                )

                logger.info(
                    "Video split into clips",
                    job_id=job_id,
                    clip_count=len(clip_results),
                )

                # Read clip files and encode as base64
                local_clips = []
                for clip in clip_results:
                    # Read video file
                    with open(clip.video_path, "rb") as f:
                        video_data = f.read()

                    # Read thumbnail file
                    thumbnail_data = b""
                    if clip.thumbnail_path and os.path.exists(clip.thumbnail_path):
                        with open(clip.thumbnail_path, "rb") as f:
                            thumbnail_data = f.read()

                    local_clips.append(LocalClipResult(
                        clip_id=clip.clip_id,
                        start_time=clip.start_time,
                        end_time=clip.end_time,
                        duration=clip.duration,
                        video_data=video_data,
                        thumbnail_data=thumbnail_data,
                    ))

                processing_time = time.time() - start_time

                logger.info(
                    "Local processing completed",
                    job_id=job_id,
                    total_clips=len(local_clips),
                    processing_time=processing_time,
                )

                return LocalProcessingResult(
                    job_id=job_id,
                    total_duration=scene_result.video_duration,
                    clips=local_clips,
                    processing_time_seconds=processing_time,
                )

        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(
                "Local processing failed",
                job_id=job_id,
                error=str(e),
                processing_time=processing_time,
            )

            return LocalProcessingResult(
                job_id=job_id,
                total_duration=0.0,
                clips=[],
                processing_time_seconds=processing_time,
                error=str(e),
            )
