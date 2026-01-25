"""Transcription module using OpenAI Whisper API.

Supports:
- Direct transcription for files <25MB
- Chunked transcription for larger files (splits into 10-min segments)
- Word-level and segment-level timestamps
"""

import asyncio
import math
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
# Chunk duration for splitting large audio files (10 minutes)
CHUNK_DURATION_SECONDS = 600


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

    async def transcribe_chunked(
        self,
        audio_path: str,
        language: Optional[str] = None,
    ) -> TranscriptResult:
        """Transcribe audio file, automatically chunking if >25MB.

        For large audio files that exceed Whisper's 25MB limit, this method
        splits the audio into 10-minute chunks, transcribes each separately,
        and merges the results with adjusted timestamps.

        Args:
            audio_path: Path to audio file
            language: Optional language code

        Returns:
            TranscriptResult with full text, segments, and word timestamps
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        file_size_mb = audio_path.stat().st_size / (1024 * 1024)

        if file_size_mb <= MAX_AUDIO_SIZE_MB:
            logger.info(
                "Audio file within size limit, using direct transcription",
                size_mb=round(file_size_mb, 2),
            )
            return await self.transcribe_audio(str(audio_path), language)

        logger.info(
            "Audio file exceeds 25MB limit, using chunked transcription",
            size_mb=round(file_size_mb, 2),
        )

        # Get audio duration
        duration = await self._get_audio_duration(str(audio_path))
        num_chunks = math.ceil(duration / CHUNK_DURATION_SECONDS)

        logger.info(
            "Splitting audio into chunks",
            duration=duration,
            num_chunks=num_chunks,
            chunk_duration=CHUNK_DURATION_SECONDS,
        )

        all_segments: list[TranscriptSegment] = []
        all_words: list[WordTimestamp] = []
        all_text_parts: list[str] = []
        detected_language = language

        with tempfile.TemporaryDirectory() as temp_dir:
            for i in range(num_chunks):
                start_time = i * CHUNK_DURATION_SECONDS
                chunk_path = Path(temp_dir) / f"chunk_{i:03d}.mp3"

                # Extract chunk
                await self._extract_audio_chunk(
                    str(audio_path),
                    str(chunk_path),
                    start_time,
                    CHUNK_DURATION_SECONDS,
                )

                # Transcribe chunk
                logger.info(
                    "Transcribing chunk",
                    chunk=i + 1,
                    total=num_chunks,
                    start_time=start_time,
                )

                try:
                    chunk_result = await self.transcribe_audio(str(chunk_path), language)

                    # Adjust timestamps and add to results
                    for segment in chunk_result.segments:
                        adjusted_segment = TranscriptSegment(
                            text=segment.text,
                            start=segment.start + start_time,
                            end=segment.end + start_time,
                            words=[
                                WordTimestamp(
                                    word=w.word,
                                    start=w.start + start_time,
                                    end=w.end + start_time,
                                )
                                for w in segment.words
                            ],
                        )
                        all_segments.append(adjusted_segment)

                    for word in chunk_result.words:
                        adjusted_word = WordTimestamp(
                            word=word.word,
                            start=word.start + start_time,
                            end=word.end + start_time,
                        )
                        all_words.append(adjusted_word)

                    all_text_parts.append(chunk_result.full_text)

                    # Use detected language from first chunk
                    if detected_language is None:
                        detected_language = chunk_result.language

                except Exception as e:
                    logger.error(
                        "Failed to transcribe chunk",
                        chunk=i + 1,
                        error=str(e),
                    )
                    # Continue with other chunks

        result = TranscriptResult(
            full_text=" ".join(all_text_parts),
            language=detected_language or "en",
            duration=duration,
            segments=all_segments,
            words=all_words,
        )

        logger.info(
            "Chunked transcription completed",
            total_segments=len(all_segments),
            total_words=len(all_words),
            duration=duration,
        )

        return result

    async def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio file duration using FFprobe.

        Args:
            audio_path: Path to audio file

        Returns:
            Duration in seconds
        """
        import json

        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            audio_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            raise TranscriptionError(f"FFprobe error: {result.stderr}")

        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0))

    async def _extract_audio_chunk(
        self,
        input_path: str,
        output_path: str,
        start_time: float,
        duration: float,
    ) -> None:
        """Extract a chunk of audio from a file.

        Args:
            input_path: Path to source audio
            output_path: Path for output chunk
            start_time: Start time in seconds
            duration: Duration in seconds
        """
        cmd = [
            "ffmpeg",
            "-ss", str(start_time),
            "-i", input_path,
            "-t", str(duration),
            "-acodec", "libmp3lame",
            "-ar", "16000",
            "-ac", "1",
            "-b:a", "64k",
            "-y",
            output_path,
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise TranscriptionError(f"FFmpeg chunk extraction error: {result.stderr}")

    async def transcribe_video_chunked(
        self,
        video_path: str,
        language: Optional[str] = None,
    ) -> TranscriptResult:
        """Transcribe a video file with automatic chunking for large files.

        Extracts audio first, then uses chunked transcription if needed.

        Args:
            video_path: Path to video file
            language: Optional language code

        Returns:
            TranscriptResult with full text, segments, and word timestamps
        """
        logger.info("Starting chunked video transcription", video=video_path)

        # Extract audio
        audio_path = await self.extract_audio(video_path)

        try:
            # Use chunked transcription (handles both small and large files)
            result = await self.transcribe_chunked(audio_path, language)
            return result
        finally:
            # Clean up temp audio file
            try:
                Path(audio_path).unlink()
                Path(audio_path).parent.rmdir()
            except Exception as e:
                logger.warning("Failed to clean up temp audio", error=str(e))


# Convenience functions
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


async def transcribe_video_chunked(
    video_path: str,
    language: Optional[str] = None,
) -> TranscriptResult:
    """Transcribe a video file with automatic chunking for large files.

    This function handles videos that produce audio files >25MB
    by splitting them into 10-minute chunks for the Whisper API.

    Args:
        video_path: Path to video file
        language: Optional language code

    Returns:
        TranscriptResult with word-level timestamps
    """
    transcriber = Transcriber()
    return await transcriber.transcribe_video_chunked(video_path, language)


async def transcribe_audio_chunked(
    audio_path: str,
    language: Optional[str] = None,
) -> TranscriptResult:
    """Transcribe an audio file with automatic chunking if >25MB.

    Args:
        audio_path: Path to audio file
        language: Optional language code

    Returns:
        TranscriptResult with word-level timestamps
    """
    transcriber = Transcriber()
    return await transcriber.transcribe_chunked(audio_path, language)
