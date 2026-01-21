"""Video processing pipeline orchestrator."""

import asyncio
import hashlib
import hmac
import json
import os
import tempfile
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
import structlog

from .models import (
    AudioQualityMetricsModel,
    ClipEmbeddingModel,
    ClipGroupModel,
    ClipTag,
    ErrorAnalysisModel,
    FillerWordModel,
    GroupType,
    HesitationModel,
    PipelineResult,
    PipelineResultWithQuality,
    ProcessedClip,
    ProcessedClipWithQuality,
    ProcessingStatus,
    QualityRatingModel,
    SilenceRegionModel,
    SpeakingQualityMetricsModel,
    TagScore,
    TranscriptResult,
)
from .r2_client import R2Client, get_r2_client
from .scene_detect import SceneDetector
from .split_video import VideoSplitter, create_clip_definitions
from .tagger import ClipTagger, create_clip_contexts
from .transcribe import Transcriber
from .error_detect import ErrorDetector
from .quality_rate import QualityRater
from .duplicate_detect import DuplicateDetector

logger = structlog.get_logger(__name__)


class PipelineError(Exception):
    """Error during pipeline execution."""

    pass


class VideoPipeline:
    """Orchestrates the full video processing pipeline."""

    def __init__(
        self,
        r2_client: Optional[R2Client] = None,
        transcriber: Optional[Transcriber] = None,
        scene_detector: Optional[SceneDetector] = None,
        video_splitter: Optional[VideoSplitter] = None,
        clip_tagger: Optional[ClipTagger] = None,
        error_detector: Optional[ErrorDetector] = None,
        quality_rater: Optional[QualityRater] = None,
        duplicate_detector: Optional[DuplicateDetector] = None,
        output_bucket: str = "video-clips",
        enable_quality_analysis: bool = True,
    ):
        """Initialize the pipeline.

        Args:
            r2_client: R2 client for storage operations
            transcriber: Transcriber for audio transcription
            scene_detector: Scene detector for visual analysis
            video_splitter: Video splitter for clip extraction
            clip_tagger: Tagger for content classification
            error_detector: Detector for speech errors
            quality_rater: Rater for clip quality
            duplicate_detector: Detector for duplicate/similar clips
            output_bucket: Bucket for output clips
            enable_quality_analysis: Whether to run quality analysis steps
        """
        self.r2_client = r2_client or get_r2_client()
        self.transcriber = transcriber
        self.scene_detector = scene_detector or SceneDetector()
        self.video_splitter = video_splitter or VideoSplitter()
        self.clip_tagger = clip_tagger
        self.error_detector = error_detector
        self.quality_rater = quality_rater
        self.duplicate_detector = duplicate_detector
        self.output_bucket = output_bucket
        self.enable_quality_analysis = enable_quality_analysis

        # Lazy initialization for API-dependent components
        self._transcriber_initialized = False
        self._tagger_initialized = False

    def _ensure_transcriber(self) -> Transcriber:
        """Ensure transcriber is initialized."""
        if self.transcriber is None:
            self.transcriber = Transcriber()
        return self.transcriber

    def _ensure_tagger(self) -> ClipTagger:
        """Ensure tagger is initialized."""
        if self.clip_tagger is None:
            self.clip_tagger = ClipTagger()
        return self.clip_tagger

    def _ensure_error_detector(self) -> ErrorDetector:
        """Ensure error detector is initialized."""
        if self.error_detector is None:
            self.error_detector = ErrorDetector()
        return self.error_detector

    def _ensure_quality_rater(self) -> QualityRater:
        """Ensure quality rater is initialized."""
        if self.quality_rater is None:
            self.quality_rater = QualityRater()
        return self.quality_rater

    def _ensure_duplicate_detector(self) -> DuplicateDetector:
        """Ensure duplicate detector is initialized."""
        if self.duplicate_detector is None:
            self.duplicate_detector = DuplicateDetector()
        return self.duplicate_detector

    async def download_video(self, video_url: str, temp_dir: str) -> str:
        """Download video from R2 to local storage.

        Args:
            video_url: R2 URL or key of the video
            temp_dir: Temporary directory for download

        Returns:
            Local path to downloaded video
        """
        logger.info("Downloading video", video_url=video_url)

        # Extract key from URL if full URL provided
        if video_url.startswith("http"):
            # Parse key from URL
            from urllib.parse import urlparse

            parsed = urlparse(video_url)
            key = parsed.path.lstrip("/")
            # Remove bucket name from path if present
            parts = key.split("/", 1)
            if len(parts) > 1:
                key = parts[1]
        else:
            key = video_url

        # Determine file extension
        ext = Path(key).suffix or ".mp4"
        local_path = str(Path(temp_dir) / f"source{ext}")

        await self.r2_client.download_file(key, local_path)
        return local_path

    async def upload_clips(
        self,
        clips: list,
        source_id: str,
    ) -> list[dict]:
        """Upload processed clips to R2.

        Args:
            clips: List of ClipResult objects
            source_id: Source video ID

        Returns:
            List of (video_url, thumbnail_url) tuples
        """
        logger.info("Uploading clips to R2", total=len(clips))

        upload_tasks = []
        clip_keys = []
        for clip in clips:
            video_key = f"clips/{source_id}/{clip.clip_id}.mp4"
            thumb_key = f"clips/{source_id}/{clip.clip_id}_thumb.jpg"
            clip_keys.append((video_key, thumb_key))

            upload_tasks.append(
                self.r2_client.upload_file(
                    clip.video_path,
                    video_key,
                    bucket=self.output_bucket,
                )
            )
            upload_tasks.append(
                self.r2_client.upload_file(
                    clip.thumbnail_path,
                    thumb_key,
                    bucket=self.output_bucket,
                )
            )

        results = await asyncio.gather(*upload_tasks, return_exceptions=True)
        failures = [result for result in results if isinstance(result, Exception)]
        if failures:
            raise PipelineError(f"Failed to upload {len(failures)} clip assets to R2")

        # Pair up video and thumbnail URLs with keys
        uploads = []
        for i in range(0, len(results), 2):
            clip_index = i // 2
            video_key, thumb_key = clip_keys[clip_index]
            video_url = results[i] if not isinstance(results[i], Exception) else ""
            thumb_url = results[i + 1] if not isinstance(results[i + 1], Exception) else ""
            uploads.append(
                {
                    "video_url": video_url,
                    "thumbnail_url": thumb_url,
                    "video_key": video_key,
                    "thumbnail_key": thumb_key,
                }
            )

        return uploads

    async def call_webhook(
        self,
        webhook_url: str,
        payload: dict,
        timeout: float = 30.0,
        retries: int = 3,
    ) -> bool:
        """Call webhook with pipeline result.

        Args:
            webhook_url: URL to call
            payload: Webhook payload
            timeout: Request timeout in seconds
            retries: Number of retry attempts

        Returns:
            True if webhook succeeded, False otherwise
        """
        logger.info("Calling webhook", url=webhook_url, status=payload.get("status"))

        secret = os.getenv("WEBHOOK_SECRET", "")
        body = json.dumps(payload, separators=(",", ":"), default=str)
        headers = {"Content-Type": "application/json"}
        if secret:
            signature = hmac.new(
                secret.encode("utf-8"),
                body.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers["x-webhook-signature"] = signature

        async with httpx.AsyncClient() as client:
            for attempt in range(retries):
                try:
                    response = await client.post(
                        webhook_url,
                        content=body,
                        timeout=timeout,
                        headers=headers,
                    )

                    if response.status_code < 400:
                        logger.info(
                            "Webhook called successfully",
                            status_code=response.status_code,
                        )
                        return True

                    logger.warning(
                        "Webhook returned error",
                        status_code=response.status_code,
                        attempt=attempt + 1,
                    )

                except httpx.RequestError as e:
                    logger.warning(
                        "Webhook request failed",
                        error=str(e),
                        attempt=attempt + 1,
                    )

                if attempt < retries - 1:
                    await asyncio.sleep(2**attempt)  # Exponential backoff

        logger.error("Webhook failed after all retries")
        return False

    async def process_video(
        self,
        source_id: str,
        video_url: str,
        webhook_url: str,
        min_clip_duration: float = 3.0,
        max_clip_duration: float = 20.0,
        min_scene_length: float = 1.5,
    ) -> PipelineResultWithQuality:
        """Execute the full video processing pipeline.

        Steps:
        1. Download video from R2
        2. Transcribe with Whisper
        3. Detect scenes with PySceneDetect
        4. Merge transcript + scene boundaries
        5. Split into clips (3-20 seconds)
        6. Tag each clip with AI
        7. Upload clips + thumbnails to R2
        8. Analyze speech errors (pauses, fillers, hesitations)
        9. Rate clip quality (speaking + audio)
        10. Generate transcript embeddings
        11. Group similar/duplicate clips
        12. Build final result and call webhook

        Args:
            source_id: Unique identifier for the source video
            video_url: R2 URL or key of the video
            webhook_url: URL to call when processing completes
            min_clip_duration: Minimum clip duration in seconds
            max_clip_duration: Maximum clip duration in seconds
            min_scene_length: Minimum scene length for detection

        Returns:
            PipelineResultWithQuality with all processed clips and quality data
        """
        job_id = str(uuid.uuid4())
        start_time = time.time()

        logger.info(
            "Starting video processing pipeline",
            job_id=job_id,
            source_id=source_id,
            video_url=video_url,
        )

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Step 1: Download video
                logger.info("Step 1: Downloading video", job_id=job_id)
                video_path = await self.download_video(video_url, temp_dir)

                # Step 2: Transcribe
                logger.info("Step 2: Transcribing video", job_id=job_id)
                transcriber = self._ensure_transcriber()
                transcript = await transcriber.transcribe_video(video_path)

                # Step 3: Detect scenes
                logger.info("Step 3: Detecting scenes", job_id=job_id)
                self.scene_detector.min_scene_len = min_scene_length
                scene_result = self.scene_detector.detect_scenes(video_path)

                # Step 4: Create clip definitions
                logger.info("Step 4: Creating clip definitions", job_id=job_id)
                clip_definitions = create_clip_definitions(
                    scenes=scene_result.scenes,
                    transcript_segments=transcript.segments,
                    min_duration=min_clip_duration,
                    max_duration=max_clip_duration,
                    source_id=source_id,
                )

                if not clip_definitions:
                    raise PipelineError("No valid clips could be created from video")

                # Step 5: Split video into clips
                logger.info(
                    "Step 5: Splitting video into clips",
                    job_id=job_id,
                    total_clips=len(clip_definitions),
                )
                output_dir = str(Path(temp_dir) / "clips")
                clip_results = await self.video_splitter.split_video(
                    video_path,
                    clip_definitions,
                    output_dir,
                )

                # Step 6: Tag clips
                logger.info("Step 6: Tagging clips", job_id=job_id)
                tagger = self._ensure_tagger()
                clip_contexts = create_clip_contexts(
                    clip_results,
                    transcript.duration,
                )
                tag_results = await tagger.tag_clips(clip_contexts)

                # Create tag lookup
                tag_map = {t.clip_id: t for t in tag_results}

                # Step 7: Upload clips to R2
                logger.info("Step 7: Uploading clips to R2", job_id=job_id)
                upload_results = await self.upload_clips(clip_results, source_id)

                # Initialize quality analysis data
                error_analyses = []
                quality_ratings = []
                embeddings = []
                clip_groups = []

                # Steps 8-11: Quality analysis (optional)
                if self.enable_quality_analysis:
                    # Step 8: Analyze speech errors
                    logger.info("Step 8: Analyzing speech errors", job_id=job_id)
                    error_detector = self._ensure_error_detector()
                    error_analyses = await error_detector.analyze_clips(
                        clip_results, transcript
                    )

                    # Step 9: Rate clip quality
                    logger.info("Step 9: Rating clip quality", job_id=job_id)
                    quality_rater = self._ensure_quality_rater()
                    quality_ratings = await quality_rater.rate_clips(
                        clip_results, transcript, error_analyses
                    )

                    # Step 10: Generate transcript embeddings
                    logger.info("Step 10: Generating embeddings", job_id=job_id)
                    duplicate_detector = self._ensure_duplicate_detector()
                    embeddings_raw = await duplicate_detector.generate_embeddings(
                        clip_results
                    )

                    # Step 11: Group similar/duplicate clips
                    logger.info("Step 11: Grouping similar clips", job_id=job_id)
                    groups_raw = await duplicate_detector.find_groups(
                        clip_results, embeddings_raw
                    )

                    # Convert dataclasses to Pydantic models
                    embeddings = [
                        ClipEmbeddingModel(
                            clip_id=e.clip_id,
                            embedding=e.embedding,
                            model_name=e.model_name,
                        )
                        for e in embeddings_raw
                    ]

                    clip_groups = [
                        ClipGroupModel(
                            group_id=g.group_id,
                            group_type=GroupType(g.group_type.value),
                            clip_ids=g.clip_ids,
                            representative_clip_id=g.representative_clip_id,
                            similarity_scores=g.similarity_scores,
                        )
                        for g in groups_raw
                    ]

                # Create lookup maps for quality data
                error_map = {e.clip_id: e for e in error_analyses}
                quality_map = {q.clip_id: q for q in quality_ratings}
                embedding_map = {e.clip_id: e.embedding for e in embeddings}

                # Step 12: Build final result
                logger.info("Step 12: Building final result", job_id=job_id)
                processed_clips = []
                for i, clip in enumerate(clip_results):
                    tag_result = tag_map.get(clip.clip_id)
                    upload_result = (
                        upload_results[i]
                        if i < len(upload_results)
                        else {"video_url": "", "thumbnail_url": "", "video_key": "", "thumbnail_key": ""}
                    )
                    video_url = upload_result["video_url"]
                    thumbnail_url = upload_result["thumbnail_url"]
                    error_analysis = error_map.get(clip.clip_id)
                    quality_rating = quality_map.get(clip.clip_id)

                    # Convert error analysis to Pydantic model
                    error_model = None
                    if error_analysis:
                        error_model = ErrorAnalysisModel(
                            clip_id=error_analysis.clip_id,
                            silence_regions=[
                                SilenceRegionModel(
                                    start=s.start, end=s.end, duration=s.duration
                                )
                                for s in error_analysis.silence_regions
                            ],
                            filler_words=[
                                FillerWordModel(
                                    word=f.word,
                                    start=f.start,
                                    end=f.end,
                                    is_phrase=f.is_phrase,
                                )
                                for f in error_analysis.filler_words
                            ],
                            hesitations=[
                                HesitationModel(
                                    start=h.start,
                                    end=h.end,
                                    duration=h.duration,
                                    type=h.type,
                                )
                                for h in error_analysis.hesitations
                            ],
                            suggested_trim_start=error_analysis.suggested_trim_start,
                            suggested_trim_end=error_analysis.suggested_trim_end,
                            total_filler_words=error_analysis.total_filler_words,
                            total_hesitations=error_analysis.total_hesitations,
                            total_silence_time=error_analysis.total_silence_time,
                        )

                    # Convert quality rating to Pydantic model
                    quality_model = None
                    if quality_rating:
                        quality_model = QualityRatingModel(
                            clip_id=quality_rating.clip_id,
                            speaking_quality_score=quality_rating.speaking_quality_score,
                            audio_quality_score=quality_rating.audio_quality_score,
                            overall_quality_score=quality_rating.overall_quality_score,
                            words_per_minute=quality_rating.words_per_minute,
                            filler_word_count=quality_rating.filler_word_count,
                            hesitation_count=quality_rating.hesitation_count,
                            trimmed_start_seconds=quality_rating.trimmed_start_seconds,
                            trimmed_end_seconds=quality_rating.trimmed_end_seconds,
                            speaking_metrics=SpeakingQualityMetricsModel(
                                words_per_minute=quality_rating.speaking_metrics.words_per_minute,
                                filler_word_rate=quality_rating.speaking_metrics.filler_word_rate,
                                hesitation_rate=quality_rating.speaking_metrics.hesitation_rate,
                                sentence_completion_rate=quality_rating.speaking_metrics.sentence_completion_rate,
                            ),
                            audio_metrics=AudioQualityMetricsModel(
                                loudness_lufs=quality_rating.audio_metrics.loudness_lufs,
                                loudness_range=quality_rating.audio_metrics.loudness_range,
                                true_peak_db=quality_rating.audio_metrics.true_peak_db,
                                noise_floor_db=quality_rating.audio_metrics.noise_floor_db,
                                clipping_detected=quality_rating.audio_metrics.clipping_detected,
                            ),
                        )

                    processed_clips.append(
                        ProcessedClipWithQuality(
                            clip_id=clip.clip_id,
                            source_id=source_id,
                            start_time=clip.start_time,
                            end_time=clip.end_time,
                            duration=clip.duration,
                            transcript=clip.transcript,
                            video_url=video_url,
                            thumbnail_url=thumbnail_url,
                            primary_tag=tag_result.primary_tag if tag_result else ClipTag.B_ROLL,
                            tags=tag_result.all_tags if tag_result else [],
                            created_at=datetime.utcnow(),
                            quality_rating=quality_model,
                            error_analysis=error_model,
                            embedding=embedding_map.get(clip.clip_id),
                        )
                    )

                processing_time = time.time() - start_time

                result = PipelineResultWithQuality(
                    job_id=job_id,
                    source_id=source_id,
                    status=ProcessingStatus.COMPLETED,
                    total_duration=transcript.duration,
                    total_clips=len(processed_clips),
                    clips=processed_clips,
                    transcript=transcript,
                    processing_time_seconds=processing_time,
                    clip_groups=clip_groups,
                    embeddings=embeddings,
                )

                logger.info(
                    "Pipeline completed successfully",
                    job_id=job_id,
                    total_clips=len(processed_clips),
                    total_groups=len(clip_groups),
                    processing_time=processing_time,
                )

                # Call webhook with processing payload expected by the web app
                webhook_clips = []
                for i, clip in enumerate(clip_results):
                    upload_result = (
                        upload_results[i]
                        if i < len(upload_results)
                        else {"video_url": "", "thumbnail_url": "", "video_key": "", "thumbnail_key": ""}
                    )
                    tag_result = tag_map.get(clip.clip_id)
                    tags = []
                    if tag_result:
                        tags = [
                            {
                                "name": tag.tag.value,
                                "confidence_score": tag.confidence,
                            }
                            for tag in tag_result.all_tags
                        ]

                    webhook_clips.append(
                        {
                            "start_time_seconds": clip.start_time,
                            "end_time_seconds": clip.end_time,
                            "file_url": upload_result["video_url"],
                            "file_key": upload_result["video_key"],
                            "thumbnail_url": upload_result["thumbnail_url"] or None,
                            "transcript_segment": clip.transcript or None,
                            "detection_method": "hybrid",
                            "tags": tags,
                        }
                    )

                webhook_payload = {
                    "source_id": source_id,
                    "status": "completed",
                    "clips": webhook_clips,
                    "duration_seconds": transcript.duration,
                }
                await self.call_webhook(webhook_url, webhook_payload)

                return result

        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(
                "Pipeline failed",
                job_id=job_id,
                error=str(e),
                processing_time=processing_time,
            )

            # Call webhook with error
            error_payload = {
                "source_id": source_id,
                "status": "failed",
                "error_message": str(e),
            }
            await self.call_webhook(webhook_url, error_payload)

            raise PipelineError(f"Pipeline failed: {str(e)}") from e


async def process_video(
    source_id: str,
    video_url: str,
    webhook_url: str,
    min_clip_duration: float = 3.0,
    max_clip_duration: float = 20.0,
    min_scene_length: float = 1.5,
) -> None:
    """Process a video through the full pipeline.

    Args:
        source_id: Unique identifier for the source video
        video_url: R2 URL or key of the video
        webhook_url: URL to call when processing completes
        min_clip_duration: Minimum clip duration in seconds
        max_clip_duration: Maximum clip duration in seconds
        min_scene_length: Minimum scene length for detection
    """
    pipeline = VideoPipeline()
    await pipeline.process_video(
        source_id=source_id,
        video_url=video_url,
        webhook_url=webhook_url,
        min_clip_duration=min_clip_duration,
        max_clip_duration=max_clip_duration,
        min_scene_length=min_scene_length,
    )
