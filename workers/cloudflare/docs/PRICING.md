# Video Processing Costs

## Per-Video Cost Breakdown

### Example: 500MB Video (~20 minutes)

| Service | Calculation | Cost |
|---------|-------------|------|
| **Cloudflare Container** | | |
| - CPU | 4 vCPU × 20 min × 60s × $0.00002/vCPU-s | $0.096 |
| - Memory | Included in Workers Standard plan | $0.00 |
| **R2 Storage** | 700MB × $0.015/GB/month | $0.01/month |
| **R2 Egress** | FREE (Cloudflare advantage) | $0.00 |
| **OpenAI Whisper** | 20 min × $0.006/min | $0.12 |
| **OpenAI Embeddings** | ~5000 tokens × $0.02/M tokens | $0.0001 |
| **TOTAL** | | **~$0.22-0.25** |

## Cost by Video Size

| Video Size | Duration (approx) | Processing Time | Total Cost |
|------------|-------------------|-----------------|------------|
| 100MB | 5 min | 5 min | ~$0.08 |
| 500MB | 20 min | 20 min | ~$0.25 |
| 1GB | 40 min | 40 min | ~$0.50 |
| 2GB | 80 min | 60 min | ~$0.90 |
| 5GB | 200 min | 120 min | ~$2.00 |

## Monthly Estimates

| Usage Level | Videos/Month | Avg Size | Est. Cost |
|-------------|--------------|----------|-----------|
| Light | 10 | 500MB | ~$2.50 |
| Medium | 50 | 500MB | ~$12.50 |
| Heavy | 200 | 500MB | ~$50.00 |
| Enterprise | 1000 | 1GB | ~$500.00 |

## Workers Standard Plan ($5/month)

Includes:
- 25 GB-hours of RAM
- 375 vCPU minutes
- 200 GB-hours of disk
- 1 million Queue messages
- 10 million Worker requests

**Note:** For light usage (~10 videos/month), the $5/month plan covers most container usage.

## OpenAI API Costs

### Whisper (Transcription)

- **Rate:** $0.006 per minute
- **Billing:** Per audio minute transcribed

| Video Duration | Audio Cost |
|----------------|------------|
| 5 min | $0.03 |
| 20 min | $0.12 |
| 60 min | $0.36 |
| 120 min | $0.72 |

### Embeddings (Similarity Detection)

- **Model:** text-embedding-3-small
- **Rate:** $0.02 per million tokens
- **Dimensions:** 384 (reduced from 1536)

| Clips | Tokens (est.) | Cost |
|-------|---------------|------|
| 10 | ~2,000 | $0.00004 |
| 50 | ~10,000 | $0.0002 |
| 100 | ~20,000 | $0.0004 |

### GPT-4o-mini (Tagging - Optional)

- **Rate:** $0.15 per million input tokens, $0.60 per million output tokens
- **Usage:** ~500 tokens per clip

| Clips | Cost |
|-------|------|
| 10 | ~$0.01 |
| 50 | ~$0.05 |
| 100 | ~$0.10 |

## R2 Storage Costs

### Storage

- **Rate:** $0.015 per GB per month
- **Free tier:** 10 GB

| Storage | Monthly Cost |
|---------|--------------|
| 10 GB | FREE |
| 50 GB | $0.60 |
| 100 GB | $1.35 |
| 500 GB | $7.35 |

### Operations

| Operation | Rate | Free Tier |
|-----------|------|-----------|
| Class A (write) | $4.50 per million | 1M/month |
| Class B (read) | $0.36 per million | 10M/month |

### Egress

- **Cloudflare R2 Egress:** FREE (major advantage over AWS S3)
- **AWS S3 Egress:** $0.09 per GB

## Cost Comparison: Cloudflare vs AWS

| Component | Cloudflare | AWS (S3 + Lambda) |
|-----------|------------|-------------------|
| Storage (1GB) | $0.015/month | $0.023/month |
| Egress (10GB) | **FREE** | $0.90 |
| Compute (20 min) | ~$0.10 | ~$0.15 |
| **Per video (500MB)** | **~$0.25** | ~$1.05+ |

**Key Savings:** Cloudflare's free egress saves ~$0.09 per GB downloaded.

## Cost Optimization Tips

1. **Use streaming pipeline** for large files to avoid re-processing on OOM failures
2. **Batch processing** during off-peak hours (if applicable)
3. **Disable optional features** like tagging if not needed
4. **Use chunked transcription** to avoid Whisper failures
5. **Set appropriate clip duration limits** to reduce clip count

## Billing Notes

- Cloudflare bills monthly in arrears
- OpenAI charges per API call
- R2 storage is billed based on peak usage
- Container compute is billed by duration
