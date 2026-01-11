import { NextRequest, NextResponse } from 'next/server';
import { createSourceSchema, listSourcesQuerySchema } from '@/lib/schemas';
import { handleError, getQueryParams, searchParamsToObject } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

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

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
