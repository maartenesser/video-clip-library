"""Pydantic models for the video processing pipeline."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class ClipTag(str, Enum):
    """Possible content type tags for video clips."""

    HOOK = "hook"
    PRODUCT_BENEFIT = "product_benefit"
    PROOF = "proof"
    TESTIMONIAL = "testimonial"
    OBJECTION_HANDLING = "objection_handling"
    CTA = "cta"
    B_ROLL = "b_roll"
    INTRO = "intro"
    OUTRO = "outro"
    TRANSITION = "transition"


class ProcessingStatus(str, Enum):
    """Status of video processing job."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    DETECTING_SCENES = "detecting_scenes"
    SPLITTING = "splitting"
    TAGGING = "tagging"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"


# Request/Response Models


class ProcessVideoRequest(BaseModel):
    """Request to process a video."""

    source_id: str = Field(..., description="Unique identifier for the source video")
    video_url: str = Field(..., description="R2 URL or key of the video to process")
    webhook_url: HttpUrl = Field(..., description="URL to call when processing completes")
    min_clip_duration: float = Field(default=3.0, ge=1.0, le=30.0)
    max_clip_duration: float = Field(default=20.0, ge=5.0, le=60.0)
    min_scene_length: float = Field(default=1.5, ge=0.5, le=10.0)


class ProcessVideoResponse(BaseModel):
    """Response after accepting a video processing request."""

    job_id: str
    source_id: str
    status: ProcessingStatus
    message: str


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    timestamp: datetime


# Transcription Models


class WordTimestamp(BaseModel):
    """A single word with its timestamp."""

    word: str
    start: float
    end: float


class TranscriptSegment(BaseModel):
    """A segment of transcript with timing."""

    text: str
    start: float
    end: float
    words: list[WordTimestamp] = Field(default_factory=list)


class TranscriptResult(BaseModel):
    """Result of transcription."""

    full_text: str
    language: str
    duration: float
    segments: list[TranscriptSegment]
    words: list[WordTimestamp]


# Scene Detection Models


class SceneBoundary(BaseModel):
    """A scene boundary detected in the video."""

    start_time: float
    end_time: float
    start_frame: int
    end_frame: int
    duration: float


class SceneDetectionResult(BaseModel):
    """Result of scene detection."""

    total_scenes: int
    video_duration: float
    fps: float
    scenes: list[SceneBoundary]


# Clip Models


class ClipDefinition(BaseModel):
    """Definition of a clip to extract."""

    clip_id: str
    start_time: float
    end_time: float
    transcript: str = ""
    scene_indices: list[int] = Field(default_factory=list)


class ClipResult(BaseModel):
    """Result of clip extraction."""

    clip_id: str
    start_time: float
    end_time: float
    duration: float
    video_path: str
    thumbnail_path: str
    transcript: str


# Tagging Models


class ClipContext(BaseModel):
    """Context for clip tagging."""

    clip_id: str
    transcript: str
    duration: float
    position_in_video: float  # 0.0 to 1.0
    is_first_clip: bool = False
    is_last_clip: bool = False
    previous_transcript: Optional[str] = None
    next_transcript: Optional[str] = None


class TagScore(BaseModel):
    """A tag with its confidence score."""

    tag: ClipTag
    confidence: float = Field(ge=0.0, le=1.0)


class TagResult(BaseModel):
    """Result of clip tagging."""

    clip_id: str
    primary_tag: ClipTag
    primary_confidence: float
    all_tags: list[TagScore]
    reasoning: str


# Pipeline Models


class ProcessedClip(BaseModel):
    """A fully processed clip with all metadata."""

    clip_id: str
    source_id: str
    start_time: float
    end_time: float
    duration: float
    transcript: str
    video_url: str
    thumbnail_url: str
    primary_tag: ClipTag
    tags: list[TagScore]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PipelineResult(BaseModel):
    """Final result of the video processing pipeline."""

    job_id: str
    source_id: str
    status: ProcessingStatus
    total_duration: float
    total_clips: int
    clips: list[ProcessedClip]
    transcript: TranscriptResult
    processing_time_seconds: float
    error: Optional[str] = None


# Webhook Models


class WebhookPayload(BaseModel):
    """Payload sent to webhook on completion."""

    job_id: str
    source_id: str
    status: ProcessingStatus
    result: Optional[PipelineResult] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Error Detection Models


class SilenceRegionModel(BaseModel):
    """A detected region of silence in audio."""

    start: float
    end: float
    duration: float


class FillerWordModel(BaseModel):
    """A detected filler word."""

    word: str
    start: float
    end: float
    is_phrase: bool = False


class HesitationModel(BaseModel):
    """A detected hesitation or pause."""

    start: float
    end: float
    duration: float
    type: str  # 'pause', 'repetition', 'false_start'


class ErrorAnalysisModel(BaseModel):
    """Complete error analysis for a clip."""

    clip_id: str
    silence_regions: list[SilenceRegionModel] = Field(default_factory=list)
    filler_words: list[FillerWordModel] = Field(default_factory=list)
    hesitations: list[HesitationModel] = Field(default_factory=list)
    suggested_trim_start: float = 0.0
    suggested_trim_end: float = 0.0
    total_filler_words: int = 0
    total_hesitations: int = 0
    total_silence_time: float = 0.0


# Quality Rating Models


class SpeakingQualityMetricsModel(BaseModel):
    """Metrics for speaking quality assessment."""

    words_per_minute: float = 0.0
    filler_word_rate: float = 0.0
    hesitation_rate: float = 0.0
    sentence_completion_rate: float = 1.0


class AudioQualityMetricsModel(BaseModel):
    """Metrics for audio quality assessment."""

    loudness_lufs: float = -16.0
    loudness_range: float = 5.0
    true_peak_db: float = -1.0
    noise_floor_db: float = -60.0
    clipping_detected: bool = False


class QualityRatingModel(BaseModel):
    """Complete quality rating for a clip."""

    clip_id: str
    speaking_quality_score: float = Field(ge=1.0, le=5.0)
    audio_quality_score: float = Field(ge=1.0, le=5.0)
    overall_quality_score: float = Field(ge=1.0, le=5.0)
    words_per_minute: float
    filler_word_count: int
    hesitation_count: int
    trimmed_start_seconds: float
    trimmed_end_seconds: float
    speaking_metrics: SpeakingQualityMetricsModel
    audio_metrics: AudioQualityMetricsModel


# Duplicate Detection Models


class GroupType(str, Enum):
    """Type of clip group."""

    DUPLICATE = "duplicate"
    MULTIPLE_TAKES = "multiple_takes"
    SAME_TOPIC = "same_topic"


class ClipEmbeddingModel(BaseModel):
    """Embedding for a clip transcript."""

    clip_id: str
    embedding: list[float]
    model_name: str = "all-MiniLM-L6-v2"


class SimilarityPairModel(BaseModel):
    """A pair of clips with their similarity score."""

    clip_id_1: str
    clip_id_2: str
    similarity: float
    start_time_1: float = 0.0
    start_time_2: float = 0.0


class ClipGroupModel(BaseModel):
    """A group of similar clips."""

    group_id: str
    group_type: GroupType
    clip_ids: list[str]
    representative_clip_id: str
    similarity_scores: dict[str, float] = Field(default_factory=dict)


# Extended Pipeline Models


class ProcessedClipWithQuality(ProcessedClip):
    """A processed clip with quality rating and error analysis."""

    quality_rating: Optional[QualityRatingModel] = None
    error_analysis: Optional[ErrorAnalysisModel] = None
    embedding: Optional[list[float]] = None


class PipelineResultWithQuality(PipelineResult):
    """Pipeline result with quality ratings, embeddings, and groups."""

    clips: list[ProcessedClipWithQuality]  # Override parent type
    clip_groups: list[ClipGroupModel] = Field(default_factory=list)
    embeddings: list[ClipEmbeddingModel] = Field(default_factory=list)


class WebhookPayloadWithQuality(BaseModel):
    """Webhook payload with quality data."""

    job_id: str
    source_id: str
    status: ProcessingStatus
    result: Optional[PipelineResultWithQuality] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
