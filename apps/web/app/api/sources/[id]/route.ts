import { NextRequest, NextResponse } from 'next/server';
import { uuidParamSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';
import { createR2ClientFromEnv } from '@video-clip-library/storage';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/sources/[id]
 *
 * Get a source by ID with its clips and processing jobs.
 * Generates presigned URLs for clip files and thumbnails.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const validatedId = uuidParamSchema.parse(id);

    const db = getDatabase();

    // Get the source
    const source = await db.getSourceById(validatedId);

    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    // Get related clips
    const clips = await db.getClipsBySourceId(validatedId);

    // Get processing jobs
    const jobs = await db.getProcessingJobsBySourceId(validatedId);

    // Get the base URL for the API proxy
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    // Generate proxy URLs for clips (using our media proxy endpoint)
    const clipsWithProxyUrls = clips.map((clip) => {
      let proxyFileUrl = clip.file_url;
      let proxyThumbnailUrl = clip.thumbnail_url;

      // Generate proxy URL for video file
      if (clip.file_key) {
        proxyFileUrl = `${baseUrl}/api/media/${clip.file_key}`;

        // Generate proxy URL for thumbnail - only if not already set
        // Use regex to properly replace only the file extension
        if (!proxyThumbnailUrl || !proxyThumbnailUrl.includes('/api/media/')) {
          const thumbnailKey = clip.file_key.replace(/\.mp4$/i, '_thumb.jpg');
          proxyThumbnailUrl = `${baseUrl}/api/media/${thumbnailKey}`;
        }
      }

      return {
        ...clip,
        file_url: proxyFileUrl,
        thumbnail_url: proxyThumbnailUrl,
      };
    });

    // Generate proxy URL for original source video
    let proxySourceUrl = source.original_file_url;
    if (source.original_file_key) {
      proxySourceUrl = `${baseUrl}/api/media/${source.original_file_key}`;
    }

    return NextResponse.json({
      ...source,
      original_file_url: proxySourceUrl,
      clips: clipsWithProxyUrls,
      processing_jobs: jobs,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/sources/[id]
 *
 * Delete a source and all its clips, including files from R2 storage.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const validatedId = uuidParamSchema.parse(id);

    const db = getDatabase();

    // Check if source exists
    const source = await db.getSourceById(validatedId);
    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    // Get all clips for this source to delete their files
    const clips = await db.getClipsBySourceId(validatedId);

    // Collect all file keys to delete from R2
    const keysToDelete: string[] = [];

    // Add source original file key
    if (source.original_file_key) {
      keysToDelete.push(source.original_file_key);
    }

    // Add clip file keys and thumbnail keys
    for (const clip of clips) {
      if (clip.file_key) {
        keysToDelete.push(clip.file_key);
        // Also delete the thumbnail (convention: same key but _thumb.jpg instead of .mp4)
        const thumbnailKey = clip.file_key.replace('.mp4', '_thumb.jpg');
        keysToDelete.push(thumbnailKey);
      }
    }

    // Delete files from R2 storage
    if (keysToDelete.length > 0) {
      try {
        const r2 = createR2ClientFromEnv();
        const results = await r2.deleteObjects(keysToDelete);

        // Log any failures but don't fail the request
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
          console.warn('Some files could not be deleted from R2:', failures);
        }
      } catch (r2Error) {
        // Log R2 errors but continue with database deletion
        console.error('Error deleting files from R2:', r2Error);
      }
    }

    // Delete the source from database (clips are cascade deleted)
    await db.deleteSource(validatedId);

    return NextResponse.json({
      success: true,
      message: 'Source deleted',
      filesDeleted: keysToDelete.length
    });
  } catch (error) {
    return handleError(error);
  }
}
