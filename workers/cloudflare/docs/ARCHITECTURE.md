# Video Processing Pipeline Architecture

## Overview

This system processes large video files (up to 5GB) using Cloudflare Workers, Containers, and R2 storage with a queue-based streaming architecture designed to handle 500MB+ videos without memory overflow.

## Components

### 1. Cloudflare Worker (`src/worker.ts`)

The Worker is the entry point for all requests:
- Receives upload/process requests from the application
- Validates video exists in R2
- Generates presigned URLs for container access
- Routes jobs to Cloudflare Queue (for large files) or direct processing
- Returns immediately for async processing (status 202)

**Key Endpoints:**
- `POST /process` - Synchronous processing (small files <100MB)
- `POST /process-async` - Queue-based async processing (large files)
- `GET /health` - Health check

### 2. Cloudflare Queue (`video-processing-jobs`)

Decouples job submission from processing:
- Enables retry logic on failures (max 3 retries)
- Removes timeout pressure from Worker
- Supports concurrent processing (max 5 jobs)
- Dead letter queue for failed jobs

### 3. Cloudflare Container (`src/main.py`, `src/streaming_pipeline.py`)

Python-based video processing:
- **Standard Pipeline** (`/process-url`): For smaller files, loads video into memory
- **Streaming Pipeline** (`/process-streaming`): For large files, streams to disk

**Instance Configuration:**
- Type: `standard-4` (4 vCPU, 12 GiB RAM, 20 GB disk)
- Max instances: 5

### 4. R2 Storage

Object storage for videos and clips:
- Source videos: `sources/{source_id}/original.mp4`
- Clips: `clips/{source_id}/{clip_id}.mp4`
- Thumbnails: `clips/{source_id}/{clip_id}_thumb.jpg`

## Data Flow

### Standard Flow (Small Files <100MB)

```
1. App -> POST /process with video key
2. Worker validates video in R2
3. Worker generates presigned URL
4. Worker calls Container /process-url
5. Container downloads video to memory
6. Container processes (scene detect, split, transcribe)
7. Container returns base64-encoded clips
8. Worker uploads clips to R2
9. Worker calls webhook with results
10. Worker returns response
```

### Streaming Flow (Large Files >100MB)

```
1. App -> POST /process-async with video key
2. Worker validates video in R2
3. Worker submits job to Queue (returns immediately)
4. Queue consumer triggers Container
5. Container streams video to disk (100MB buffer)
6. Container processes with streaming pipeline
7. Container uploads clips directly to R2
8. Container calls webhook with R2 keys (no base64)
9. Queue marks job complete
```

## Processing Pipeline

### 12-Step Pipeline

```
Step 1:  Download/stream video
Step 2:  Extract audio for transcription
Step 3:  Transcribe with Whisper (chunked if >25MB)
Step 4:  Detect scenes with PySceneDetect
Step 5:  Create clip definitions
Step 6:  Split video into clips (FFmpeg)
Step 7:  Generate thumbnails
Step 8:  Upload clips to R2
Step 9:  Tag clips with GPT-4o-mini (optional)
Step 10: Generate embeddings for similarity
Step 11: Group similar/duplicate clips
Step 12: Call webhook with results
```

### Scene Detection

Uses PySceneDetect with configurable thresholds:
- **AdaptiveDetector**: Best for talking-head videos
- **ContentDetector**: General purpose (threshold: 27.0)
- `min_scene_length`: Minimum scene duration (default: 1.5s)

### Clip Extraction

FFmpeg-based with two modes:
- **Fast Mode** (default): Stream copy, 10-100x faster, keyframe-aligned
- **Quality Mode**: Re-encoding, frame-accurate cuts

Parameters:
- `min_clip_duration`: Minimum clip length (default: 3s)
- `max_clip_duration`: Maximum clip length (default: 20s)

### Transcription

OpenAI Whisper API:
- Model: `whisper-1`
- Max file size: 25MB
- Chunked transcription for larger files (10-minute segments)
- Word-level and segment-level timestamps

### Similarity Detection

Three categories based on transcript embeddings:

| Category | Threshold | Description |
|----------|-----------|-------------|
| **Duplicate** | ≥0.95 | Essentially identical content |
| **Multiple Takes** | ≥0.85 | Same scene, different take |
| **Same Topic** | ≥0.75 | Related content |

## Memory Management

### Container Memory Budget (12GB)

| Component | Memory Usage |
|-----------|--------------|
| Streaming buffer | 100MB |
| FFmpeg processing | 2-4GB |
| PySceneDetect | 1GB |
| Python runtime | 500MB |
| **Total** | ~6GB (50% headroom) |

### Why Streaming Matters

Without streaming (old architecture):
- 500MB video download: 500MB in RAM
- Base64 encoding: +667MB
- JSON response: 1.2GB total → **OOM crash**

With streaming (new architecture):
- Streaming buffer: 100MB max
- No base64 encoding (direct R2 upload)
- Metadata-only response: <10KB

## File Upload Limits

| Constraint | Limit |
|------------|-------|
| Container disk | ~11GB usable |
| R2 single object | 5GB (without multipart) |
| R2 multipart | 5TB (with multipart) |
| **Recommended max** | **5GB** |

## Error Handling

### Retry Logic

- Queue retries: 3 attempts with exponential backoff
- R2 operations: 3 retries with exponential backoff
- Webhook calls: 3 retries with exponential backoff

### Dead Letter Queue

Failed jobs after 3 retries are sent to `video-processing-dlq` for investigation.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for Whisper |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `WEBHOOK_SECRET` | No | HMAC secret for webhooks |
| `SUPABASE_URL` | No | Supabase URL |
| `SUPABASE_SERVICE_KEY` | No | Supabase service key |
