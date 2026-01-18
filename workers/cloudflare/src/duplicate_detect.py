"""Duplicate detection module for finding similar video clips.

Uses OpenAI embeddings API to generate embeddings and find:
- Duplicates (≥0.95 similarity): Same words/content
- Multiple takes (≥0.85 similarity + same source + near in time)
- Same topic (≥0.75 similarity): Related content
"""

import asyncio
import math
import os
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import uuid

import structlog
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from .models import ClipResult

logger = structlog.get_logger(__name__)

# Similarity thresholds
DUPLICATE_THRESHOLD = 0.95
MULTIPLE_TAKES_THRESHOLD = 0.85
SAME_TOPIC_THRESHOLD = 0.75

# Time proximity for multiple takes (seconds)
MULTIPLE_TAKES_TIME_WINDOW = 120  # 2 minutes apart

# OpenAI embedding model configuration
DEFAULT_MODEL_NAME = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536

# Batch size for OpenAI API (max texts per request)
EMBEDDING_BATCH_SIZE = 100


class GroupType(str, Enum):
    """Type of clip group."""
    DUPLICATE = "duplicate"
    MULTIPLE_TAKES = "multiple_takes"
    SAME_TOPIC = "same_topic"


@dataclass
class ClipEmbedding:
    """Embedding for a clip transcript."""
    clip_id: str
    embedding: list[float]
    model_name: str = DEFAULT_MODEL_NAME


@dataclass
class SimilarityPair:
    """A pair of clips with their similarity score."""
    clip_id_1: str
    clip_id_2: str
    similarity: float
    start_time_1: float = 0.0
    start_time_2: float = 0.0


@dataclass
class ClipGroup:
    """A group of similar clips."""
    group_id: str
    group_type: GroupType
    clip_ids: list[str]
    representative_clip_id: str
    similarity_scores: dict[str, float] = field(default_factory=dict)


class DuplicateDetector:
    """Detects duplicate and similar video clips using OpenAI embeddings."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: str = DEFAULT_MODEL_NAME,
        duplicate_threshold: float = DUPLICATE_THRESHOLD,
        takes_threshold: float = MULTIPLE_TAKES_THRESHOLD,
        topic_threshold: float = SAME_TOPIC_THRESHOLD,
    ):
        """Initialize the duplicate detector.

        Args:
            api_key: OpenAI API key (or from env OPENAI_API_KEY)
            model_name: Name of the OpenAI embedding model
            duplicate_threshold: Similarity threshold for duplicates
            takes_threshold: Similarity threshold for multiple takes
            topic_threshold: Similarity threshold for same topic
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required for duplicate detection")

        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model_name = model_name
        self.duplicate_threshold = duplicate_threshold
        self.takes_threshold = takes_threshold
        self.topic_threshold = topic_threshold

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def _call_embedding_api(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """Call OpenAI embedding API with retry logic.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        response = await self.client.embeddings.create(
            model=self.model_name,
            input=texts,
        )

        # Sort by index to maintain order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]

    async def generate_embedding(
        self,
        text: str,
    ) -> list[float]:
        """Generate embedding for a text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector as list of floats
        """
        embeddings = await self._call_embedding_api([text])
        return embeddings[0]

    async def generate_embeddings(
        self,
        clips: list[ClipResult],
    ) -> list[ClipEmbedding]:
        """Generate embeddings for all clips.

        Args:
            clips: List of clips with transcripts

        Returns:
            List of clip embeddings
        """
        logger.info("Generating embeddings for clips", count=len(clips), model=self.model_name)

        if not clips:
            return []

        # Get all transcripts
        transcripts = [clip.transcript for clip in clips]

        # Process in batches
        all_embeddings = []
        for i in range(0, len(transcripts), EMBEDDING_BATCH_SIZE):
            batch = transcripts[i:i + EMBEDDING_BATCH_SIZE]
            logger.debug("Processing embedding batch", batch_num=i // EMBEDDING_BATCH_SIZE + 1, size=len(batch))

            batch_embeddings = await self._call_embedding_api(batch)
            all_embeddings.extend(batch_embeddings)

        # Create ClipEmbedding objects
        embeddings = []
        for i, clip in enumerate(clips):
            embeddings.append(ClipEmbedding(
                clip_id=clip.clip_id,
                embedding=all_embeddings[i],
                model_name=self.model_name,
            ))

        logger.info("Generated embeddings", count=len(embeddings))
        return embeddings

    def compute_similarity(
        self,
        embedding1: list[float],
        embedding2: list[float],
    ) -> float:
        """Compute cosine similarity between two embeddings.

        Args:
            embedding1: First embedding
            embedding2: Second embedding

        Returns:
            Cosine similarity score (0-1)
        """
        # Compute dot product
        dot_product = sum(a * b for a, b in zip(embedding1, embedding2))

        # Compute magnitudes
        norm1 = math.sqrt(sum(a * a for a in embedding1))
        norm2 = math.sqrt(sum(b * b for b in embedding2))

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    def find_similar_pairs(
        self,
        embeddings: list[ClipEmbedding],
        clips: list[ClipResult],
        min_similarity: float = SAME_TOPIC_THRESHOLD,
    ) -> list[SimilarityPair]:
        """Find all pairs of clips above similarity threshold.

        Args:
            embeddings: List of clip embeddings
            clips: List of clips (for timing info)
            min_similarity: Minimum similarity to consider

        Returns:
            List of similar pairs
        """
        logger.debug("Finding similar pairs", count=len(embeddings))

        # Create lookup maps
        embedding_map = {e.clip_id: e.embedding for e in embeddings}
        clip_map = {c.clip_id: c for c in clips}

        pairs = []
        clip_ids = list(embedding_map.keys())

        # Compare all pairs
        for i in range(len(clip_ids)):
            for j in range(i + 1, len(clip_ids)):
                id1 = clip_ids[i]
                id2 = clip_ids[j]

                similarity = self.compute_similarity(
                    embedding_map[id1],
                    embedding_map[id2],
                )

                if similarity >= min_similarity:
                    clip1 = clip_map.get(id1)
                    clip2 = clip_map.get(id2)

                    pairs.append(SimilarityPair(
                        clip_id_1=id1,
                        clip_id_2=id2,
                        similarity=similarity,
                        start_time_1=clip1.start_time if clip1 else 0.0,
                        start_time_2=clip2.start_time if clip2 else 0.0,
                    ))

        logger.debug("Found similar pairs", count=len(pairs))
        return pairs

    def classify_pair(
        self,
        pair: SimilarityPair,
        same_source: bool = True,
    ) -> Optional[GroupType]:
        """Classify a similarity pair into a group type.

        Args:
            pair: The similarity pair to classify
            same_source: Whether clips are from the same source video

        Returns:
            Group type or None if not similar enough
        """
        if pair.similarity >= self.duplicate_threshold:
            return GroupType.DUPLICATE

        if pair.similarity >= self.takes_threshold:
            # Check if they're close in time (multiple takes)
            time_diff = abs(pair.start_time_1 - pair.start_time_2)
            if same_source and time_diff <= MULTIPLE_TAKES_TIME_WINDOW:
                return GroupType.MULTIPLE_TAKES

        if pair.similarity >= self.topic_threshold:
            return GroupType.SAME_TOPIC

        return None

    def build_groups(
        self,
        pairs: list[SimilarityPair],
        clips: list[ClipResult],
    ) -> list[ClipGroup]:
        """Build groups from similar pairs using union-find.

        Args:
            pairs: List of similar pairs
            clips: List of all clips

        Returns:
            List of clip groups
        """
        logger.debug("Building groups from pairs", pairs_count=len(pairs))

        # Group pairs by type
        type_pairs: dict[GroupType, list[SimilarityPair]] = defaultdict(list)

        for pair in pairs:
            group_type = self.classify_pair(pair)
            if group_type:
                type_pairs[group_type].append(pair)

        # Union-find for each group type
        groups = []

        for group_type, typed_pairs in type_pairs.items():
            # Build adjacency from pairs
            adjacency: dict[str, set[str]] = defaultdict(set)
            similarities: dict[tuple[str, str], float] = {}

            for pair in typed_pairs:
                adjacency[pair.clip_id_1].add(pair.clip_id_2)
                adjacency[pair.clip_id_2].add(pair.clip_id_1)
                key = tuple(sorted([pair.clip_id_1, pair.clip_id_2]))
                similarities[key] = pair.similarity

            # Find connected components using DFS
            visited = set()
            components = []

            def dfs(node: str, component: list[str]):
                visited.add(node)
                component.append(node)
                for neighbor in adjacency[node]:
                    if neighbor not in visited:
                        dfs(neighbor, component)

            for clip_id in adjacency:
                if clip_id not in visited:
                    component = []
                    dfs(clip_id, component)
                    if len(component) > 1:  # Only groups with 2+ clips
                        components.append(component)

            # Create ClipGroup objects
            clip_map = {c.clip_id: c for c in clips}

            for component in components:
                # Choose representative (highest quality or first)
                # For now, just use first clip
                representative = component[0]

                # Build similarity scores dict
                scores = {}
                for clip_id in component:
                    if clip_id != representative:
                        key = tuple(sorted([representative, clip_id]))
                        scores[clip_id] = similarities.get(key, 0.0)

                groups.append(ClipGroup(
                    group_id=str(uuid.uuid4()),
                    group_type=group_type,
                    clip_ids=component,
                    representative_clip_id=representative,
                    similarity_scores=scores,
                ))

        logger.info("Built groups", count=len(groups))
        return groups

    async def find_groups(
        self,
        clips: list[ClipResult],
        embeddings: Optional[list[ClipEmbedding]] = None,
    ) -> list[ClipGroup]:
        """Find all groups of similar clips.

        Args:
            clips: List of clips to analyze
            embeddings: Optional pre-computed embeddings

        Returns:
            List of clip groups
        """
        logger.info("Finding duplicate/similar clip groups", count=len(clips))

        # Generate embeddings if not provided
        if embeddings is None:
            embeddings = await self.generate_embeddings(clips)

        # Find similar pairs
        pairs = self.find_similar_pairs(embeddings, clips)

        # Build groups
        groups = self.build_groups(pairs, clips)

        # Log summary
        type_counts = {}
        for group in groups:
            type_counts[group.group_type] = type_counts.get(group.group_type, 0) + 1

        logger.info("Found groups by type", **{t.value: c for t, c in type_counts.items()})

        return groups

    async def detect_duplicates(
        self,
        clips: list[ClipResult],
    ) -> tuple[list[ClipEmbedding], list[ClipGroup]]:
        """Full duplicate detection pipeline.

        Args:
            clips: List of clips to analyze

        Returns:
            Tuple of (embeddings, groups)
        """
        logger.info("Running duplicate detection pipeline", count=len(clips))

        # Generate embeddings
        embeddings = await self.generate_embeddings(clips)

        # Find groups
        groups = await self.find_groups(clips, embeddings)

        return embeddings, groups
