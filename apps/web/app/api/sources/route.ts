import { NextRequest, NextResponse } from 'next/server';
import { createSourceSchema, listSourcesQuerySchema } from '@/lib/schemas';
import { handleError, getQueryParams, searchParamsToObject } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

const WORKER_URL = process.env.VIDEO_PROCESSING_WORKER_URL;
const WEBHOOK_SECRET = process.env.CLOUDFLARE_WEBHOOK_SECRET;

// Helper to add proxy URLs for thumbnails
function addThumbnailUrls(sources: any[]) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return sources.map((source) => {
    let thumbnailUrl = source.thumbnail_url || null;

    // If thumbnail_url is stored in the database, use it via proxy
    if (source.thumbnail_key) {
      thumbnailUrl = `${baseUrl}/api/media/${source.thumbnail_key}`;
    } else if (source.original_file_key) {
      // Fallback: construct thumbnail URL from the source file key
      // This assumes source thumbnail was generated during processing
      const thumbKey = source.original_file_key.replace(/\.[^.]+$/, '_thumb.jpg');
      thumbnailUrl = `${baseUrl}/api/media/${thumbKey}`;
    }

    return {
      ...source,
      thumbnail_url: thumbnailUrl,
    };
  });
}

/**
 * GET /api/sources
 *
 * List sources with pagination and optional filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const params = searchParamsToObject(getQueryParams(request));
    const validated = listSourcesQuerySchema.parse(params);

    const db = getDatabase();

    const result = await db.getSources(
      {
        status: validated.status as 'pending' | 'processing' | 'completed' | 'failed' | undefined,
        source_type: validated.source_type as 'youtube' | 'upload' | 'tiktok' | 'instagram' | 'other' | undefined,
        search: validated.search,
      },
      {
        page: validated.page,
        limit: validated.limit,
        orderBy: validated.orderBy,
        orderDirection: validated.orderDirection,
      }
    );

    // Add thumbnail URLs to sources
    result.data = addThumbnailUrls(result.data);

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/sources
 *
 * Create a new source video.
 * This is called after the video has been uploaded to R2 storage.
 * Triggers the Cloudflare Worker to process the video.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createSourceSchema.parse(body);

    const db = getDatabase();

    // Create the source with initial 'pending' status
    const source = await db.createSource({
      ...validated,
      status: 'pending',
    });

    // Create initial processing job for transcription
    await db.createProcessingJob({
      source_id: source.id,
      job_type: 'transcription',
      status: 'pending',
      progress_percent: 0,
    });

    // Trigger the Cloudflare Worker to process the video
    if (WORKER_URL) {
      try {
        // Get the base URL for the webhook callback
        const baseUrl = request.headers.get('host');
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
        const webhookUrl = `${protocol}://${baseUrl}/api/webhooks/processing`;

        // Extract R2 key from the stored value
        // Handle case where original_file_key might contain a full URL (bug workaround)
        let videoKey = source.original_file_key;
        if (videoKey.startsWith('http://') || videoKey.startsWith('https://')) {
          // Extract the path after the domain
          try {
            const url = new URL(videoKey);
            videoKey = url.pathname.replace(/^\//, ''); // Remove leading slash
          } catch {
            // If URL parsing fails, try to extract path after common patterns
            videoKey = videoKey.replace(/^https?:\/\/[^\/]+\//, '');
          }
          console.warn(`Extracted R2 key from URL: ${source.original_file_key} -> ${videoKey}`);
        }

        const workerResponse = await fetch(`${WORKER_URL}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_id: source.id,
            // Use extracted R2 key
            video_url: videoKey,
            webhook_url: webhookUrl,
            min_clip_duration: 3,
            max_clip_duration: 20,
            min_scene_length: 2,
          }),
        });

        if (!workerResponse.ok) {
          console.error('Failed to trigger video processing:', await workerResponse.text());
          // Update status to failed if worker trigger fails
          await db.updateSource(source.id, { status: 'failed', error_message: 'Failed to start video processing' });
        } else {
          // Update status to processing
          await db.updateSource(source.id, { status: 'processing' });
        }
      } catch (workerError) {
        console.error('Error triggering video processing worker:', workerError);
        // Don't fail the request - the source is created, just not processed
        // User can retry processing later
      }
    } else {
      console.warn('VIDEO_PROCESSING_WORKER_URL not configured - video will remain in pending status');
    }

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
