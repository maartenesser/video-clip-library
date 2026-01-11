import { NextRequest, NextResponse } from 'next/server';
import { uuidParamSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/sources/[id]
 *
 * Get a source by ID with its clips and processing jobs.
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

    return NextResponse.json({
      ...source,
      clips,
      processing_jobs: jobs,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/sources/[id]
 *
 * Delete a source and all its clips.
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

    // Delete the source (clips should be cascade deleted by the database)
    await db.deleteSource(validatedId);

    return NextResponse.json({ success: true, message: 'Source deleted' });
  } catch (error) {
    return handleError(error);
  }
}
