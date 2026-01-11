"""Tests for clip tagging module."""

import json
import os
from unittest.mock import AsyncMock, patch

import pytest

from src.models import ClipContext, ClipTag, TagResult, TagScore
from src.tagger import ClipTagger, create_clip_contexts, tag_clip

from .mocks.mock_openai import (
    MockChatCompletion,
    MockChatChoice,
    MockChatMessage,
    MockOpenAIClient,
    create_mock_tag_response,
)


class TestClipTagger:
    """Tests for ClipTagger class."""

    def test_init_with_api_key(self):
        """Test initialization with explicit API key."""
        tagger = ClipTagger(api_key="test-key")
        assert tagger.api_key == "test-key"
        assert tagger.model == "gpt-4o-mini"

    def test_init_custom_model(self):
        """Test initialization with custom model."""
        tagger = ClipTagger(api_key="test-key", model="gpt-4o")
        assert tagger.model == "gpt-4o"

    def test_init_from_env(self):
        """Test initialization from environment variable."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "env-key"}):
            tagger = ClipTagger()
            assert tagger.api_key == "env-key"

    def test_init_without_key_raises(self):
        """Test that missing API key raises ValueError."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("OPENAI_API_KEY", None)
            with pytest.raises(ValueError, match="API key is required"):
                ClipTagger()

    def test_build_user_prompt(self):
        """Test user prompt generation."""
        tagger = ClipTagger(api_key="test-key")
        context = ClipContext(
            clip_id="test_001",
            transcript="This is amazing product that will change your life!",
            duration=5.0,
            position_in_video=0.1,
            is_first_clip=True,
        )

        prompt = tagger._build_user_prompt(context)

        assert "test_001" in prompt
        assert "5.0 seconds" in prompt
        assert "10.0%" in prompt
        assert "FIRST clip" in prompt
        assert "This is amazing product" in prompt

    def test_build_user_prompt_with_context(self):
        """Test user prompt with previous/next transcripts."""
        tagger = ClipTagger(api_key="test-key")
        context = ClipContext(
            clip_id="test_001",
            transcript="Current clip text",
            duration=5.0,
            position_in_video=0.5,
            previous_transcript="Previous clip text",
            next_transcript="Next clip text",
        )

        prompt = tagger._build_user_prompt(context)

        assert "Previous clip transcript" in prompt
        assert "Next clip transcript" in prompt

    def test_parse_response_valid_json(self):
        """Test parsing valid JSON response."""
        tagger = ClipTagger(api_key="test-key")
        response = json.dumps(
            {
                "primary_tag": "hook",
                "confidence": 0.9,
                "all_tags": [
                    {"tag": "hook", "confidence": 0.9},
                    {"tag": "product_benefit", "confidence": 0.4},
                ],
                "reasoning": "Opens with attention-grabbing statement",
            }
        )

        result = tagger._parse_response(response, "test_001")

        assert isinstance(result, TagResult)
        assert result.clip_id == "test_001"
        assert result.primary_tag == ClipTag.HOOK
        assert result.primary_confidence == 0.9
        assert len(result.all_tags) == 2

    def test_parse_response_with_markdown(self):
        """Test parsing response with markdown code blocks."""
        tagger = ClipTagger(api_key="test-key")
        response = """```json
{
    "primary_tag": "cta",
    "confidence": 0.85,
    "all_tags": [{"tag": "cta", "confidence": 0.85}],
    "reasoning": "Call to action"
}
```"""

        result = tagger._parse_response(response, "test_001")

        assert result.primary_tag == ClipTag.CTA

    def test_parse_response_invalid_json(self):
        """Test parsing invalid JSON falls back to b_roll."""
        tagger = ClipTagger(api_key="test-key")

        result = tagger._parse_response("not valid json", "test_001")

        assert result.primary_tag == ClipTag.B_ROLL
        assert result.primary_confidence == 0.3

    @pytest.mark.asyncio
    async def test_tag_clip_empty_transcript(self):
        """Test tagging clip with empty transcript returns b_roll."""
        tagger = ClipTagger(api_key="test-key")
        context = ClipContext(
            clip_id="test_001",
            transcript="",
            duration=5.0,
            position_in_video=0.5,
        )

        result = await tagger.tag_clip(context)

        assert result.primary_tag == ClipTag.B_ROLL
        assert result.primary_confidence == 0.9

    @pytest.mark.asyncio
    async def test_tag_clip_short_transcript(self):
        """Test tagging clip with very short transcript."""
        tagger = ClipTagger(api_key="test-key")
        context = ClipContext(
            clip_id="test_001",
            transcript="Hi",  # Too short
            duration=5.0,
            position_in_video=0.5,
        )

        result = await tagger.tag_clip(context)

        assert result.primary_tag == ClipTag.B_ROLL

    @pytest.mark.asyncio
    async def test_tag_clip_with_mock(self, mock_tag_response):
        """Test tagging with mocked API."""
        tagger = ClipTagger(api_key="test-key")
        mock_client = MockOpenAIClient(chat_response=mock_tag_response)
        tagger.client = mock_client

        context = ClipContext(
            clip_id="test_001",
            transcript="This is an amazing opportunity that you won't want to miss!",
            duration=5.0,
            position_in_video=0.1,
            is_first_clip=True,
        )

        result = await tagger.tag_clip(context)

        assert isinstance(result, TagResult)
        assert result.clip_id == "test_001"
        mock_client.chat.completions.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_tag_clips_multiple(self):
        """Test tagging multiple clips."""
        tagger = ClipTagger(api_key="test-key")
        mock_response = create_mock_tag_response("product_benefit", 0.8)
        mock_client = MockOpenAIClient(chat_response=mock_response)
        tagger.client = mock_client

        contexts = [
            ClipContext(
                clip_id=f"test_{i:03d}",
                transcript=f"Clip {i} transcript with enough text",
                duration=5.0,
                position_in_video=i * 0.2,
            )
            for i in range(3)
        ]

        results = await tagger.tag_clips(contexts, max_concurrent=2)

        assert len(results) == 3
        assert all(isinstance(r, TagResult) for r in results)


class TestTagResult:
    """Tests for TagResult model."""

    def test_tag_result_creation(self):
        """Test creating a TagResult."""
        result = TagResult(
            clip_id="test_001",
            primary_tag=ClipTag.HOOK,
            primary_confidence=0.9,
            all_tags=[
                TagScore(tag=ClipTag.HOOK, confidence=0.9),
                TagScore(tag=ClipTag.PRODUCT_BENEFIT, confidence=0.4),
            ],
            reasoning="Test reasoning",
        )

        assert result.clip_id == "test_001"
        assert result.primary_tag == ClipTag.HOOK
        assert len(result.all_tags) == 2


class TestClipContext:
    """Tests for ClipContext model."""

    def test_clip_context_creation(self):
        """Test creating a ClipContext."""
        context = ClipContext(
            clip_id="test_001",
            transcript="Test transcript",
            duration=5.0,
            position_in_video=0.5,
            is_first_clip=True,
            is_last_clip=False,
        )

        assert context.clip_id == "test_001"
        assert context.is_first_clip is True
        assert context.is_last_clip is False


class TestCreateClipContexts:
    """Tests for create_clip_contexts function."""

    def test_create_contexts_from_clips(self, sample_clip_results):
        """Test creating contexts from clip results."""
        contexts = create_clip_contexts(sample_clip_results, total_duration=10.0)

        assert len(contexts) == 2
        assert contexts[0].is_first_clip is True
        assert contexts[0].is_last_clip is False
        assert contexts[1].is_first_clip is False
        assert contexts[1].is_last_clip is True

    def test_create_contexts_with_adjacent_transcripts(self, sample_clip_results):
        """Test that adjacent transcripts are included."""
        contexts = create_clip_contexts(sample_clip_results, total_duration=10.0)

        assert contexts[0].previous_transcript is None
        assert contexts[0].next_transcript == "This is a test."
        assert contexts[1].previous_transcript == "Hello world."
        assert contexts[1].next_transcript is None

    def test_create_contexts_position_calculation(self, sample_clip_results):
        """Test position in video calculation."""
        contexts = create_clip_contexts(sample_clip_results, total_duration=10.0)

        assert contexts[0].position_in_video == 0.0  # 0.0 / 10.0
        assert contexts[1].position_in_video == 0.3  # 3.0 / 10.0


class TestClipTag:
    """Tests for ClipTag enum."""

    def test_all_tags_exist(self):
        """Test that all expected tags exist."""
        expected_tags = [
            "hook",
            "product_benefit",
            "proof",
            "testimonial",
            "objection_handling",
            "cta",
            "b_roll",
            "intro",
            "outro",
            "transition",
        ]

        for tag in expected_tags:
            assert hasattr(ClipTag, tag.upper())
            assert ClipTag(tag) is not None

    def test_tag_values(self):
        """Test tag string values."""
        assert ClipTag.HOOK.value == "hook"
        assert ClipTag.CTA.value == "cta"
        assert ClipTag.B_ROLL.value == "b_roll"
