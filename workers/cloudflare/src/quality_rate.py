"""Quality rating module for scoring video clip quality.

Provides MOS-like (Mean Opinion Score) 1-5 ratings based on:
- Speaking Quality (60% weight): WPM, filler density, hesitation frequency
- Audio Quality (40% weight): Volume consistency, noise level
"""

import asyncio
import json
import subprocess
from dataclasses import dataclass, field
from typing import Optional

import structlog

from .error_detect import ErrorAnalysis
from .models import ClipResult, TranscriptResult, WordTimestamp

logger = structlog.get_logger(__name__)

# Optimal speaking parameters
OPTIMAL_WPM_MIN = 140
OPTIMAL_WPM_MAX = 170
MAX_WPM = 220  # Too fast
MIN_WPM = 80   # Too slow

# Quality thresholds
EXCELLENT_FILLER_RATE = 0.01  # 1% filler words = excellent
GOOD_FILLER_RATE = 0.02       # 2% = good
ACCEPTABLE_FILLER_RATE = 0.05 # 5% = acceptable

# Audio thresholds
TARGET_LOUDNESS = -16.0  # LUFS target
LOUDNESS_TOLERANCE = 3.0  # +/- 3 LUFS is acceptable
NOISE_FLOOR_THRESHOLD = -50.0  # dB - below this is good


@dataclass
class SpeakingQualityMetrics:
    """Metrics for speaking quality assessment."""
    words_per_minute: float = 0.0
    filler_word_rate: float = 0.0  # Percentage of words that are fillers
    hesitation_rate: float = 0.0   # Hesitations per minute
    sentence_completion_rate: float = 1.0  # Ratio of complete sentences


@dataclass
class AudioQualityMetrics:
    """Metrics for audio quality assessment."""
    loudness_lufs: float = -16.0
    loudness_range: float = 5.0
    true_peak_db: float = -1.0
    noise_floor_db: float = -60.0
    clipping_detected: bool = False


@dataclass
class QualityRating:
    """Complete quality rating for a clip."""
    clip_id: str
    speaking_quality_score: float  # 1.0 - 5.0
    audio_quality_score: float     # 1.0 - 5.0
    overall_quality_score: float   # 1.0 - 5.0 (weighted average)
    words_per_minute: float
    filler_word_count: int
    hesitation_count: int
    trimmed_start_seconds: float
    trimmed_end_seconds: float
    speaking_metrics: SpeakingQualityMetrics
    audio_metrics: AudioQualityMetrics


class QualityRater:
    """Rates the quality of video clips based on speaking and audio metrics."""

    def __init__(
        self,
        speaking_weight: float = 0.6,
        audio_weight: float = 0.4,
    ):
        """Initialize the quality rater.

        Args:
            speaking_weight: Weight for speaking quality (0.0-1.0)
            audio_weight: Weight for audio quality (0.0-1.0)
        """
        self.speaking_weight = speaking_weight
        self.audio_weight = audio_weight

    async def analyze_audio_quality(
        self,
        audio_path: str,
    ) -> AudioQualityMetrics:
        """Analyze audio quality using FFmpeg loudnorm filter.

        Args:
            audio_path: Path to audio/video file

        Returns:
            Audio quality metrics
        """
        logger.debug("Analyzing audio quality", audio_path=audio_path)

        # First pass: get loudness stats
        cmd = [
            "ffmpeg",
            "-i", audio_path,
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
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

            # Parse loudnorm JSON output
            metrics = AudioQualityMetrics()

            # Find JSON block in output
            json_start = stderr_text.rfind("{")
            json_end = stderr_text.rfind("}") + 1

            if json_start != -1 and json_end > json_start:
                json_str = stderr_text[json_start:json_end]
                try:
                    loudnorm_data = json.loads(json_str)
                    metrics.loudness_lufs = float(loudnorm_data.get("input_i", -16.0))
                    metrics.loudness_range = float(loudnorm_data.get("input_lra", 5.0))
                    metrics.true_peak_db = float(loudnorm_data.get("input_tp", -1.0))
                except (json.JSONDecodeError, ValueError):
                    logger.warning("Failed to parse loudnorm output")

            # Check for clipping
            if metrics.true_peak_db > -0.5:
                metrics.clipping_detected = True

            return metrics

        except Exception as e:
            logger.warning("Failed to analyze audio quality", error=str(e))
            return AudioQualityMetrics()

    def calculate_speaking_metrics(
        self,
        clip: ClipResult,
        words: list[WordTimestamp],
        error_analysis: ErrorAnalysis,
    ) -> SpeakingQualityMetrics:
        """Calculate speaking quality metrics.

        Args:
            clip: The clip being analyzed
            words: Word timestamps for the clip
            error_analysis: Error analysis results

        Returns:
            Speaking quality metrics
        """
        # Filter words to this clip
        clip_words = [
            w for w in words
            if clip.start_time <= w.start <= clip.end_time
        ]

        word_count = len(clip_words)
        duration_minutes = clip.duration / 60.0

        # Calculate WPM
        wpm = word_count / duration_minutes if duration_minutes > 0 else 0.0

        # Calculate filler word rate
        filler_count = error_analysis.total_filler_words
        filler_rate = filler_count / word_count if word_count > 0 else 0.0

        # Calculate hesitation rate (per minute)
        hesitation_count = error_analysis.total_hesitations
        hesitation_rate = hesitation_count / duration_minutes if duration_minutes > 0 else 0.0

        # Estimate sentence completion (based on trailing punctuation)
        sentences_started = 0
        sentences_completed = 0
        for word in clip_words:
            clean_word = word.word.strip()
            if clean_word and clean_word[0].isupper():
                sentences_started += 1
            if clean_word and clean_word[-1] in ".!?":
                sentences_completed += 1

        completion_rate = sentences_completed / sentences_started if sentences_started > 0 else 1.0

        return SpeakingQualityMetrics(
            words_per_minute=wpm,
            filler_word_rate=filler_rate,
            hesitation_rate=hesitation_rate,
            sentence_completion_rate=min(1.0, completion_rate),
        )

    def score_speaking_quality(
        self,
        metrics: SpeakingQualityMetrics,
    ) -> float:
        """Score speaking quality on a 1-5 scale.

        Args:
            metrics: Speaking quality metrics

        Returns:
            Score from 1.0 to 5.0
        """
        score = 5.0

        # WPM scoring (optimal 140-170)
        wpm = metrics.words_per_minute
        if wpm < MIN_WPM:
            wpm_penalty = (MIN_WPM - wpm) / MIN_WPM * 2.0  # Up to 2 points off
        elif wpm > MAX_WPM:
            wpm_penalty = (wpm - MAX_WPM) / 50.0  # Up to 2 points off
        elif wpm < OPTIMAL_WPM_MIN:
            wpm_penalty = (OPTIMAL_WPM_MIN - wpm) / 60.0 * 0.5  # Small penalty
        elif wpm > OPTIMAL_WPM_MAX:
            wpm_penalty = (wpm - OPTIMAL_WPM_MAX) / 50.0 * 0.5  # Small penalty
        else:
            wpm_penalty = 0.0

        score -= min(2.0, wpm_penalty)

        # Filler word scoring
        filler_rate = metrics.filler_word_rate
        if filler_rate <= EXCELLENT_FILLER_RATE:
            filler_penalty = 0.0
        elif filler_rate <= GOOD_FILLER_RATE:
            filler_penalty = 0.3
        elif filler_rate <= ACCEPTABLE_FILLER_RATE:
            filler_penalty = 0.7
        else:
            # Linear penalty for high filler rates
            filler_penalty = min(2.0, 1.0 + (filler_rate - ACCEPTABLE_FILLER_RATE) * 20)

        score -= filler_penalty

        # Hesitation scoring
        hesitation_rate = metrics.hesitation_rate
        if hesitation_rate <= 2.0:  # 2 or fewer per minute = good
            hesitation_penalty = 0.0
        elif hesitation_rate <= 5.0:
            hesitation_penalty = 0.5
        else:
            hesitation_penalty = min(1.5, (hesitation_rate - 5.0) / 5.0)

        score -= hesitation_penalty

        # Sentence completion bonus/penalty
        completion_rate = metrics.sentence_completion_rate
        if completion_rate >= 0.9:
            score += 0.2  # Small bonus for complete sentences
        elif completion_rate < 0.5:
            score -= 0.5  # Penalty for incomplete thoughts

        return max(1.0, min(5.0, score))

    def score_audio_quality(
        self,
        metrics: AudioQualityMetrics,
    ) -> float:
        """Score audio quality on a 1-5 scale.

        Args:
            metrics: Audio quality metrics

        Returns:
            Score from 1.0 to 5.0
        """
        score = 5.0

        # Loudness scoring (target: -16 LUFS)
        loudness_diff = abs(metrics.loudness_lufs - TARGET_LOUDNESS)
        if loudness_diff <= LOUDNESS_TOLERANCE:
            loudness_penalty = 0.0
        else:
            loudness_penalty = min(2.0, (loudness_diff - LOUDNESS_TOLERANCE) / 5.0)

        score -= loudness_penalty

        # Loudness range scoring (consistent = good)
        if metrics.loudness_range > 15.0:  # Too dynamic
            range_penalty = min(1.0, (metrics.loudness_range - 15.0) / 10.0)
        else:
            range_penalty = 0.0

        score -= range_penalty

        # Clipping penalty
        if metrics.clipping_detected:
            score -= 1.5

        # True peak penalty
        if metrics.true_peak_db > -1.0:
            score -= 0.5
        elif metrics.true_peak_db > -0.5:
            score -= 1.0

        # Noise floor bonus (quiet background = good)
        if metrics.noise_floor_db < NOISE_FLOOR_THRESHOLD:
            score += 0.2  # Small bonus for clean audio

        return max(1.0, min(5.0, score))

    async def rate_clip(
        self,
        clip: ClipResult,
        words: list[WordTimestamp],
        error_analysis: ErrorAnalysis,
    ) -> QualityRating:
        """Rate a single clip's quality.

        Args:
            clip: The clip to rate
            words: Word timestamps from transcript
            error_analysis: Error analysis results

        Returns:
            Complete quality rating
        """
        logger.info("Rating clip quality", clip_id=clip.clip_id)

        # Calculate speaking metrics
        speaking_metrics = self.calculate_speaking_metrics(clip, words, error_analysis)

        # Analyze audio quality
        audio_metrics = await self.analyze_audio_quality(clip.video_path)

        # Score each dimension
        speaking_score = self.score_speaking_quality(speaking_metrics)
        audio_score = self.score_audio_quality(audio_metrics)

        # Calculate weighted overall score
        overall_score = (
            speaking_score * self.speaking_weight +
            audio_score * self.audio_weight
        )

        return QualityRating(
            clip_id=clip.clip_id,
            speaking_quality_score=round(speaking_score, 2),
            audio_quality_score=round(audio_score, 2),
            overall_quality_score=round(overall_score, 2),
            words_per_minute=round(speaking_metrics.words_per_minute, 1),
            filler_word_count=error_analysis.total_filler_words,
            hesitation_count=error_analysis.total_hesitations,
            trimmed_start_seconds=error_analysis.suggested_trim_start,
            trimmed_end_seconds=error_analysis.suggested_trim_end,
            speaking_metrics=speaking_metrics,
            audio_metrics=audio_metrics,
        )

    async def rate_clips(
        self,
        clips: list[ClipResult],
        transcript: TranscriptResult,
        error_analyses: list[ErrorAnalysis],
    ) -> list[QualityRating]:
        """Rate multiple clips.

        Args:
            clips: List of clips to rate
            transcript: Full transcript with word timestamps
            error_analyses: Error analyses for each clip

        Returns:
            List of quality ratings
        """
        logger.info("Rating clips quality", count=len(clips))

        # Create lookup for error analyses
        error_map = {e.clip_id: e for e in error_analyses}

        # Rate clips concurrently
        tasks = []
        for clip in clips:
            error_analysis = error_map.get(clip.clip_id, ErrorAnalysis(clip_id=clip.clip_id))
            tasks.append(self.rate_clip(clip, transcript.words, error_analysis))

        ratings = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out failures
        results = []
        for i, rating in enumerate(ratings):
            if isinstance(rating, Exception):
                logger.warning(
                    "Failed to rate clip",
                    clip_id=clips[i].clip_id,
                    error=str(rating),
                )
                # Create default rating for failed clips
                results.append(QualityRating(
                    clip_id=clips[i].clip_id,
                    speaking_quality_score=3.0,
                    audio_quality_score=3.0,
                    overall_quality_score=3.0,
                    words_per_minute=0.0,
                    filler_word_count=0,
                    hesitation_count=0,
                    trimmed_start_seconds=0.0,
                    trimmed_end_seconds=0.0,
                    speaking_metrics=SpeakingQualityMetrics(),
                    audio_metrics=AudioQualityMetrics(),
                ))
            else:
                results.append(rating)

        return results
