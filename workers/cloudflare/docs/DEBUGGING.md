# Debugging Guide

## Common Issues

### 1. "Memory limit exceeded" / OOM Errors

**Symptoms:**
- Container crashes during processing
- Error: "memory allocation failed"
- Processing fails for videos >200MB

**Cause:** Video loaded into memory instead of streamed

**Fix:**
1. Use `/process-async` endpoint instead of `/process` for large files
2. Verify streaming pipeline is being used:
   ```bash
   # Check logs for "use_streaming: true"
   npx wrangler tail video-processing-pipeline --format=pretty
   ```
3. If using `/process` directly, ensure file size <100MB

### 2. "Download timeout"

**Symptoms:**
- Error: "httpx.TimeoutException"
- Processing fails before scene detection

**Cause:** Large file + slow connection + insufficient timeout

**Fix:**
1. Increase timeout in `stream_download_to_disk()` (default: 30 min)
2. Check network connectivity:
   ```bash
   curl -X GET "https://your-worker.workers.dev/debug/network-test"
   ```
3. Verify presigned URL is valid (not expired)

### 3. "Whisper API error: file too large"

**Symptoms:**
- Error: "Maximum content size exceeded"
- Transcription fails for long videos

**Cause:** Audio >25MB sent without chunking

**Fix:**
1. Ensure `transcribe_video_chunked()` is being used
2. Check audio file size in logs:
   ```
   Audio file exceeds 25MB limit, using chunked transcription
   ```
3. If still failing, check FFmpeg audio extraction:
   ```bash
   # Manually test audio extraction
   ffmpeg -i video.mp4 -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k audio.mp3
   ls -la audio.mp3  # Should be <25MB for 20 min video
   ```

### 4. "Container not ready"

**Symptoms:**
- Error: "Container failed to become ready"
- 503 Service Unavailable

**Cause:** Cold start taking too long

**Fix:**
1. Check Container logs for startup errors
2. Verify Python dependencies installed:
   ```bash
   # In Dockerfile
   RUN pip install -r requirements-cf.txt
   ```
3. Increase readiness check timeout in `worker.ts`:
   ```typescript
   const maxChecks = 30;  // Increase from 20
   ```

### 5. "Presigned URL expired"

**Symptoms:**
- Error: "AccessDenied" or "RequestTimeTooSkewed"
- Download fails after queue delay

**Cause:** Presigned URL expired before processing started

**Fix:**
1. Increase URL expiry for large files (default 2 hours):
   ```typescript
   const expiresIn = useStreaming ? 7200 : 3600;
   ```
2. Check queue backlog - processing may be delayed

### 6. "R2 upload failed"

**Symptoms:**
- Clips processed but not appearing in R2
- Webhook shows empty clips array

**Cause:** R2 credentials or permissions issue

**Fix:**
1. Verify R2 credentials:
   ```bash
   curl -X GET "https://your-worker.workers.dev/debug/r2-test"
   ```
2. Check bucket permissions in Cloudflare dashboard
3. Verify multipart upload completion for large files

### 7. "No clips created"

**Symptoms:**
- Processing completes but `total_clips: 0`
- Single clip for entire video

**Cause:** Scene detection thresholds too high or video has no cuts

**Fix:**
1. Adjust scene detection sensitivity:
   ```python
   min_scene_length = 0.5  # Lower = more sensitive
   ```
2. Use ContentDetector with lower threshold:
   ```python
   threshold = 20.0  # Lower = more scenes detected
   ```
3. Check if video is a single continuous shot

## Monitoring Commands

### Worker Logs

```bash
# Real-time logs
npx wrangler tail video-processing-pipeline --format=pretty

# Filter by status
npx wrangler tail video-processing-pipeline --format=pretty | grep "error"
```

### Queue Status

```bash
# List queues
npx wrangler queues list

# Get queue details
npx wrangler queues describe video-processing-jobs
```

### R2 Operations

```bash
# List files
npx wrangler r2 object list video-clips --prefix=clips/

# Get file info
npx wrangler r2 object head video-clips sources/test.mp4
```

## Debug Endpoints

### Health Check
```bash
curl https://your-worker.workers.dev/health
```

### Environment Variables
```bash
curl https://your-worker.workers.dev/debug/env
```

### R2 Connectivity
```bash
curl https://your-worker.workers.dev/debug/r2-test
```

### Network Test
```bash
curl https://your-worker.workers.dev/debug/network-test
```

### Video Processing Test
```bash
curl -X POST https://your-worker.workers.dev/debug/process-video-test \
  --data-binary @test-video.mp4 \
  -H "Content-Type: video/mp4"
```

## Log Analysis

### Key Log Messages

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `Starting streaming download` | Download initiated | Normal |
| `Download progress` | Every 50MB downloaded | Normal |
| `Audio file exceeds 25MB limit` | Chunking activated | Normal |
| `Scenes detected` | Scene detection complete | Check count |
| `No clips created` | Issue with clip creation | Check thresholds |
| `Multipart upload completed` | Large file upload done | Normal |
| `Webhook called successfully` | Results delivered | Normal |
| `Container request failed` | Container error | Check container logs |

### Structured Log Fields

```json
{
  "event": "Streaming pipeline completed",
  "job_id": "uuid",
  "source_id": "source-123",
  "total_clips": 15,
  "processing_time": 125.5
}
```

## Performance Profiling

### Processing Time Breakdown

| Stage | Expected Time (500MB video) |
|-------|----------------------------|
| Download | 30-60s |
| Audio extraction | 30-60s |
| Transcription | 60-120s |
| Scene detection | 30-60s |
| Clip splitting | 60-180s |
| R2 upload | 30-60s |
| **Total** | **4-9 minutes** |

### Bottleneck Identification

1. **Slow download:** Check network, increase timeout
2. **Slow transcription:** Expected for long videos
3. **Slow clip splitting:** Use fast mode (stream copy)
4. **Slow upload:** Reduce clip count, increase parallelism

## Emergency Procedures

### Clear Stuck Queue

```bash
# Purge all messages (DESTRUCTIVE)
npx wrangler queues purge video-processing-jobs
```

### Force Container Restart

Deploy a trivial change to force new container:
```bash
npx wrangler deploy
```

### Rollback Deployment

```bash
npx wrangler rollback
```

## Key Files for Debugging

| File | Purpose |
|------|---------|
| `worker.ts` | Request handling, queue producer |
| `main.py` | FastAPI endpoints |
| `streaming_pipeline.py` | Large file processing |
| `local_pipeline.py` | Small file fallback |
| `scene_detect.py` | PySceneDetect wrapper |
| `split_video.py` | FFmpeg clip extraction |
| `transcribe.py` | Whisper transcription |
| `r2_client.py` | R2 storage operations |
