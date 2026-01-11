"""Pytest configuration and fixtures."""

import os
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from .mocks.mock_openai import (
    MockChatCompletion,
    MockOpenAIClient,
    MockWhisperResponse,
    create_mock_tag_response,
    create_mock_whisper_response,
)


# Set test environment variables
os.environ.setdefault("OPENAI_API_KEY", "test-api-key")
os.environ.setdefault("R2_ACCESS_KEY_ID", "test-access-key")
os.environ.setdefault("R2_SECRET_ACCESS_KEY", "test-secret-key")
os.environ.setdefault("R2_ENDPOINT_URL", "https://test.r2.cloudflarestorage.com")
os.environ.setdefault("R2_BUCKET_NAME", "test-bucket")


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def sample_video_path(temp_dir):
    """Create a sample test video using FFmpeg.

    Creates a 5-second test video with a color pattern.
    """
    video_path = Path(temp_dir) / "test_video.mp4"

    # Create a simple test video using FFmpeg
    # This creates a 5-second video with changing colors
    cmd = [
        "ffmpeg",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=5:size=320x240:rate=30",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=5",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        "-shortest",
        "-y",
        str(video_path),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            pytest.skip(f"FFmpeg not available or failed: {result.stderr}")
    except FileNotFoundError:
        pytest.skip("FFmpeg not installed")
    except subprocess.TimeoutExpired:
        pytest.skip("FFmpeg timed out")

    return str(video_path)


@pytest.fixture
def sample_audio_path(temp_dir):
    """Create a sample test audio file."""
    audio_path = Path(temp_dir) / "test_audio.mp3"

    cmd = [
        "ffmpeg",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=3",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "64k",
        "-y",
        str(audio_path),
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            pytest.skip(f"FFmpeg not available or failed: {result.stderr}")
    except FileNotFoundError:
        pytest.skip("FFmpeg not installed")

    return str(audio_path)


@pytest.fixture
def mock_openai_client():
    """Create a mock OpenAI client."""
    return MockOpenAIClient()


@pytest.fixture
def mock_whisper_response():
    """Create a mock Whisper response."""
    return create_mock_whisper_response(
        text="Hello world. This is a test transcription. It works great.",
        duration=5.0,
    )


@pytest.fixture
def mock_tag_response():
    """Create a mock tagging response."""
    return create_mock_tag_response(
        primary_tag="hook",
        confidence=0.9,
        reasoning="Opens with attention-grabbing statement.",
    )


@pytest.fixture
def mock_r2_client():
    """Create a mock R2 client."""
    client = MagicMock()
    client.download_file = AsyncMock(return_value="/tmp/test_video.mp4")
    client.upload_file = AsyncMock(return_value="https://r2.example.com/clips/test.mp4")
    client.get_presigned_url = AsyncMock(return_value="https://r2.example.com/presigned")
    client.delete_file = AsyncMock()
    client.list_files = AsyncMock(return_value=[])
    client.file_exists = AsyncMock(return_value=True)
    return client


@pytest.fixture
def sample_transcript_result():
    """Create a sample TranscriptResult for testing."""
    from src.models import TranscriptResult, TranscriptSegment, WordTimestamp

    return TranscriptResult(
        full_text="Hello world. This is a test. It works great.",
        language="en",
        duration=10.0,
        segments=[
            TranscriptSegment(
                text="Hello world.",
                start=0.0,
                end=2.0,
                words=[
                    WordTimestamp(word="Hello", start=0.0, end=0.8),
                    WordTimestamp(word="world.", start=0.8, end=2.0),
                ],
            ),
            TranscriptSegment(
                text="This is a test.",
                start=2.0,
                end=5.0,
                words=[
                    WordTimestamp(word="This", start=2.0, end=2.5),
                    WordTimestamp(word="is", start=2.5, end=2.8),
                    WordTimestamp(word="a", start=2.8, end=3.0),
                    WordTimestamp(word="test.", start=3.0, end=5.0),
                ],
            ),
            TranscriptSegment(
                text="It works great.",
                start=5.0,
                end=10.0,
                words=[
                    WordTimestamp(word="It", start=5.0, end=5.5),
                    WordTimestamp(word="works", start=5.5, end=7.0),
                    WordTimestamp(word="great.", start=7.0, end=10.0),
                ],
            ),
        ],
        words=[
            WordTimestamp(word="Hello", start=0.0, end=0.8),
            WordTimestamp(word="world.", start=0.8, end=2.0),
            WordTimestamp(word="This", start=2.0, end=2.5),
            WordTimestamp(word="is", start=2.5, end=2.8),
            WordTimestamp(word="a", start=2.8, end=3.0),
            WordTimestamp(word="test.", start=3.0, end=5.0),
            WordTimestamp(word="It", start=5.0, end=5.5),
            WordTimestamp(word="works", start=5.5, end=7.0),
            WordTimestamp(word="great.", start=7.0, end=10.0),
        ],
    )


@pytest.fixture
def sample_scene_boundaries():
    """Create sample scene boundaries for testing."""
    from src.models import SceneBoundary

    return [
        SceneBoundary(
            start_time=0.0,
            end_time=3.0,
            start_frame=0,
            end_frame=90,
            duration=3.0,
        ),
        SceneBoundary(
            start_time=3.0,
            end_time=7.0,
            start_frame=90,
            end_frame=210,
            duration=4.0,
        ),
        SceneBoundary(
            start_time=7.0,
            end_time=10.0,
            start_frame=210,
            end_frame=300,
            duration=3.0,
        ),
    ]


@pytest.fixture
def sample_clip_definitions():
    """Create sample clip definitions for testing."""
    from src.models import ClipDefinition

    return [
        ClipDefinition(
            clip_id="test_clip_0001",
            start_time=0.0,
            end_time=3.0,
            transcript="Hello world.",
        ),
        ClipDefinition(
            clip_id="test_clip_0002",
            start_time=3.0,
            end_time=7.0,
            transcript="This is a test.",
        ),
        ClipDefinition(
            clip_id="test_clip_0003",
            start_time=7.0,
            end_time=10.0,
            transcript="It works great.",
        ),
    ]


@pytest.fixture
def sample_clip_results():
    """Create sample clip results for testing."""
    from src.models import ClipResult

    return [
        ClipResult(
            clip_id="test_clip_0001",
            start_time=0.0,
            end_time=3.0,
            duration=3.0,
            video_path="/tmp/clips/test_clip_0001.mp4",
            thumbnail_path="/tmp/clips/test_clip_0001_thumb.jpg",
            transcript="Hello world.",
        ),
        ClipResult(
            clip_id="test_clip_0002",
            start_time=3.0,
            end_time=7.0,
            duration=4.0,
            video_path="/tmp/clips/test_clip_0002.mp4",
            thumbnail_path="/tmp/clips/test_clip_0002_thumb.jpg",
            transcript="This is a test.",
        ),
    ]
