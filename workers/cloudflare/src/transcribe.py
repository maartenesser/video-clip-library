"""Transcription module using OpenAI Whisper API."""

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import structlog
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from .models import TranscriptResult, TranscriptSegment, WordTimestamp

logger = structlog.get_logger(__name__)

# Maximum file size for Whisper API (25MB)
MAX_AUDIO_SIZE_MB = 25


class TranscriptionError(Exception):
    """Error during transcription."""

    pass


class Transcriber:
    """Transcribes audio/video using OpenAI Whisper API."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the transcriber.

        Args:
            api_key: OpenAI API key (or from env OPENAI_API_KEY)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        self.client = AsyncOpenAI(api_key=self.api_key)

    async def extract_audio(self, video_path: str, output_path: Optional[str] = None) -> str:
        """Extract audio from video file using FFmpeg.

        Args:
            video_path: Path to video file
            output_path: Path for output audio (optional, creates temp file)

        Returns:
            Path to extracted audio file
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        if output_path is None:
            # Create temporary file for audio
            temp_dir = tempfile.mkdtemp()
            output_path = str(Path(temp_dir) / "audio.mp3")

        logger.info("Extracting audio from video", video=str(video_path), output=output_path)

        # FFmpeg command to extract audio
        cmd = [
            "ffmpeg",
            "-i",
            str(video_path),
            "-vn",  # No video
            "-acodec",
            "libmp3lame",  # MP3 codec
            "-ar",
            "16000",  # 16kHz sample rate (optimal for Whisper)
            "-ac",
            "1",  # Mono
            "-b:a",
            "64k",  # 64kbps bitrate (reduces file size)
            "-y",  # Overwrite output
            output_path,
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode != 0:
                raise TranscriptionError(f"FFmpeg error: {result.stderr}")

        except subprocess.TimeoutExpired:
            raise TranscriptionError("Audio extraction timed out")

        # Check file size
        file_size_mb = Path(output_path).stat().st_size / (1024 * 1024)
        if file_size_mb > MAX_AUDIO_SIZE_MB:
            logger.warning(
                "Audio file exceeds Whisper limit, will be chunked",
                size_mb=file_size_mb,
            )

        logger.info("Audio extracted successfully", size_mb=round(file_size_mb, 2))
        return output_path

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    async def transcribe_audio(self, audio_path: str, language: Optional[str] = None) -> TranscriptResult:
        """Transcribe audio file using OpenAI Whisper API.

        Args:
            audio_path: Path to audio file
            language: Optional language code (e.g., 'en')

        Returns:
            TranscriptResult with full text, segments, and word timestamps
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info("Transcribing audio", path=str(audio_path))

        with open(audio_path, "rb") as audio_file:
            # Use verbose_json to get word timestamps
            response = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
                language=language,
            )

        # Parse response into our models
        # The OpenAI SDK returns objects with attributes, not dicts
        words = []
        if hasattr(response, "words") and response.words:
            for word_data in response.words:
                words.append(
                    WordTimestamp(
                        word=getattr(word_data, "word", ""),
                        start=getattr(word_data, "start", 0.0),
                        end=getattr(word_data, "end", 0.0),
                    )
                )

        segments = []
        if hasattr(response, "segments") and response.segments:
            for seg in response.segments:
                # Get words for this segment
                segment_words = []
                seg_start = getattr(seg, "start", 0.0)
                seg_end = getattr(seg, "end", 0.0)

                for word in words:
                    if word.start >= seg_start and word.end <= seg_end:
                        segment_words.append(word)

                segments.append(
                    TranscriptSegment(
                        text=getattr(seg, "text", "").strip(),
                        start=seg_start,
                        end=seg_end,
                        words=segment_words,
                    )
                )

        result = TranscriptResult(
            full_text=response.text,
            language=getattr(response, "language", language or "en"),
            duration=getattr(response, "duration", 0.0),
            segments=segments,
            words=words,
        )

        logger.info(
            "Transcription completed",
            duration=result.duration,
            segments=len(result.segments),
            words=len(result.words),
        )

        return result

    async def transcribe_video(self, video_path: str, language: Optional[str] = None) -> TranscriptResult:
        """Transcribe a video file.

        Extracts audio first, then transcribes.

        Args:
            video_path: Path to video file
            language: Optional language code

        Returns:
            TranscriptResult with full text, segments, and word timestamps
        """
        logger.info("Starting video transcription", video=video_path)

        # Extract audio
        audio_path = await self.extract_audio(video_path)

        try:
            # Transcribe audio
            result = await self.transcribe_audio(audio_path, language)
            return result
        finally:
            # Clean up temp audio file
            try:
                Path(audio_path).unlink()
                Path(audio_path).parent.rmdir()
            except Exception as e:
                logger.warning("Failed to clean up temp audio", error=str(e))


# Convenience function
async def transcribe_video(video_path: str, language: Optional[str] = None) -> TranscriptResult:
    """Transcribe a video file using OpenAI Whisper API.

    Args:
        video_path: Path to video file
        language: Optional language code

    Returns:
        TranscriptResult with word-level timestamps
    """
    transcriber = Transcriber()
    return await transcriber.transcribe_video(video_path, language)
