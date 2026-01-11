"""Mock OpenAI client for testing."""

import json
from dataclasses import dataclass, field
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock


@dataclass
class MockWord:
    """Mock word with timestamp."""

    word: str
    start: float
    end: float

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


@dataclass
class MockSegment:
    """Mock transcript segment."""

    text: str
    start: float
    end: float

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


@dataclass
class MockWhisperResponse:
    """Mock Whisper API response."""

    text: str = "This is a test transcription. It has multiple sentences. Each sentence is important."
    language: str = "en"
    duration: float = 10.0
    words: list = field(default_factory=list)
    segments: list = field(default_factory=list)

    def __post_init__(self):
        if not self.words:
            # Generate mock words
            self.words = [
                {"word": "This", "start": 0.0, "end": 0.5},
                {"word": "is", "start": 0.5, "end": 0.7},
                {"word": "a", "start": 0.7, "end": 0.8},
                {"word": "test", "start": 0.8, "end": 1.2},
                {"word": "transcription.", "start": 1.2, "end": 2.0},
                {"word": "It", "start": 2.0, "end": 2.2},
                {"word": "has", "start": 2.2, "end": 2.5},
                {"word": "multiple", "start": 2.5, "end": 3.0},
                {"word": "sentences.", "start": 3.0, "end": 3.8},
                {"word": "Each", "start": 4.0, "end": 4.3},
                {"word": "sentence", "start": 4.3, "end": 4.8},
                {"word": "is", "start": 4.8, "end": 5.0},
                {"word": "important.", "start": 5.0, "end": 5.8},
            ]

        if not self.segments:
            # Generate mock segments
            self.segments = [
                {"text": "This is a test transcription.", "start": 0.0, "end": 2.0},
                {"text": "It has multiple sentences.", "start": 2.0, "end": 3.8},
                {"text": "Each sentence is important.", "start": 4.0, "end": 5.8},
            ]


@dataclass
class MockChatMessage:
    """Mock chat message."""

    content: str
    role: str = "assistant"


@dataclass
class MockChatChoice:
    """Mock chat choice."""

    message: MockChatMessage
    index: int = 0
    finish_reason: str = "stop"


@dataclass
class MockChatCompletion:
    """Mock chat completion response."""

    choices: list = field(default_factory=list)
    id: str = "mock-completion-id"
    model: str = "gpt-4o-mini"

    def __post_init__(self):
        if not self.choices:
            # Default tagging response
            response = {
                "primary_tag": "hook",
                "confidence": 0.85,
                "all_tags": [
                    {"tag": "hook", "confidence": 0.85},
                    {"tag": "product_benefit", "confidence": 0.45},
                ],
                "reasoning": "The clip opens with attention-grabbing content typical of a hook.",
            }
            self.choices = [
                MockChatChoice(message=MockChatMessage(content=json.dumps(response)))
            ]


class MockAudioTranscriptions:
    """Mock audio transcriptions API."""

    def __init__(self, response: Optional[MockWhisperResponse] = None):
        self.response = response or MockWhisperResponse()
        self.create = AsyncMock(return_value=self.response)


class MockAudio:
    """Mock audio API."""

    def __init__(self, response: Optional[MockWhisperResponse] = None):
        self.transcriptions = MockAudioTranscriptions(response)


class MockChatCompletions:
    """Mock chat completions API."""

    def __init__(self, response: Optional[MockChatCompletion] = None):
        self.response = response or MockChatCompletion()
        self.create = AsyncMock(return_value=self.response)


class MockChat:
    """Mock chat API."""

    def __init__(self, response: Optional[MockChatCompletion] = None):
        self.completions = MockChatCompletions(response)


class MockOpenAIClient:
    """Mock OpenAI async client."""

    def __init__(
        self,
        whisper_response: Optional[MockWhisperResponse] = None,
        chat_response: Optional[MockChatCompletion] = None,
    ):
        """Initialize mock client.

        Args:
            whisper_response: Mock response for Whisper API
            chat_response: Mock response for Chat API
        """
        self.audio = MockAudio(whisper_response)
        self.chat = MockChat(chat_response)


def create_mock_whisper_response(
    text: str = "Test transcription.",
    duration: float = 5.0,
    language: str = "en",
) -> MockWhisperResponse:
    """Create a mock Whisper response with custom values.

    Args:
        text: Transcription text
        duration: Audio duration in seconds
        language: Detected language

    Returns:
        MockWhisperResponse object
    """
    words = []
    current_time = 0.0
    word_duration = duration / len(text.split()) if text else 0.5

    for word in text.split():
        words.append(
            {
                "word": word,
                "start": current_time,
                "end": current_time + word_duration,
            }
        )
        current_time += word_duration

    segments = [{"text": text, "start": 0.0, "end": duration}]

    return MockWhisperResponse(
        text=text,
        language=language,
        duration=duration,
        words=words,
        segments=segments,
    )


def create_mock_tag_response(
    primary_tag: str = "hook",
    confidence: float = 0.85,
    reasoning: str = "Test reasoning",
) -> MockChatCompletion:
    """Create a mock tagging response.

    Args:
        primary_tag: Primary content tag
        confidence: Confidence score
        reasoning: Explanation for the tag

    Returns:
        MockChatCompletion object
    """
    response = {
        "primary_tag": primary_tag,
        "confidence": confidence,
        "all_tags": [
            {"tag": primary_tag, "confidence": confidence},
        ],
        "reasoning": reasoning,
    }

    return MockChatCompletion(
        choices=[MockChatChoice(message=MockChatMessage(content=json.dumps(response)))]
    )
