# Clip Similarity Detection & Categories

## Overview

After clips are extracted and transcribed, embeddings are generated for similarity detection. Clips are grouped into three categories based on cosine similarity of their transcript embeddings.

## Three Category System

| Category | Threshold | Description | Use Case |
|----------|-----------|-------------|----------|
| **Duplicate** | ≥0.95 | Essentially identical content | Auto-hide duplicates |
| **Multiple Takes** | ≥0.85 | Same scene, different take | Let user pick best |
| **Same Topic** | ≥0.75 | Related content, similar subject | Suggest grouping |

## How It Works

### 1. Extract Transcripts

For each clip, extract the transcript text from the corresponding time range of the Whisper transcription.

```python
def get_transcript_for_clip(segments, start_time, end_time):
    overlapping = [s for s in segments if s.end > start_time and s.start < end_time]
    return " ".join(s.text for s in overlapping)
```

### 2. Generate Embeddings

Use OpenAI `text-embedding-3-small` model with 384 dimensions (reduced from default 1536 for efficiency):

```python
response = openai.embeddings.create(
    model="text-embedding-3-small",
    input=[clip.transcript for clip in clips],
    dimensions=384
)
```

### 3. Calculate Cosine Similarity

Compare all clip pairs using cosine similarity:

```python
def cosine_similarity(a, b):
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    return dot_product / (norm_a * norm_b)
```

### 4. Classify Pairs

```python
def classify_pair(similarity):
    if similarity >= 0.95:
        return "duplicate"
    elif similarity >= 0.85:
        return "multiple_takes"
    elif similarity >= 0.75:
        return "same_topic"
    return None
```

### 5. Group Clips

Use union-find algorithm to create connected components:

```python
# Build adjacency graph from similar pairs
# Find connected components using DFS
# Each component becomes a group
```

### 6. Select Representative

The first clip in chronological order becomes the representative clip for each group.

## Data Structure

### ClipGroup

```typescript
interface ClipGroup {
  group_id: string;           // UUID
  group_type: 'duplicate' | 'multiple_takes' | 'same_topic';
  clip_ids: string[];         // All clips in group
  representative_clip_id: string;  // Main clip to show
  similarity_scores: Record<string, number>;  // Scores between clips
}
```

### Example

```json
{
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "group_type": "duplicate",
  "clip_ids": ["clip_0001", "clip_0005", "clip_0012"],
  "representative_clip_id": "clip_0001",
  "similarity_scores": {
    "clip_0005": 0.97,
    "clip_0012": 0.96
  }
}
```

## Use Cases

### Duplicate Groups

**Scenario:** User re-recorded the same line multiple times in succession.

**UI Treatment:**
- Show only the representative clip in main view
- Display badge: "2 duplicates"
- Expandable to see all versions

**Action:** Auto-select representative, option to delete others

### Multiple Takes Groups

**Scenario:** Same scripted content, slight variations in delivery.

**UI Treatment:**
- Show as "Multiple Takes" group
- Side-by-side comparison view
- Quality scores for each take

**Action:** Let user pick best take, keep others as backup

### Same Topic Groups

**Scenario:** Different clips discussing the same product or concept.

**UI Treatment:**
- Show as "Related Clips" suggestion
- Tag-based grouping view
- Suggested compilation

**Action:** Use for creating themed compilations

## Threshold Tuning

### When to Lower Thresholds

- Videos with similar but distinct content
- Scripted content with minor variations
- Want more aggressive grouping

### When to Raise Thresholds

- Many false positives in grouping
- Different content being grouped together
- Want conservative, high-confidence matches only

### Recommended Starting Points

| Content Type | Duplicate | Multiple Takes | Same Topic |
|--------------|-----------|----------------|------------|
| Scripted | 0.95 | 0.85 | 0.75 |
| Unscripted | 0.97 | 0.90 | 0.80 |
| Mixed | 0.95 | 0.87 | 0.77 |

## Performance Considerations

### Embedding Generation

- Batch by 100 transcripts per API call
- ~$0.02 per million tokens
- 384 dimensions = fast similarity computation

### Pairwise Comparison

- O(n²) comparisons for n clips
- 100 clips = 4,950 comparisons
- Sub-second for most videos

### Memory Usage

- 384 floats × 4 bytes = 1.5KB per clip
- 100 clips = 150KB embeddings
- Negligible memory impact

## Limitations

1. **Transcript-based only** - Non-verbal content not considered
2. **No visual similarity** - Different visuals with same transcript grouped
3. **Language-dependent** - Works best for English content
4. **Minimum transcript length** - Very short clips may not have meaningful transcripts

## Future Enhancements

1. **Visual embeddings** - Add CLIP-based visual similarity
2. **Audio analysis** - Consider tone, pacing, energy level
3. **Hybrid scoring** - Combine text + visual + audio similarity
4. **User feedback loop** - Learn from user grouping decisions
