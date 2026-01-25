# Video Processing API

## Endpoints

### Process Video (Synchronous)

**`POST /process`**

Process a video synchronously. Best for smaller files (<100MB).

#### Request

```json
{
  "source_id": "unique-source-id",
  "video_url": "sources/my-video.mp4",
  "webhook_url": "https://your-app.com/api/webhooks/video-processing",
  "min_clip_duration": 3.0,
  "max_clip_duration": 20.0,
  "min_scene_length": 1.5
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `source_id` | string | Yes | - | Unique identifier for the source video |
| `video_url` | string | Yes | - | R2 key of the video to process |
| `webhook_url` | string | Yes | - | URL to call when processing completes |
| `min_clip_duration` | number | No | 3.0 | Minimum clip duration in seconds |
| `max_clip_duration` | number | No | 20.0 | Maximum clip duration in seconds |
| `min_scene_length` | number | No | 1.5 | Minimum scene length for detection |

#### Response

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_id": "unique-source-id",
  "status": "completed",
  "message": "Video processing completed",
  "total_clips": 15
}
```

---

### Process Video (Asynchronous - Queue-based)

**`POST /process-async`**

Process a video asynchronously via Cloudflare Queue. Best for larger files (>100MB).

Returns immediately with status "queued". Results delivered via webhook.

#### Request

Same as `/process`

#### Response

```json
{
  "status": "queued",
  "source_id": "unique-source-id",
  "message": "Video processing job queued. Using streaming pipeline.",
  "file_size_mb": 512,
  "use_streaming": true
}
```

---

### Process Video Streaming (Container Direct)

**`POST /process-streaming`**

Direct streaming endpoint for large videos. Called by queue consumer.

#### Request

```json
{
  "video_url": "https://presigned-url...",
  "source_id": "unique-source-id",
  "webhook_url": "https://your-app.com/api/webhooks/video-processing",
  "min_clip_duration": 3.0,
  "max_clip_duration": 20.0,
  "min_scene_length": 1.5,
  "webhook_secret": "optional-hmac-secret"
}
```

#### Response

```json
{
  "status": "completed",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "source_id": "unique-source-id",
  "total_clips": 15,
  "duration_seconds": 125.5,
  "processing_time_seconds": 245.3,
  "clips": [
    {
      "clip_id": "source_clip_0001",
      "start_time": 0.0,
      "end_time": 15.2,
      "video_key": "clips/source/source_clip_0001.mp4",
      "thumbnail_key": "clips/source/source_clip_0001_thumb.jpg",
      "transcript": "Hello and welcome..."
    }
  ]
}
```

---

### Health Check

**`GET /health`**

Check service health.

#### Response

```json
{
  "status": "healthy",
  "version": "0.2.4",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

---

### Readiness Check

**`GET /ready`**

Check if container is ready to process requests.

#### Response

```json
{
  "status": "ready"
}
```

---

### List Jobs

**`GET /jobs`**

List processing jobs.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (pending, completed, failed) |
| `limit` | number | Maximum results (default: 50) |

#### Response

```json
{
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "source_id": "unique-source-id",
      "status": "completed",
      "started_at": "2024-01-15T12:00:00Z",
      "completed_at": "2024-01-15T12:05:00Z"
    }
  ],
  "total": 1
}
```

---

### Get Job Status

**`GET /jobs/{job_id}`**

Get status of a specific job.

#### Response

```json
{
  "source_id": "unique-source-id",
  "status": "completed",
  "started_at": "2024-01-15T12:00:00Z",
  "completed_at": "2024-01-15T12:05:00Z"
}
```

---

## Webhook Payload

When processing completes, a POST request is sent to the webhook URL.

### Success Payload

```json
{
  "source_id": "unique-source-id",
  "status": "completed",
  "clips": [
    {
      "start_time_seconds": 0.0,
      "end_time_seconds": 15.2,
      "file_url": "https://your-app.com/api/media/clips/source/clip_0001.mp4",
      "file_key": "clips/source/clip_0001.mp4",
      "thumbnail_url": "https://your-app.com/api/media/clips/source/clip_0001_thumb.jpg",
      "transcript_segment": "Hello and welcome to this video...",
      "detection_method": "hybrid",
      "tags": [
        {
          "name": "hook",
          "confidence_score": 0.92
        }
      ]
    }
  ],
  "duration_seconds": 125.5,
  "source_thumbnail_url": "https://...",
  "embeddings": [
    {
      "clip_id": "clip_0001",
      "embedding": [0.123, -0.456, ...]
    }
  ],
  "groups": [
    {
      "group_id": "uuid",
      "group_type": "duplicate",
      "clip_ids": ["clip_0001", "clip_0005"],
      "representative_clip_id": "clip_0001",
      "similarity_scores": {"clip_0005": 0.97}
    }
  ]
}
```

### Streaming Pipeline Payload

The streaming pipeline sends a simplified payload with R2 keys instead of URLs:

```json
{
  "source_id": "unique-source-id",
  "status": "completed",
  "job_id": "uuid",
  "duration_seconds": 125.5,
  "processing_time_seconds": 245.3,
  "clips": [
    {
      "clip_id": "source_clip_0001",
      "start_time_seconds": 0.0,
      "end_time_seconds": 15.2,
      "file_key": "clips/source/source_clip_0001.mp4",
      "thumbnail_key": "clips/source/source_clip_0001_thumb.jpg",
      "transcript_segment": "Hello and welcome..."
    }
  ]
}
```

### Error Payload

```json
{
  "source_id": "unique-source-id",
  "status": "failed",
  "error_message": "Container processing failed: OOM error"
}
```

### Webhook Signature

If `WEBHOOK_SECRET` is configured, webhooks include an HMAC-SHA256 signature:

```
x-webhook-signature: 5d41402abc4b2a76b9719d911017c592
```

Verify in your application:
```python
import hmac
import hashlib

def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 202 | Accepted (queued for processing) |
| 400 | Bad request (invalid parameters) |
| 404 | Video not found in R2 |
| 500 | Internal server error |
| 502 | Bad gateway (container error) |
| 503 | Service unavailable (container not ready) |
| 504 | Gateway timeout (processing timeout) |

## Rate Limits

- Container max instances: 5
- Queue max concurrency: 5
- Recommended: 1 request per source at a time

## Best Practices

1. **Use `/process-async`** for videos >100MB
2. **Implement webhook handler** for async processing
3. **Verify webhook signatures** in production
4. **Store R2 keys** instead of full URLs for flexibility
5. **Handle retries** - webhooks may be called multiple times
