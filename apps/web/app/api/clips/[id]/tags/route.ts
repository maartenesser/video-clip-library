import { NextRequest, NextResponse } from 'next/server';
import { uuidParamSchema, addTagsSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/clips/[id]/tags
 *
 * Get all tags for a clip.
 */
export async function GET(
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

    const tags = await db.getClipTags(validatedId);

    return NextResponse.json(tags);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/clips/[id]/tags
 *
 * Add tags to a clip.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const validatedId = uuidParamSchema.parse(id);

    const body = await request.json();
    const validated = addTagsSchema.parse(body);

    const db = getDatabase();

    // Check if clip exists
    const clip = await db.getClipById(validatedId);
    if (!clip) {
      throw new ApiError(404, 'Clip not found');
    }

    // Verify all tag IDs exist
    for (const tagId of validated.tag_ids) {
      const tag = await db.getTagById(tagId);
      if (!tag) {
        throw new ApiError(400, `Tag not found: ${tagId}`);
      }
    }

    // Add tags to clip
    const clipTags = await db.addTagsToClip(
      validatedId,
      validated.tag_ids,
      validated.assigned_by
    );

    return NextResponse.json(clipTags, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
