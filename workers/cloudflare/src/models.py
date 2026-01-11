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
