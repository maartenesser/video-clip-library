"""Tests for video processing pipeline."""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models import (
    ClipTag,
    PipelineResult,
    ProcessedClip,
    ProcessingStatus,
    TagScore,
    TranscriptResult,
    WebhookPayload,
)
from src.pipeline import PipelineError, VideoPipeline, process_video


class TestVideoPipeline:
    """Tests for VideoPipeline class."""

    def test_init_defaults(self, mock_r2_client):
        """Test default initialization."""
        with patch("src.pipeline.get_r2_client", return_value=mock_r2_client):
            pipeline = VideoPipeline()

            assert pipeline.output_bucket == "video-clips"
            assert pipeline.scene_detector is not None
            assert pipeline.video_splitter is not None

    def test_init_custom_bucket(self, mock_r2_client):
        """Test initialization with custom bucket."""
        pipeline = VideoPipeline(
            r2_client=mock_r2_client,
            output_bucket="custom-bucket",
        )

        assert pipeline.output_bucket == "custom-bucket"

    @pytest.mark.asyncio
    async def test_download_video_with_url(self, mock_r2_client, temp_dir):
        """Test downloading video from full URL."""
        pipeline = VideoPipeline(r2_client=mock_r2_client)
        mock_r2_client.download_file = AsyncMock(return_value=None)

        result = await pipeline.download_video(
            "https://r2.example.com/bucket/videos/test.mp4",
            temp_dir,
        )

        # Pipeline uses "source.mp4" as the local filename
        assert result == f"{temp_dir}/source.mp4"
        mock_r2_client.download_file.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_video_with_key(self, mock_r2_client, temp_dir):
        """Test downloading video from key."""
        pipeline = VideoPipeline(r2_client=mock_r2_client)
        mock_r2_client.download_file = AsyncMock(return_value=None)

        result = await pipeline.download_video("videos/test.mp4", temp_dir)

        # Pipeline uses "source.mp4" as the local filename
        assert result == f"{temp_dir}/source.mp4"

    @pytest.mark.asyncio
    async def test_upload_clips(self, mock_r2_client, sample_clip_results):
        """Test uploading clips to R2."""
        pipeline = VideoPipeline(r2_client=mock_r2_client)

        urls = await pipeline.upload_clips(sample_clip_results, "test_source")

        assert len(urls) == 2
        # upload_clips returns list of dicts with video_url, thumbnail_url, video_key, thumbnail_key
        assert all(isinstance(u, dict) and "video_url" in u and "thumbnail_url" in u for u in urls)

    @pytest.mark.asyncio
    async def test_call_webhook_success(self):
        """Test successful webhook call."""
        pipeline = VideoPipeline()
        # call_webhook expects a dict, not WebhookPayload
        payload = {
            "job_id": "test-job",
            "source_id": "test-source",
            "status": "completed",
        }

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_client.post = AsyncMock(return_value=mock_response)
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await pipeline.call_webhook(
                "https://example.com/webhook",
                payload,
            )

            assert result is True

    @pytest.mark.asyncio
    async def test_call_webhook_retry_on_failure(self):
        """Test webhook retries on failure."""
        pipeline = VideoPipeline()
        # call_webhook expects a dict, not WebhookPayload
        payload = {
            "job_id": "test-job",
            "source_id": "test-source",
            "status": "completed",
        }

        with patch("httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_client.post = AsyncMock(return_value=mock_response)
            MockClient.return_value.__aenter__.return_value = mock_client

            result = await pipeline.call_webhook(
                "https://example.com/webhook",
                payload,
                retries=2,
            )

            assert result is False
            assert mock_client.post.call_count == 2

    @pytest.mark.asyncio
    async def test_process_video_full_pipeline(
        self,
        mock_r2_client,
        sample_video_path,
        mock_whisper_response,
        mock_tag_response,
        temp_dir,
    ):
        """Test full pipeline execution with mocks."""
        from src.models import SceneBoundary, ClipEmbeddingModel, ClipGroupModel

        # Create pipeline with mocked components and disable quality analysis
        pipeline = VideoPipeline(
            r2_client=mock_r2_client,
            enable_quality_analysis=False,  # Disable to avoid API calls
        )

        # Mock download to return our sample video
        mock_r2_client.download_file = AsyncMock(return_value=None)

        # Mock transcriber
        mock_transcriber = MagicMock()
        mock_transcriber.transcribe_video = AsyncMock(
            return_value=TranscriptResult(
                full_text="Test transcription",
                language="en",
                duration=5.0,
                segments=[],
                words=[],
            )
        )
        pipeline.transcriber = mock_transcriber

        # Mock scene detector
        mock_scene_detector = MagicMock()
        mock_scene_detector.min_scene_len = 1.5
        mock_scene_detector.detect_scenes = MagicMock(
            return_value=MagicMock(
                total_scenes=1,
                video_duration=5.0,
                fps=30.0,
                scenes=[
                    SceneBoundary(
                        start_time=0.0,
                        end_time=5.0,
                        start_frame=0,
                        end_frame=150,
                        duration=5.0,
                    )
                ],
            )
        )
        pipeline.scene_detector = mock_scene_detector

        # Mock video splitter
        from src.models import ClipResult

        mock_splitter = MagicMock()
        mock_splitter.split_video = AsyncMock(
            return_value=[
                ClipResult(
                    clip_id="test_clip_0001",
                    start_time=0.0,
                    end_time=5.0,
                    duration=5.0,
                    video_path=f"{temp_dir}/clip.mp4",
                    thumbnail_path=f"{temp_dir}/thumb.jpg",
                    transcript="Test",
                )
            ]
        )
        pipeline.video_splitter = mock_splitter

        # Mock tagger
        from src.models import TagResult

        mock_tagger = MagicMock()
        mock_tagger.tag_clips = AsyncMock(
            return_value=[
                TagResult(
                    clip_id="test_clip_0001",
                    primary_tag=ClipTag.HOOK,
                    primary_confidence=0.9,
                    all_tags=[TagScore(tag=ClipTag.HOOK, confidence=0.9)],
                    reasoning="Test",
                )
            ]
        )
        pipeline.clip_tagger = mock_tagger

        # Mock webhook
        with patch.object(pipeline, "call_webhook", new_callable=AsyncMock) as mock_webhook:
            mock_webhook.return_value = True

            result = await pipeline.process_video(
                source_id="test_source",
                video_url="videos/test.mp4",
                webhook_url="https://example.com/webhook",
            )

            assert isinstance(result, PipelineResult)
            assert result.status == ProcessingStatus.COMPLETED
            assert result.total_clips == 1
            mock_webhook.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_video_handles_errors(self, mock_r2_client):
        """Test pipeline handles errors and calls webhook."""
        pipeline = VideoPipeline(r2_client=mock_r2_client)

        # Mock download to fail
        mock_r2_client.download_file = AsyncMock(
            side_effect=Exception("Download failed")
        )

        with patch.object(pipeline, "call_webhook", new_callable=AsyncMock) as mock_webhook:
            mock_webhook.return_value = True

            with pytest.raises(PipelineError):
                await pipeline.process_video(
                    source_id="test_source",
                    video_url="videos/test.mp4",
                    webhook_url="https://example.com/webhook",
                )

            # Webhook should still be called with error status
            mock_webhook.assert_called_once()
            call_args = mock_webhook.call_args[0]
            # call_webhook receives (url, payload_dict), so payload is at index 1
            payload = call_args[1]
            assert payload["status"] == ProcessingStatus.FAILED.value


class TestPipelineResult:
    """Tests for PipelineResult model."""

    def test_pipeline_result_creation(self, sample_transcript_result):
        """Test creating a PipelineResult."""
        result = PipelineResult(
            job_id="test-job",
            source_id="test-source",
            status=ProcessingStatus.COMPLETED,
            total_duration=60.0,
            total_clips=5,
            clips=[],
            transcript=sample_transcript_result,
            processing_time_seconds=120.5,
        )

        assert result.job_id == "test-job"
        assert result.status == ProcessingStatus.COMPLETED
        assert result.total_clips == 5


class TestProcessedClip:
    """Tests for ProcessedClip model."""

    def test_processed_clip_creation(self):
        """Test creating a ProcessedClip."""
        clip = ProcessedClip(
            clip_id="test_001",
            source_id="source_001",
            start_time=0.0,
            end_time=5.0,
            duration=5.0,
            transcript="Test transcript",
            video_url="https://r2.example.com/clip.mp4",
            thumbnail_url="https://r2.example.com/thumb.jpg",
            primary_tag=ClipTag.HOOK,
            tags=[TagScore(tag=ClipTag.HOOK, confidence=0.9)],
        )

        assert clip.clip_id == "test_001"
        assert clip.primary_tag == ClipTag.HOOK
        assert clip.created_at is not None


class TestWebhookPayload:
    """Tests for WebhookPayload model."""

    def test_webhook_payload_creation(self):
        """Test creating a WebhookPayload."""
        payload = WebhookPayload(
            job_id="test-job",
            source_id="test-source",
            status=ProcessingStatus.COMPLETED,
        )

        assert payload.job_id == "test-job"
        assert payload.timestamp is not None

    def test_webhook_payload_with_error(self):
        """Test webhook payload with error."""
        payload = WebhookPayload(
            job_id="test-job",
            source_id="test-source",
            status=ProcessingStatus.FAILED,
            error="Something went wrong",
        )

        assert payload.error == "Something went wrong"


class TestProcessingStatus:
    """Tests for ProcessingStatus enum."""

    def test_all_statuses_exist(self):
        """Test that all expected statuses exist."""
        expected = [
            "pending",
            "downloading",
            "transcribing",
            "detecting_scenes",
            "splitting",
            "tagging",
            "uploading",
            "completed",
            "failed",
        ]

        for status in expected:
            assert ProcessingStatus(status) is not None


class TestConvenienceFunction:
    """Tests for process_video convenience function."""

    @pytest.mark.asyncio
    async def test_process_video_function(self):
        """Test the convenience function."""
        with patch("src.pipeline.VideoPipeline") as MockPipeline:
            mock_instance = MagicMock()
            mock_instance.process_video = AsyncMock()
            MockPipeline.return_value = mock_instance

            await process_video(
                source_id="test",
                video_url="test.mp4",
                webhook_url="https://example.com/webhook",
            )

            mock_instance.process_video.assert_called_once_with(
                source_id="test",
                video_url="test.mp4",
                webhook_url="https://example.com/webhook",
                min_clip_duration=3.0,
                max_clip_duration=20.0,
                min_scene_length=1.5,
            )
