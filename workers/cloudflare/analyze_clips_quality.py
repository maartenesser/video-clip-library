#!/usr/bin/env python3
"""Analyze clips for quality rating and duplicate detection."""

import os
import sys
import re
from decimal import Decimal
from typing import Optional
import numpy as np

# Load environment
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

# Supabase config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Dutch filler words (common in spoken Dutch)
DUTCH_FILLER_WORDS = {
    "eh", "euh", "uhm", "um", "uh",
    "dus", "eigenlijk", "zeg maar", "weet je", "weet je wel",
    "ja", "nou", "toch", "gewoon", "ook", "even",
    "soort van", "een beetje", "best wel", "laten we zeggen",
    "hoe heet het", "hoe zeg je dat", "wat was het ook alweer"
}

# Words that often indicate hesitation when repeated
HESITATION_INDICATORS = {"en", "dan", "maar", "de", "het", "een", "ik", "je", "we"}


def detect_filler_words(text: str) -> tuple[int, list[str]]:
    """Detect filler words in transcript text."""
    if not text:
        return 0, []

    text_lower = text.lower()
    found_fillers = []

    for filler in DUTCH_FILLER_WORDS:
        # Count occurrences using word boundaries
        pattern = r'\b' + re.escape(filler) + r'\b'
        matches = re.findall(pattern, text_lower)
        found_fillers.extend(matches)

    return len(found_fillers), found_fillers


def detect_hesitations(text: str) -> int:
    """Detect hesitations (repeated words, stutters) in transcript."""
    if not text:
        return 0

    words = text.lower().split()
    hesitation_count = 0

    # Check for repeated consecutive words
    for i in range(len(words) - 1):
        if words[i] == words[i + 1]:
            hesitation_count += 1

    # Check for stuttering patterns (e.g., "d-dan", "i-ik")
    stutter_pattern = r'\b(\w)-\1\w+'
    stutters = re.findall(stutter_pattern, text.lower())
    hesitation_count += len(stutters)

    return hesitation_count


def calculate_words_per_minute(text: str, duration_seconds: float) -> float:
    """Calculate words per minute from transcript and duration."""
    if not text or duration_seconds <= 0:
        return 0.0

    # Count words (simple split, could be enhanced)
    word_count = len(text.split())

    # Calculate WPM
    minutes = duration_seconds / 60.0
    wpm = word_count / minutes if minutes > 0 else 0

    return wpm


def calculate_speaking_quality_score(
    wpm: float,
    filler_count: int,
    hesitation_count: int,
    word_count: int,
    duration_seconds: float
) -> float:
    """
    Calculate speaking quality score (1.0 - 5.0).

    Factors:
    - Words per minute (optimal: 140-170 for Dutch)
    - Filler word density
    - Hesitation frequency
    """
    score = 5.0  # Start with perfect score

    # WPM penalty (optimal range: 120-180 for Dutch)
    if wpm < 80:
        score -= 1.5  # Too slow
    elif wpm < 120:
        score -= 0.5  # Slightly slow
    elif wpm > 200:
        score -= 1.0  # Too fast
    elif wpm > 180:
        score -= 0.3  # Slightly fast

    # Filler word density penalty
    if word_count > 0:
        filler_density = filler_count / word_count
        if filler_density > 0.10:  # >10% fillers
            score -= 2.0
        elif filler_density > 0.05:  # >5% fillers
            score -= 1.0
        elif filler_density > 0.02:  # >2% fillers
            score -= 0.5

    # Hesitation penalty
    hesitations_per_minute = hesitation_count / (duration_seconds / 60) if duration_seconds > 0 else 0
    if hesitations_per_minute > 5:
        score -= 1.5
    elif hesitations_per_minute > 2:
        score -= 0.5

    # Clamp to valid range
    return max(1.0, min(5.0, score))


def calculate_audio_quality_score(duration_seconds: float) -> float:
    """
    Calculate audio quality score (1.0 - 5.0).

    Since we don't have audio analysis in this script, we use duration as a proxy.
    Clips that are too short or too long might have quality issues.
    Very short clips (<3s) might be cuts.
    Very long clips (>60s) might need trimming.
    """
    if duration_seconds < 2:
        return 2.5  # Very short clips
    elif duration_seconds < 5:
        return 3.5  # Short clips
    elif duration_seconds <= 30:
        return 4.5  # Ideal length
    elif duration_seconds <= 60:
        return 4.0  # Slightly long
    else:
        return 3.5  # Long clips


def calculate_overall_score(speaking_score: float, audio_score: float) -> float:
    """Calculate overall quality score as weighted average."""
    # 60% speaking quality, 40% audio quality
    return round(0.6 * speaking_score + 0.4 * audio_score, 2)


def analyze_clip(clip: dict) -> dict:
    """Analyze a single clip and return quality metrics."""
    transcript = clip.get("transcript_segment") or ""
    duration = float(clip.get("duration_seconds") or 0)

    # Count words
    word_count = len(transcript.split()) if transcript else 0

    # Detect issues
    filler_count, filler_words = detect_filler_words(transcript)
    hesitation_count = detect_hesitations(transcript)
    wpm = calculate_words_per_minute(transcript, duration)

    # Calculate scores
    speaking_score = calculate_speaking_quality_score(
        wpm, filler_count, hesitation_count, word_count, duration
    )
    audio_score = calculate_audio_quality_score(duration)
    overall_score = calculate_overall_score(speaking_score, audio_score)

    return {
        "clip_id": clip["id"],
        "speaking_quality_score": speaking_score,
        "audio_quality_score": audio_score,
        "overall_quality_score": overall_score,
        "hesitation_count": hesitation_count,
        "filler_word_count": filler_count,
        "words_per_minute": round(wpm, 2),
        "quality_metadata": {
            "word_count": word_count,
            "filler_words_found": filler_words[:10],  # Store up to 10 examples
            "duration_seconds": duration,
        }
    }


def generate_embeddings(clips: list[dict]) -> dict[str, list[float]]:
    """Generate embeddings for clip transcripts using sentence-transformers."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print("sentence-transformers not installed. Skipping embedding generation.")
        print("Install with: pip install sentence-transformers")
        return {}

    print("Loading sentence-transformers model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    embeddings = {}
    transcripts = []
    clip_ids = []

    for clip in clips:
        transcript = clip.get("transcript_segment") or ""
        if transcript.strip():
            transcripts.append(transcript)
            clip_ids.append(clip["id"])

    if not transcripts:
        return {}

    print(f"Generating embeddings for {len(transcripts)} clips...")
    vectors = model.encode(transcripts, show_progress_bar=True)

    for clip_id, vector in zip(clip_ids, vectors):
        embeddings[clip_id] = vector.tolist()

    return embeddings


def find_similar_clips(embeddings: dict[str, list[float]], threshold: float = 0.85) -> list[tuple[str, str, float]]:
    """Find similar clip pairs based on embedding similarity."""
    if not embeddings:
        return []

    clip_ids = list(embeddings.keys())
    vectors = np.array([embeddings[cid] for cid in clip_ids])

    # Normalize for cosine similarity
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    normalized = vectors / norms

    # Compute similarity matrix
    similarity_matrix = np.dot(normalized, normalized.T)

    similar_pairs = []
    for i in range(len(clip_ids)):
        for j in range(i + 1, len(clip_ids)):
            similarity = similarity_matrix[i, j]
            if similarity >= threshold:
                similar_pairs.append((clip_ids[i], clip_ids[j], float(similarity)))

    return similar_pairs


def group_similar_clips(similar_pairs: list[tuple[str, str, float]], clips: list[dict]) -> list[dict]:
    """Group similar clips using union-find algorithm."""
    if not similar_pairs:
        return []

    # Union-Find data structure
    parent = {}

    def find(x):
        if x not in parent:
            parent[x] = x
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    # Union all similar pairs
    for clip1, clip2, _ in similar_pairs:
        union(clip1, clip2)

    # Group by root
    groups = {}
    for clip1, clip2, similarity in similar_pairs:
        root = find(clip1)
        if root not in groups:
            groups[root] = {"clips": set(), "similarities": []}
        groups[root]["clips"].add(clip1)
        groups[root]["clips"].add(clip2)
        groups[root]["similarities"].append((clip1, clip2, similarity))

    # Create clip ID to data mapping
    clip_map = {c["id"]: c for c in clips}

    # Format groups for database
    result = []
    for root, data in groups.items():
        clip_list = list(data["clips"])
        avg_similarity = np.mean([s[2] for s in data["similarities"]])

        # Determine group type based on similarity
        if avg_similarity >= 0.95:
            group_type = "duplicate"
        elif avg_similarity >= 0.85:
            group_type = "multiple_takes"
        else:
            group_type = "same_topic"

        result.append({
            "clip_ids": clip_list,
            "group_type": group_type,
            "avg_similarity": float(avg_similarity),
            "source_id": clip_map.get(clip_list[0], {}).get("source_id"),
        })

    return result


def main():
    source_id = sys.argv[1] if len(sys.argv) > 1 else None
    skip_embeddings = "--skip-embeddings" in sys.argv

    print("Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch clips
    query = supabase.table("clips").select("*")
    if source_id:
        query = query.eq("source_id", source_id)

    result = query.execute()
    clips = result.data

    if not clips:
        print("No clips found")
        return

    print(f"Found {len(clips)} clips to analyze")

    # Analyze each clip for quality
    print("\n=== Analyzing Clip Quality ===")
    quality_results = []
    for clip in clips:
        print(f"  Analyzing: {clip['id'][:8]}... ({clip.get('duration_seconds', 0):.1f}s)")
        quality = analyze_clip(clip)
        quality_results.append(quality)
        print(f"    Speaking: {quality['speaking_quality_score']:.1f}, "
              f"Audio: {quality['audio_quality_score']:.1f}, "
              f"Overall: {quality['overall_quality_score']:.1f}, "
              f"WPM: {quality['words_per_minute']:.0f}")

    # Insert quality scores into database
    print("\n=== Saving Quality Scores ===")
    for quality in quality_results:
        try:
            # Use upsert to handle existing records
            supabase.table("clip_quality").upsert({
                "clip_id": quality["clip_id"],
                "speaking_quality_score": quality["speaking_quality_score"],
                "audio_quality_score": quality["audio_quality_score"],
                "overall_quality_score": quality["overall_quality_score"],
                "hesitation_count": quality["hesitation_count"],
                "filler_word_count": quality["filler_word_count"],
                "words_per_minute": quality["words_per_minute"],
                "quality_metadata": quality["quality_metadata"],
            }).execute()
            print(f"  Saved quality for clip {quality['clip_id'][:8]}...")
        except Exception as e:
            print(f"  Error saving quality for {quality['clip_id'][:8]}: {e}")

    # Generate embeddings and find similar clips
    if not skip_embeddings:
        print("\n=== Generating Embeddings ===")
        embeddings = generate_embeddings(clips)

        if embeddings:
            # Save embeddings to database
            print("\n=== Saving Embeddings ===")
            for clip_id, vector in embeddings.items():
                try:
                    # Format vector for pgvector
                    vector_str = "[" + ",".join(map(str, vector)) + "]"
                    supabase.table("clip_embeddings").upsert({
                        "clip_id": clip_id,
                        "embedding": vector_str,
                        "model_name": "all-MiniLM-L6-v2",
                    }).execute()
                    print(f"  Saved embedding for clip {clip_id[:8]}...")
                except Exception as e:
                    print(f"  Error saving embedding for {clip_id[:8]}: {e}")

            # Find similar clips
            print("\n=== Finding Similar Clips ===")
            similar_pairs = find_similar_clips(embeddings, threshold=0.75)
            print(f"Found {len(similar_pairs)} similar pairs")

            if similar_pairs:
                # Group similar clips
                groups = group_similar_clips(similar_pairs, clips)
                print(f"Created {len(groups)} clip groups")

                # Save groups to database
                print("\n=== Saving Clip Groups ===")
                for group in groups:
                    try:
                        # Create group
                        group_result = supabase.table("clip_groups").insert({
                            "name": f"{group['group_type'].replace('_', ' ').title()} Group",
                            "group_type": group["group_type"],
                            "source_id": group["source_id"],
                            "representative_clip_id": group["clip_ids"][0],
                        }).execute()

                        group_id = group_result.data[0]["id"]
                        print(f"  Created {group['group_type']} group with {len(group['clip_ids'])} clips")

                        # Add members
                        for i, clip_id in enumerate(group["clip_ids"]):
                            supabase.table("clip_group_members").insert({
                                "clip_id": clip_id,
                                "group_id": group_id,
                                "similarity_score": group["avg_similarity"],
                                "is_representative": i == 0,
                            }).execute()
                    except Exception as e:
                        print(f"  Error saving group: {e}")

    print("\n=== Analysis Complete ===")

    # Print summary
    avg_overall = sum(q["overall_quality_score"] for q in quality_results) / len(quality_results)
    high_quality = sum(1 for q in quality_results if q["overall_quality_score"] >= 4.0)
    low_quality = sum(1 for q in quality_results if q["overall_quality_score"] < 3.0)

    print(f"\nSummary:")
    print(f"  Total clips analyzed: {len(quality_results)}")
    print(f"  Average quality score: {avg_overall:.2f}")
    print(f"  High quality (>=4.0): {high_quality}")
    print(f"  Low quality (<3.0): {low_quality}")


if __name__ == "__main__":
    main()
