"""Clip tagging module using GPT-4o-mini."""

import os
from typing import Optional

import structlog
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from .models import ClipContext, ClipTag, TagResult, TagScore

logger = structlog.get_logger(__name__)


class TaggingError(Exception):
    """Error during clip tagging."""

    pass


# System prompt for clip classification
SYSTEM_PROMPT = """You are an expert video content analyst specializing in marketing and advertising videos.
Your task is to classify video clips based on their transcript content into specific content types.

Available content types:
- hook: Opening statements designed to grab attention, often includes provocative questions, bold claims, or pattern interrupts
- product_benefit: Describes features, advantages, or benefits of a product/service
- proof: Evidence supporting claims - statistics, case studies, before/after results, demonstrations
- testimonial: Customer stories, reviews, or endorsements from real users
- objection_handling: Addresses common concerns, doubts, or reasons why someone might not buy
- cta: Call-to-action - direct requests to take action (buy now, sign up, click below, etc.)
- b_roll: Supplementary footage without speech, or non-essential transition content
- intro: Introduction of speaker, brand, or topic (not a hook)
- outro: Closing statements, wrap-ups, farewells
- transition: Connecting segments between main content

Consider the clip's position in the video:
- First clips (first 15%) are more likely to be hooks or intros
- Last clips (last 15%) are more likely to be CTAs or outros
- Middle content varies based on the actual transcript

Respond in JSON format with:
{
    "primary_tag": "the most appropriate tag",
    "confidence": 0.0-1.0,
    "all_tags": [{"tag": "tag_name", "confidence": 0.0-1.0}, ...],
    "reasoning": "brief explanation of classification"
}

Include up to 3 relevant tags in all_tags, sorted by confidence."""


class ClipTagger:
    """Tags video clips using GPT-4o-mini."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
    ):
        """Initialize the tagger.

        Args:
            api_key: OpenAI API key (or from env OPENAI_API_KEY)
            model: Model to use for tagging
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model = model

    def _build_user_prompt(self, context: ClipContext) -> str:
        """Build the user prompt for classification.

        Args:
            context: Clip context with transcript and metadata

        Returns:
            Formatted user prompt
        """
        lines = [
            f"Clip ID: {context.clip_id}",
            f"Duration: {context.duration:.1f} seconds",
            f"Position in video: {context.position_in_video:.1%}",
        ]

        if context.is_first_clip:
            lines.append("Note: This is the FIRST clip in the video")
        if context.is_last_clip:
            lines.append("Note: This is the LAST clip in the video")

        lines.append(f"\nTranscript:\n\"{context.transcript}\"")

        if context.previous_transcript:
            lines.append(f"\nPrevious clip transcript:\n\"{context.previous_transcript[:200]}...\"")

        if context.next_transcript:
            lines.append(f"\nNext clip transcript:\n\"{context.next_transcript[:200]}...\"")

        return "\n".join(lines)

    def _parse_response(self, response_text: str, clip_id: str) -> TagResult:
        """Parse GPT response into TagResult.

        Args:
            response_text: Raw response from GPT
            clip_id: Clip ID for the result

        Returns:
            TagResult object
        """
        import json

        try:
            # Try to extract JSON from response
            # Handle cases where response might have markdown code blocks
            text = response_text.strip()
            if text.startswith("```"):
                # Remove markdown code block
                lines = text.split("\n")
                text = "\n".join(lines[1:-1])

            data = json.loads(text)

            primary_tag = ClipTag(data["primary_tag"])
            primary_confidence = float(data.get("confidence", 0.8))

            all_tags = []
            for tag_data in data.get("all_tags", []):
                try:
                    tag = ClipTag(tag_data["tag"])
                    confidence = float(tag_data.get("confidence", 0.5))
                    all_tags.append(TagScore(tag=tag, confidence=confidence))
                except (ValueError, KeyError):
                    continue

            # Ensure primary tag is in all_tags
            if not any(t.tag == primary_tag for t in all_tags):
                all_tags.insert(0, TagScore(tag=primary_tag, confidence=primary_confidence))

            return TagResult(
                clip_id=clip_id,
                primary_tag=primary_tag,
                primary_confidence=primary_confidence,
                all_tags=all_tags,
                reasoning=data.get("reasoning", ""),
            )

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(
                "Failed to parse tagging response, using fallback",
                error=str(e),
                response=response_text[:200],
            )
            # Fallback to b_roll with low confidence
            return TagResult(
                clip_id=clip_id,
                primary_tag=ClipTag.B_ROLL,
                primary_confidence=0.3,
                all_tags=[TagScore(tag=ClipTag.B_ROLL, confidence=0.3)],
                reasoning="Failed to parse AI response, defaulting to b_roll",
            )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    async def tag_clip(self, context: ClipContext) -> TagResult:
        """Tag a single clip based on its context.

        Args:
            context: Clip context with transcript and metadata

        Returns:
            TagResult with primary and secondary tags
        """
        # Handle empty or very short transcripts
        if not context.transcript or len(context.transcript.strip()) < 10:
            logger.info(
                "Clip has minimal transcript, classifying as b_roll",
                clip_id=context.clip_id,
            )
            return TagResult(
                clip_id=context.clip_id,
                primary_tag=ClipTag.B_ROLL,
                primary_confidence=0.9,
                all_tags=[TagScore(tag=ClipTag.B_ROLL, confidence=0.9)],
                reasoning="Clip has no or minimal speech content",
            )

        user_prompt = self._build_user_prompt(context)

        logger.debug("Tagging clip", clip_id=context.clip_id)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,  # Lower temperature for more consistent classification
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        response_text = response.choices[0].message.content
        result = self._parse_response(response_text, context.clip_id)

        logger.info(
            "Clip tagged",
            clip_id=context.clip_id,
            primary_tag=result.primary_tag,
            confidence=result.primary_confidence,
        )

        return result

    async def tag_clips(
        self,
        clips: list[ClipContext],
        max_concurrent: int = 5,
    ) -> list[TagResult]:
        """Tag multiple clips.

        Args:
            clips: List of clip contexts
            max_concurrent: Maximum concurrent API calls

        Returns:
            List of TagResult objects
        """
        import asyncio

        logger.info("Tagging clips", total=len(clips))

        semaphore = asyncio.Semaphore(max_concurrent)

        async def tag_with_semaphore(context: ClipContext) -> TagResult:
            async with semaphore:
                return await self.tag_clip(context)

        results = await asyncio.gather(
            *[tag_with_semaphore(clip) for clip in clips],
            return_exceptions=True,
        )

        # Handle any errors
        final_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(
                    "Failed to tag clip",
                    clip_id=clips[i].clip_id,
                    error=str(result),
                )
                # Return fallback result
                final_results.append(
                    TagResult(
                        clip_id=clips[i].clip_id,
                        primary_tag=ClipTag.B_ROLL,
                        primary_confidence=0.1,
                        all_tags=[TagScore(tag=ClipTag.B_ROLL, confidence=0.1)],
                        reasoning=f"Tagging failed: {str(result)}",
                    )
                )
            else:
                final_results.append(result)

        logger.info("Tagging completed", successful=len(final_results))
        return final_results


async def tag_clip(transcript: str, context: ClipContext) -> TagResult:
    """Tag a clip based on its transcript and context.

    Args:
        transcript: The clip's transcript text
        context: Additional clip context

    Returns:
        TagResult with tags and confidence scores
    """
    # Update context with transcript if not already set
    if not context.transcript:
        context.transcript = transcript

    tagger = ClipTagger()
    return await tagger.tag_clip(context)


def create_clip_contexts(
    clips: list,
    total_duration: float,
) -> list[ClipContext]:
    """Create ClipContext objects for a list of clips.

    Args:
        clips: List of ClipResult or similar objects with clip_id, transcript, duration
        total_duration: Total video duration

    Returns:
        List of ClipContext objects
    """
    contexts = []

    for i, clip in enumerate(clips):
        position = clip.start_time / total_duration if total_duration > 0 else 0

        context = ClipContext(
            clip_id=clip.clip_id,
            transcript=clip.transcript,
            duration=clip.duration,
            position_in_video=position,
            is_first_clip=(i == 0),
            is_last_clip=(i == len(clips) - 1),
            previous_transcript=clips[i - 1].transcript if i > 0 else None,
            next_transcript=clips[i + 1].transcript if i < len(clips) - 1 else None,
        )
        contexts.append(context)

    return contexts
