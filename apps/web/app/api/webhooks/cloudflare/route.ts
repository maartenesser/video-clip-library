import { NextRequest, NextResponse } from 'next/server';
import { cloudflareWebhookSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify the webhook signature
 */
function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.CLOUDFLARE_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (for development)
  if (!secret) {
    console.warn('CLOUDFLARE_WEBHOOK_SECRET not configured, skipping signature verification');
    return true;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/cloudflare
 *
 * Handle job completion webhooks from Cloudflare Workers.
 * Updates processing job status and creates clips if applicable.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature');

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      throw new ApiError(401, 'Invalid webhook signature');
    }

    // Parse and validate the payload
    const body = JSON.parse(rawBody);
    const validated = cloudflareWebhookSchema.parse(body);

    const db = getDatabase();

    // Get the processing job
    const job = await db.getProcessingJobById(validated.job_id);
    if (!job) {
      throw new ApiError(404, 'Processing job not found');
    }

    // Update job status
    if (validated.status === 'completed') {
      await db.completeProcessingJob(validated.job_id);

      // Handle clip creation if clips are provided
      if (validated.result?.clips && validated.result.clips.length > 0) {
        for (const clipData of validated.result.clips) {
          await db.createClip({
            source_id: validated.source_id,
            start_time_seconds: clipData.start_time_seconds,
            end_time_seconds: clipData.end_time_seconds,
            file_key: clipData.file_key,
            file_url: clipData.file_url,
            thumbnail_url: clipData.thumbnail_url,
            transcript_segment: clipData.transcript_segment,
            detection_method: clipData.detection_method,
          });
        }
      }

      // Update source status if all jobs are completed
      await updateSourceStatus(db, validated.source_id);
    } else {
      // Job failed
      await db.failProcessingJob(
        validated.job_id,
        validated.error_message || validated.result?.error || 'Unknown error'
      );

      // Update source status to failed
      await db.updateSource(validated.source_id, {
        status: 'failed',
        error_message: validated.error_message || validated.result?.error,
      });
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Update source status based on job completion
 */
async function updateSourceStatus(
  db: ReturnType<typeof getDatabase>,
  sourceId: string
): Promise<void> {
  const jobs = await db.getProcessingJobsBySourceId(sourceId);

  // Check if all jobs are completed
  const allCompleted = jobs.every(j => j.status === 'completed');
  const anyFailed = jobs.some(j => j.status === 'failed');
  const anyRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');

  if (anyFailed) {
    await db.updateSource(sourceId, { status: 'failed' });
  } else if (allCompleted && !anyRunning) {
    await db.updateSource(sourceId, { status: 'completed' });
  } else if (anyRunning) {
    await db.updateSource(sourceId, { status: 'processing' });
  }
}
