import { NextRequest, NextResponse } from 'next/server';
import { createAssemblySchema } from '@/lib/schemas';
import { handleError, ApiError, getQueryParams } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

/**
 * POST /api/assemble
 *
 * Create a new video assembly job.
 * Accepts clip IDs, title, and optional subtitle settings.
 * Returns the job ID for status tracking.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createAssemblySchema.parse(body);

    const db = getDatabase();

    // Verify all clips exist and get their data
    const clips = await Promise.all(
      validated.clip_ids.map(async (clipId) => {
        const clip = await db.getClipById(clipId);
        if (!clip) {
          throw new ApiError(404, `Clip not found: ${clipId}`);
        }
        return clip;
      })
    );

    // Create the assembly job record
    const assembly = await db.createAssembledVideo({
      title: validated.title,
      clip_ids: validated.clip_ids,
      subtitle_style: validated.subtitle_style || null,
      status: 'pending',
    });

    // In a production environment, this would trigger a background job
    // For now, we'll process synchronously or queue to the worker
    const workerUrl = process.env.WORKER_URL;

    if (workerUrl) {
      // Queue the assembly job to the worker
      try {
        const workerPayload = {
          assembly_id: assembly.id,
          clips: clips.map((clip, index) => ({
            clip_id: clip.id,
            file_key: clip.file_key,
            transcript: clip.transcript_segment || '',
            start_time: clip.start_time_seconds || 0,
            end_time: clip.end_time_seconds || 0,
            duration: clip.duration_seconds || 0,
            order: index,
          })),
          title: validated.title,
          include_subtitles: validated.include_subtitles,
          subtitle_style: validated.subtitle_style,
        };

        // Fire and forget - worker will update status via webhook
        fetch(`${workerUrl}/assemble`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workerPayload),
        }).catch((err) => {
          console.error('Failed to queue assembly job:', err);
        });

        // Update status to processing
        await db.updateAssembledVideo(assembly.id, { status: 'processing' });
      } catch (err) {
        console.error('Failed to queue assembly job:', err);
        // Assembly remains in pending state for retry
      }
    }

    return NextResponse.json({
      id: assembly.id,
      title: assembly.title,
      status: assembly.status,
      clip_count: validated.clip_ids.length,
      created_at: assembly.created_at,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/assemble
 *
 * List all assembly jobs, optionally filtered by status.
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request);
    const status = params.get('status') as 'pending' | 'processing' | 'completed' | 'failed' | null;
    const page = parseInt(params.get('page') || '1', 10);
    const limit = parseInt(params.get('limit') || '20', 10);

    const db = getDatabase();
    const result = await db.getAssembledVideos(
      status ? { status } : undefined,
      { page, limit }
    );

    // Add proxy URLs for completed assemblies
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const assembliesWithUrls = result.data.map((assembly) => {
      let fileUrl = assembly.file_url;
      if (assembly.file_key && assembly.status === 'completed') {
        fileUrl = `${baseUrl}/api/media/${assembly.file_key}`;
      }
      return {
        ...assembly,
        file_url: fileUrl,
      };
    });

    return NextResponse.json({
      data: assembliesWithUrls,
      count: result.count,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    return handleError(error);
  }
}
