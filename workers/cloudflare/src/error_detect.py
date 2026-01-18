"""Error detection module for analyzing speech quality in video clips.

Detects:
- Long pauses between words (>0.5s gaps)
- Filler words (um, uh, like, you know, etc.)
- Repeated words/phrases (false starts)
- Silence regions using FFmpeg
"""

import asyncio
import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import structlog

from .models import ClipResult, TranscriptResult, WordTimestamp

logger = structlog.get_logger(__name__)

# Common filler words and phrases
FILLER_WORDS = {
    "um", "uh", "umm", "uhh", "er", "err", "ah", "ahh",
    "like", "basically", "actually", "literally", "honestly",
    "so", "well", "right", "okay", "ok",
}

FILLER_PHRASES = [
    "you know", "i mean", "kind of", "sort of",
    "you see", "i guess", "i think", "to be honest",
]

# Thresholds
LONG_PAUSE_THRESHOLD = 0.5  # seconds
HESITATION_PAUSE_THRESHOLD = 0.3  # seconds
SILENCE_THRESHOLD_DB = -40  # dB for silence detection
MIN_SILENCE_DURATION = 0.3  # seconds


@dataclass
class SilenceRegion:
    """A detected region of silence in audio."""
    start: float
    end: float
    duration: float


@dataclass
class FillerWordDetection:
    """A detected filler word."""
    word: str
    start: float
    end: float
    is_phrase: bool = False


@dataclass
class HesitationDetection:
    """A detected hesitation or pause."""
    start: float
    end: float
    duration: float
    type: str  # 'pause', 'repetition', 'false_start'


@dataclass
class ErrorAnalysis:
    """Complete error analysis for a clip."""
    clip_id: str
    silence_regions: list[SilenceRegion] = field(default_factory=list)
    filler_words: list[FillerWordDetection] = field(default_factory=list)
    hesitations: list[HesitationDetection] = field(default_factory=list)
    suggested_trim_start: float = 0.0
    suggested_trim_end: float = 0.0

    @property
    def total_filler_words(self) -> int:
        return len(self.filler_words)

    @property
    def total_hesitations(self) -> int:
        return len(self.hesitations)

    @property
    def total_silence_time(self) -> float:
        return sum(s.duration for s in self.silence_regions)


class ErrorDetector:
    """Detects speech errors and quality issues in video clips."""

    def __init__(
        self,
        pause_threshold: float = LONG_PAUSE_THRESHOLD,
        silence_threshold_db: float = SILENCE_THRESHOLD_DB,
        min_silence_duration: float = MIN_SILENCE_DURATION,
    ):
        """Initialize the error detector.

        Args:
            pause_threshold: Minimum gap between words to be considered a pause
            silence_threshold_db: Audio level in dB below which is silence
            min_silence_duration: Minimum duration of silence to detect
        """
        self.pause_threshold = pause_threshold
        self.silence_threshold_db = silence_threshold_db
        self.min_silence_duration = min_silence_duration

    async def detect_silence_regions(
        self,
        audio_path: str,
    ) -> list[SilenceRegion]:
        """Detect silence regions in audio using FFmpeg.

        Args:
            audio_path: Path to audio file

        Returns:
            List of silence regions
        """
        logger.debug("Detecting silence regions", audio_path=audio_path)

        cmd = [
            "ffmpeg",
            "-i", audio_path,
            "-af", f"silencedetect=noise={self.silence_threshold_db}dB:d={self.min_silence_duration}",
            "-f", "null",
            "-",
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            _, stderr = await process.communicate()

            stderr_text = stderr.decode("utf-8", errors="ignore")

            # Parse silence detection output
            regions = []
            silence_start = None

            for line in stderr_text.split("\n"):
                if "silence_start:" in line:
                    match = re.search(r"silence_start:\s*([\d.]+)", line)
                    if match:
                        silence_start = float(match.group(1))
                elif "silence_end:" in line and silence_start is not None:
                    match = re.search(r"silence_end:\s*([\d.]+)", line)
                    if match:
                        silence_end = float(match.group(1))
                        duration = silence_end - silence_start
                        regions.append(SilenceRegion(
                            start=silence_start,
                            end=silence_end,
                            duration=duration,
                        ))
                        silence_start = None

            logger.debug("Found silence regions", count=len(regions))
            return regions

        except Exception as e:
            logger.warning("Failed to detect silence", error=str(e))
            return []

    def detect_filler_words(
        self,
        words: list[WordTimestamp],
    ) -> list[FillerWordDetection]:
        """Detect filler words in transcript.

        Args:
            words: List of words with timestamps

        Returns:
            List of detected filler words
        """
        detections = []

        # Clean words for matching
        word_texts = [w.word.lower().strip(".,!?;:") for w in words]

        # Check single filler words
        for i, (word_text, word_ts) in enumerate(zip(word_texts, words)):
            if word_text in FILLER_WORDS:
                detections.append(FillerWordDetection(
                    word=word_text,
                    start=word_ts.start,
                    end=word_ts.end,
                    is_phrase=False,
                ))

        # Check filler phrases (bigrams)
        for i in range(len(word_texts) - 1):
            phrase = f"{word_texts[i]} {word_texts[i+1]}"
            if phrase in FILLER_PHRASES:
                detections.append(FillerWordDetection(
                    word=phrase,
                    start=words[i].start,
                    end=words[i+1].end,
                    is_phrase=True,
                ))

        logger.debug("Found filler words", count=len(detections))
        return detections

    def analyze_word_gaps(
        self,
        words: list[WordTimestamp],
    ) -> list[HesitationDetection]:
        """Analyze gaps between words to find hesitations.

        Args:
            words: List of words with timestamps

        Returns:
            List of detected hesitations
        """
        hesitations = []

        for i in range(1, len(words)):
            gap = words[i].start - words[i-1].end

            if gap >= self.pause_threshold:
                hesitations.append(HesitationDetection(
                    start=words[i-1].end,
                    end=words[i].start,
                    duration=gap,
                    type="pause",
                ))

        logger.debug("Found hesitations from word gaps", count=len(hesitations))
        return hesitations

    def detect_repetitions(
        self,
        words: list[WordTimestamp],
    ) -> list[HesitationDetection]:
        """Detect repeated words that indicate false starts.

        Args:
            words: List of words with timestamps

        Returns:
            List of detected repetitions
        """
        detections = []
        word_texts = [w.word.lower().strip(".,!?;:") for w in words]

        # Look for immediate repetitions (same word twice in a row)
        for i in range(1, len(word_texts)):
            if word_texts[i] == word_texts[i-1] and len(word_texts[i]) > 1:
                detections.append(HesitationDetection(
                    start=words[i-1].start,
                    end=words[i-1].end,
                    duration=words[i-1].end - words[i-1].start,
                    type="repetition",
                ))

        # Look for phrase repetitions (same 2-3 words repeated)
        for window_size in [2, 3]:
            for i in range(window_size, len(word_texts)):
                current_phrase = " ".join(word_texts[i-window_size+1:i+1])
                prev_phrase = " ".join(word_texts[i-2*window_size+1:i-window_size+1])

                if current_phrase == prev_phrase and len(current_phrase) > 3:
                    detections.append(HesitationDetection(
                        start=words[i-2*window_size+1].start,
                        end=words[i-window_size].end,
                        duration=words[i-window_size].end - words[i-2*window_size+1].start,
                        type="false_start",
                    ))

        logger.debug("Found repetitions", count=len(detections))
        return detections

    def calculate_trim_points(
        self,
        clip_duration: float,
        words: list[WordTimestamp],
        silence_regions: list[SilenceRegion],
        hesitations: list[HesitationDetection],
        filler_words: list[FillerWordDetection],
    ) -> tuple[float, float]:
        """Calculate optimal trim points to remove errors from start/end.

        Args:
            clip_duration: Total clip duration
            words: List of words with timestamps
            silence_regions: Detected silence regions
            hesitations: Detected hesitations
            filler_words: Detected filler words

        Returns:
            Tuple of (trim_start, trim_end) in seconds
        """
        trim_start = 0.0
        trim_end = 0.0

        if not words:
            return trim_start, trim_end

        # Find first "clean" word (not filler, not after long pause)
        filler_times = {(f.start, f.end) for f in filler_words}

        for i, word in enumerate(words):
            word_clean = word.word.lower().strip(".,!?;:")

            # Skip if this word is a filler
            if word_clean in FILLER_WORDS:
                continue

            # Skip if preceded by a long pause (silence at start)
            if any(s.end <= word.start and s.start < 0.5 for s in silence_regions):
                continue

            # This is a good start point
            # Trim to just before this word, leaving a small buffer
            trim_start = max(0, word.start - 0.1)
            break

        # Find last "clean" word for end trim
        for i in range(len(words) - 1, -1, -1):
            word = words[i]
            word_clean = word.word.lower().strip(".,!?;:")

            # Skip if this word is a filler
            if word_clean in FILLER_WORDS:
                continue

            # Skip if followed by long silence at end
            if any(s.start >= word.end and s.end > clip_duration - 0.5 for s in silence_regions):
                continue

            # This is a good end point
            # Trim from just after this word
            trim_end = max(0, clip_duration - word.end - 0.1)
            break

        logger.debug(
            "Calculated trim points",
            trim_start=trim_start,
            trim_end=trim_end,
        )

        return trim_start, trim_end

    async def analyze_clip(
        self,
        clip: ClipResult,
        words: list[WordTimestamp],
    ) -> ErrorAnalysis:
        """Analyze a single clip for errors.

        Args:
            clip: The clip to analyze
            words: Word timestamps for the clip

        Returns:
            Complete error analysis
        """
        logger.info("Analyzing clip for errors", clip_id=clip.clip_id)

        # Filter words to those within this clip's time range
        clip_words = [
            w for w in words
            if clip.start_time <= w.start <= clip.end_time
        ]

        # Adjust timestamps to be relative to clip start
        adjusted_words = [
            WordTimestamp(
                word=w.word,
                start=w.start - clip.start_time,
                end=w.end - clip.start_time,
            )
            for w in clip_words
        ]

        # Detect various error types
        silence_regions = await self.detect_silence_regions(clip.video_path)
        filler_words = self.detect_filler_words(adjusted_words)
        hesitations = self.analyze_word_gaps(adjusted_words)
        repetitions = self.detect_repetitions(adjusted_words)

        # Combine hesitations and repetitions
        all_hesitations = hesitations + repetitions

        # Calculate trim points
        trim_start, trim_end = self.calculate_trim_points(
            clip.duration,
            adjusted_words,
            silence_regions,
            all_hesitations,
            filler_words,
        )

        return ErrorAnalysis(
            clip_id=clip.clip_id,
            silence_regions=silence_regions,
            filler_words=filler_words,
            hesitations=all_hesitations,
            suggested_trim_start=trim_start,
            suggested_trim_end=trim_end,
        )

    async def analyze_clips(
        self,
        clips: list[ClipResult],
        transcript: TranscriptResult,
    ) -> list[ErrorAnalysis]:
        """Analyze multiple clips for errors.

        Args:
            clips: List of clips to analyze
            transcript: Full transcript with word timestamps

        Returns:
            List of error analyses
        """
        logger.info("Analyzing clips for errors", count=len(clips))

        # Run analyses concurrently
        tasks = [
            self.analyze_clip(clip, transcript.words)
            for clip in clips
        ]

        analyses = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out failures
        results = []
        for i, analysis in enumerate(analyses):
            if isinstance(analysis, Exception):
                logger.warning(
                    "Failed to analyze clip",
                    clip_id=clips[i].clip_id,
                    error=str(analysis),
                )
                # Create empty analysis for failed clips
                results.append(ErrorAnalysis(clip_id=clips[i].clip_id))
            else:
                results.append(analysis)

        return results
