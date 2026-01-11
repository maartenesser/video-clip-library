"""Tests for transcription module."""

import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.models import TranscriptResult, TranscriptSegment, WordTimestamp
from src.transcribe import Transcriber, TranscriptionError, transcribe_video

from .mocks.mock_openai import MockOpenAIClient, create_mock_whisper_response


class TestTranscriber:
    """Tests for Transcriber class."""

    def test_init_with_api_key(self):
        """Test initialization with explicit API key."""
        transcriber = Transcriber(api_key="test-key")
        assert transcriber.api_key == "test-key"

    def test_init_from_env(self):
        """Test initialization from environment variable."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "env-key"}):
            transcriber = Transcriber()
            assert transcriber.api_key == "env-key"

    def test_init_without_key_raises(self):
        """Test that missing API key raises ValueError."""
        with patch.dict(os.environ, {}, clear=True):
            # Clear the OPENAI_API_KEY
            os.environ.pop("OPENAI_API_KEY", None)
            with pytest.raises(ValueError, match="API key is required"):
                Transcriber()

    @pytest.mark.asyncio
    async def test_extract_audio(self, sample_video_path, temp_dir):
        """Test audio extraction from video."""
        transcriber = Transcriber(api_key="test-key")
        output_path = str(Path(temp_dir) / "extracted_audio.mp3")

        audio_path = await transcriber.extract_audio(sample_video_path, output_path)

        assert Path(audio_path).exists()
        assert audio_path == output_path

    @pytest.mark.asyncio
    async def test_extract_audio_missing_file(self):
        """Test audio extraction with missing file."""
        transcriber = Transcriber(api_key="test-key")

        with pytest.raises(FileNotFoundError):
            await transcriber.extract_audio("/nonexistent/video.mp4")

    @pytest.mark.asyncio
    async def test_transcribe_audio(self, sample_audio_path, mock_whisper_response):
        """Test audio transcription."""
        transcriber = Transcriber(api_key="test-key")

        # Mock the OpenAI client
        mock_client = MockOpenAIClient(whisper_response=mock_whisper_response)
        transcriber.client = mock_client

        result = await transcriber.transcribe_audio(sample_audio_path)

        assert isinstance(result, TranscriptResult)
        assert result.full_text == mock_whisper_response.text
        assert result.duration == mock_whisper_response.duration
        assert len(result.segments) > 0
        assert len(result.words) > 0

    @pytest.mark.asyncio
    async def test_transcribe_audio_with_language(self, sample_audio_path):
        """Test transcription with specified language."""
        transcriber = Transcriber(api_key="test-key")

        mock_response = create_mock_whisper_response(
            text="Bonjour le monde.",
            language="fr",
        )
        mock_client = MockOpenAIClient(whisper_response=mock_response)
        transcriber.client = mock_client

        result = await transcriber.transcribe_audio(sample_audio_path, language="fr")

        assert result.language == "fr"
        mock_client.audio.transcriptions.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_transcribe_video(self, sample_video_path, mock_whisper_response):
        """Test full video transcription."""
        transcriber = Transcriber(api_key="test-key")
        mock_client = MockOpenAIClient(whisper_response=mock_whisper_response)
        transcriber.client = mock_client

        result = await transcriber.transcribe_video(sample_video_path)

        assert isinstance(result, TranscriptResult)
        assert result.full_text == mock_whisper_response.text


class TestTranscriptResult:
    """Tests for TranscriptResult model."""

    def test_transcript_result_creation(self):
        """Test creating a TranscriptResult."""
        result = TranscriptResult(
            full_text="Test text",
            language="en",
            duration=5.0,
            segments=[],
            words=[],
        )

        assert result.full_text == "Test text"
        assert result.language == "en"
        assert result.duration == 5.0

    def test_transcript_segment_with_words(self):
        """Test TranscriptSegment with word timestamps."""
        words = [
            WordTimestamp(word="Hello", start=0.0, end=0.5),
            WordTimestamp(word="world", start=0.5, end=1.0),
        ]

        segment = TranscriptSegment(
            text="Hello world",
            start=0.0,
            end=1.0,
            words=words,
        )

        assert len(segment.words) == 2
        assert segment.words[0].word == "Hello"


class TestConvenienceFunction:
    """Tests for the transcribe_video convenience function."""

    @pytest.mark.asyncio
    async def test_transcribe_video_function(self, sample_video_path, mock_whisper_response):
        """Test the convenience function."""
        with patch("src.transcribe.Transcriber") as MockTranscriber:
            mock_instance = MagicMock()
            mock_instance.transcribe_video = AsyncMock(
                return_value=TranscriptResult(
                    full_text="Test",
                    language="en",
                    duration=5.0,
                    segments=[],
                    words=[],
                )
            )
            MockTranscriber.return_value = mock_instance

            result = await transcribe_video(sample_video_path)

            assert isinstance(result, TranscriptResult)
            mock_instance.transcribe_video.assert_called_once()
