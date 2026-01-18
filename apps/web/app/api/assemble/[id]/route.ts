import { NextRequest, NextResponse } from 'next/server';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/assemble/[id]
 *
 * Get the status and details of an assembly job.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDatabase();

    const assembly = await db.getAssembledVideoById(id);
    if (!assembly) {
      throw new ApiError(404, 'Assembly not found');
    }

    // Add proxy URL for completed assembly
    let fileUrl = assembly.file_url;
    if (assembly.file_key && assembly.status === 'completed') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      fileUrl = `${baseUrl}/api/media/${assembly.file_key}`;
    }

    return NextResponse.json({
      id: assembly.id,
      title: assembly.title,
      status: assembly.status,
      clip_ids: assembly.clip_ids,
      file_url: fileUrl,
      duration_seconds: assembly.duration_seconds,
      subtitle_style: assembly.subtitle_style,
      error_message: assembly.error_message,
      created_at: assembly.created_at,
      updated_at: assembly.updated_at,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/assemble/[id]
 *
 * Update an assembly job status (used by worker callback).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const db = getDatabase();

    const assembly = await db.getAssembledVideoById(id);
    if (!assembly) {
      throw new ApiError(404, 'Assembly not found');
    }

    // Handle worker callback
    if (body.status === 'completed' && body.file_url && body.file_key) {
      const updated = await db.completeAssembledVideo(
        id,
        body.file_url,
        body.file_key,
        body.duration_seconds || 0
      );

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        file_url: updated.file_url,
        duration_seconds: updated.duration_seconds,
      });
    }

    if (body.status === 'failed' && body.error_message) {
      const updated = await db.failAssembledVideo(id, body.error_message);

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        error_message: updated.error_message,
      });
    }

    // General update
    const updated = await db.updateAssembledVideo(id, {
      status: body.status,
      error_message: body.error_message,
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/assemble/[id]
 *
 * Delete an assembly job and its associated file.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDatabase();

    const assembly = await db.getAssembledVideoById(id);
    if (!assembly) {
      throw new ApiError(404, 'Assembly not found');
    }

    // TODO: Delete file from R2 if exists
    // if (assembly.file_key) {
    //   await r2Client.deleteFile(assembly.file_key);
    // }

    await db.deleteAssembledVideo(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
