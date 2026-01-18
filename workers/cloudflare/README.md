# Video Processing Pipeline - Cloudflare Container

A Python-based video processing pipeline that runs on Cloudflare Containers. This service processes source videos into tagged, searchable clips using AI-powered transcription and content classification.

## Features

- **Transcription**: OpenAI Whisper API with word-level timestamps
- **Scene Detection**: PySceneDetect with adaptive detection for talking-head videos
- **Video Splitting**: FFmpeg-based clip extraction with thumbnail generation
- **AI Tagging**: GPT-4o-mini classification for content types (hook, product_benefit, proof, testimonial, objection_handling, cta, b_roll, etc.)
- **Duplicate Detection**: OpenAI embeddings-based similarity detection for finding duplicates, multiple takes, and related content
- **R2 Storage**: Cloudflare R2 integration for reading source videos and storing processed clips
- **Webhook Notifications**: Callback on job completion with full results

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI HTTP Server                       │
│                     (Port 8080)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /process                                               │
│    │                                                         │
│    ▼                                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Video Processing Pipeline               │    │
│  │                                                      │    │
│  │  1. Download from R2                                 │    │
│  │  2. Transcribe (Whisper API)                        │    │
│  │  3. Detect Scenes (PySceneDetect)                   │    │
│  │  4. Create Clip Definitions                          │    │
│  │  5. Split Video (FFmpeg)                            │    │
│  │  6. Tag Clips (GPT-4o-mini)                         │    │
│  │  7. Generate Embeddings (OpenAI text-embedding)     │    │
│  │  8. Detect Duplicates & Group Similar Clips         │    │
│  │  9. Upload to R2                                     │    │
│  │  10. Call Webhook                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- FFmpeg installed
- OpenAI API key
- Cloudflare R2 credentials

### Local Development

1. Create and activate virtual environment:
```bash
cd workers/cloudflare
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
```

2. Install dependencies:
```bash
pip install -r requirements-dev.txt
```

3. Set environment variables:
```bash
export OPENAI_API_KEY="your-api-key"
export R2_ACCESS_KEY_ID="your-access-key"
export R2_SECRET_ACCESS_KEY="your-secret-key"
export R2_ENDPOINT_URL="https://your-account.r2.cloudflarestorage.com"
export R2_BUCKET_NAME="video-clips"
```

4. Run the server:
```bash
uvicorn src.main:app --reload --port 8080
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_transcribe.py

# Run only unit tests (skip slow tests)
pytest -m "not slow"
```

### Docker

```bash
# Build the image
docker build -t video-pipeline .

# Run the container
docker run -p 8080:8080 \
  -e OPENAI_API_KEY="your-key" \
  -e R2_ACCESS_KEY_ID="your-key" \
  -e R2_SECRET_ACCESS_KEY="your-secret" \
  -e R2_ENDPOINT_URL="https://your-account.r2.cloudflarestorage.com" \
  video-pipeline
```

## API Endpoints

### Health Check
```http
GET /health
```

Returns service health status.

### Readiness Check
```http
GET /ready
```

Checks if required environment variables are configured.

### Process Video
```http
POST /process
Content-Type: application/json

{
  "source_id": "unique-video-id",
  "video_url": "videos/source.mp4",
  "webhook_url": "https://your-app.com/webhook",
  "min_clip_duration": 3.0,
  "max_clip_duration": 20.0,
  "min_scene_length": 1.5
}
```

Starts async video processing. Returns immediately with job ID.

### Get Job Status
```http
GET /jobs/{job_id}
```

Returns current status of a processing job.

### List Jobs
```http
GET /jobs?status=completed&limit=50
```

Lists processing jobs with optional status filter.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for Whisper and GPT | Yes |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | Yes |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | Yes |
| `R2_ENDPOINT_URL` | R2 endpoint URL | Yes |
| `R2_BUCKET_NAME` | Default bucket name | No (default: video-clips) |
| `PORT` | Server port | No (default: 8080) |
| `ENVIRONMENT` | Environment (development/production) | No |

### Cloudflare Wrangler

Deploy to Cloudflare Containers:

```bash
# Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ENDPOINT_URL

# Deploy
wrangler deploy
```

## Content Tags

The tagger classifies clips into the following content types:

| Tag | Description |
|-----|-------------|
| `hook` | Attention-grabbing opening statements |
| `product_benefit` | Features and advantages of product/service |
| `proof` | Evidence, statistics, demonstrations |
| `testimonial` | Customer stories and endorsements |
| `objection_handling` | Addresses concerns and doubts |
| `cta` | Call-to-action requests |
| `b_roll` | Supplementary footage without speech |
| `intro` | Speaker/brand introduction |
| `outro` | Closing statements |
| `transition` | Connecting segments |

## Duplicate Detection

The pipeline includes intelligent duplicate detection using OpenAI's `text-embedding-3-small` model to identify similar clips based on their transcript content.

### Similarity Thresholds

| Group Type | Threshold | Description |
|------------|-----------|-------------|
| `duplicate` | ≥ 0.95 | Nearly identical content (same words) |
| `multiple_takes` | ≥ 0.85 + time proximity | Same content recorded multiple times (within 2 min) |
| `same_topic` | ≥ 0.75 | Related content discussing similar topics |

### How It Works

1. **Embedding Generation**: Each clip's transcript is converted to a 1536-dimensional vector using OpenAI's embedding API
2. **Pairwise Comparison**: All clip pairs are compared using cosine similarity
3. **Group Classification**: Similar pairs are classified based on similarity score and temporal proximity
4. **Connected Components**: Clips are grouped using union-find algorithm to create clip groups

### Output

The webhook payload includes clip groups:

```json
{
  "clip_groups": [
    {
      "group_id": "uuid",
      "group_type": "duplicate",
      "clip_ids": ["clip_001", "clip_005"],
      "representative_clip_id": "clip_001",
      "similarity_scores": {
        "clip_005": 0.97
      }
    }
  ]
}
```

## Project Structure

```
workers/cloudflare/
├── Dockerfile
├── wrangler.toml
├── requirements.txt          # Full dependencies (local dev)
├── requirements-cf.txt       # Optimized for Cloudflare (no PyTorch)
├── requirements-dev.txt
├── pytest.ini
├── README.md
├── src/
│   ├── __init__.py
│   ├── main.py               # FastAPI application
│   ├── models.py             # Pydantic models
│   ├── pipeline.py           # Pipeline orchestrator
│   ├── transcribe.py         # Whisper transcription
│   ├── scene_detect.py       # PySceneDetect integration
│   ├── split_video.py        # FFmpeg video splitting
│   ├── tagger.py             # GPT-4o-mini tagging
│   ├── duplicate_detect.py   # OpenAI embeddings duplicate detection
│   ├── error_detect.py       # Error detection in clips
│   ├── quality_rate.py       # Quality rating for clips
│   └── r2_client.py          # R2 storage client
└── tests/
    ├── __init__.py
    ├── conftest.py           # Test fixtures
    ├── test_transcribe.py
    ├── test_scene_detect.py
    ├── test_split_video.py
    ├── test_tagger.py
    ├── test_pipeline.py
    └── mocks/
        ├── __init__.py
        └── mock_openai.py
```

## Cloudflare Deployment

The Dockerfile uses `requirements-cf.txt` which excludes heavy dependencies like `sentence-transformers` (PyTorch) to keep the container image under the 4GB limit. Duplicate detection uses OpenAI's embedding API instead of local inference.

### Image Size Optimization

| Dependency | Size Impact | Solution |
|------------|-------------|----------|
| `sentence-transformers` | ~2GB (includes PyTorch) | Use OpenAI embeddings API |
| `numpy` | ~50MB | Pure Python cosine similarity |
| `supabase` | ~30MB | Only needed for local runner |

## Webhook Payload

On completion (success or failure), the webhook receives:

```json
{
  "job_id": "uuid",
  "source_id": "video-id",
  "status": "completed",
  "result": {
    "job_id": "uuid",
    "source_id": "video-id",
    "status": "completed",
    "total_duration": 120.5,
    "total_clips": 8,
    "clips": [
      {
        "clip_id": "video-id_clip_0001",
        "source_id": "video-id",
        "start_time": 0.0,
        "end_time": 15.2,
        "duration": 15.2,
        "transcript": "...",
        "video_url": "https://r2.../clip.mp4",
        "thumbnail_url": "https://r2.../thumb.jpg",
        "primary_tag": "hook",
        "tags": [
          {"tag": "hook", "confidence": 0.92}
        ],
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "transcript": {
      "full_text": "...",
      "language": "en",
      "duration": 120.5,
      "segments": [...],
      "words": [...]
    },
    "processing_time_seconds": 45.2
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Error Handling

The pipeline includes:

- Retry logic for API calls (3 attempts with exponential backoff)
- Graceful error handling with webhook notifications
- Detailed logging with structlog
- Input validation with Pydantic

## Performance Considerations

- Videos are processed in a temporary directory and cleaned up after
- Clips are extracted concurrently (configurable concurrency limit)
- API calls use connection pooling
- Large files are handled with streaming where possible

## License

Proprietary - All rights reserved.
