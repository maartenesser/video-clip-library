import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { processingWebhookSchema, type ProcessingWebhookPayload } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import crypto from 'crypto';
import { ZodError } from 'zod';

const WEBHOOK_SECRET = process.env.CLOUDFLARE_WEBHOOK_SECRET;

/**
 * Verify webhook signature from Cloudflare Worker
 */
function verifySignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    // In production, always require a secret
    if (process.env.NODE_ENV === 'production') {
      console.error('CLOUDFLARE_WEBHOOK_SECRET not configured in production');
      return false;
    }
    console.warn('Webhook signature verification skipped - no secret configured (dev mode)');
    return true;
  }

  if (!signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/processing
 *
 * Webhook handler for video processing completion.
 * Called by the Cloudflare Worker when processing is done.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-webhook-signature');

    // Verify the webhook signature
    if (!verifySignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse and validate payload with Zod
    let parsedPayload: ProcessingWebhookPayload;
    try {
      const rawPayload = JSON.parse(payload);
      parsedPayload = processingWebhookSchema.parse(rawPayload);
    } catch (parseError) {
      if (parseError instanceof ZodError) {
        console.error('Webhook payload validation failed:', parseError.errors);
        return NextResponse.json(
          { error: 'Invalid payload', details: parseError.errors },
          { status: 400 }
        );
      }
      if (parseError instanceof SyntaxError) {
        return NextResponse.json(
          { error: 'Invalid JSON payload' },
          { status: 400 }
        );
      }
      throw parseError;
    }

    const { source_id, status, error_message, clips, duration_seconds } = parsedPayload;

    const db = getDatabase();

    if (status === 'failed') {
      // Update source status to failed
      await db.updateSource(source_id, {
        status: 'failed',
        error_message: error_message || 'Unknown processing error',
      });

      // Update processing job to failed
      const jobs = await db.getProcessingJobsBySourceId(source_id);
      for (const job of jobs) {
        if (job.status !== 'completed' && job.status !== 'failed') {
          await db.failProcessingJob(job.id, error_message || 'Unknown processing error');
        }
      }

      return NextResponse.json({ success: true, status: 'failed' });
    }

    // Get all tags for mapping
    const allTags = await db.getTags();
    const tagMap = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));

    // Create clips and their tags
    if (clips && clips.length > 0) {
      for (const clipData of clips) {
        // Create the clip
        const clip = await db.createClip({
          source_id,
          start_time_seconds: clipData.start_time_seconds,
          end_time_seconds: clipData.end_time_seconds,
          file_url: clipData.file_url,
          file_key: clipData.file_key,
          thumbnail_url: clipData.thumbnail_url || null,
          transcript_segment: clipData.transcript_segment || null,
          detection_method: clipData.detection_method,
        });

        // Add tags to the clip
        if (clipData.tags && clipData.tags.length > 0) {
          for (const tagData of clipData.tags) {
            const tagId = tagMap.get(tagData.name.toLowerCase());
            if (tagId) {
              await db.addTagToClip({
                clip_id: clip.id,
                tag_id: tagId,
                confidence_score: tagData.confidence_score || null,
                assigned_by: 'ai',
              });
            } else {
              console.warn(`Unknown tag: ${tagData.name}`);
            }
          }
        }
      }
    }

    // Update source status to completed
    await db.updateSource(source_id, {
      status: 'completed',
      duration_seconds: duration_seconds || null,
    });

    // Complete processing jobs
    const jobs = await db.getProcessingJobsBySourceId(source_id);
    for (const job of jobs) {
      if (job.status !== 'completed' && job.status !== 'failed') {
        await db.completeProcessingJob(job.id);
      }
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      clips_created: clips?.length || 0,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
