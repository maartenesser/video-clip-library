import { NextRequest, NextResponse } from 'next/server';
import { uuidParamSchema, updateClipSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/clips/[id]
 *
 * Get a clip by ID with its tags.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const validatedId = uuidParamSchema.parse(id);

    const db = getDatabase();

    // Get clip with tags
    const clip = await db.getClipWithTags(validatedId);

    if (!clip) {
      throw new ApiError(404, 'Clip not found');
    }

    return NextResponse.json(clip);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/clips/[id]
 *
 * Update a clip's properties.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const validatedId = uuidParamSchema.parse(id);

    const body = await request.json();
    const validated = updateClipSchema.parse(body);

    // Ensure at least one field is being updated
    if (Object.keys(validated).length === 0) {
      throw new ApiError(400, 'No fields to update');
    }

    const db = getDatabase();

    // Check if clip exists
    const existingClip = await db.getClipById(validatedId);
    if (!existingClip) {
      throw new ApiError(404, 'Clip not found');
    }

    // Validate time range if both are provided
    const startTime = validated.start_time_seconds ?? existingClip.start_time_seconds;
    const endTime = validated.end_time_seconds ?? existingClip.end_time_seconds;

    if (endTime <= startTime) {
      throw new ApiError(400, 'End time must be greater than start time');
    }

    // Update the clip
    const updatedClip = await db.updateClip(validatedId, validated);

    return NextResponse.json(updatedClip);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * DELETE /api/clips/[id]
 *
 * Delete a clip.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const validatedId = uuidParamSchema.parse(id);

    const db = getDatabase();

    // Check if clip exists
    const clip = await db.getClipById(validatedId);
    if (!clip) {
      throw new ApiError(404, 'Clip not found');
    }

    // Delete the clip (tags should be cascade deleted)
    await db.deleteClip(validatedId);

    return NextResponse.json({ success: true, message: 'Clip deleted' });
  } catch (error) {
    return handleError(error);
  }
}
