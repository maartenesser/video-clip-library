import { NextRequest, NextResponse } from 'next/server';
import { uuidParamSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

interface RouteParams {
  params: Promise<{
    id: string;
    tagId: string;
  }>;
}

/**
 * DELETE /api/clips/[id]/tags/[tagId]
 *
 * Remove a tag from a clip.
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id, tagId } = await params;
    const validatedClipId = uuidParamSchema.parse(id);
    const validatedTagId = uuidParamSchema.parse(tagId);

    const db = getDatabase();

    // Check if clip exists
    const clip = await db.getClipById(validatedClipId);
    if (!clip) {
      throw new ApiError(404, 'Clip not found');
    }

    // Check if tag exists
    const tag = await db.getTagById(validatedTagId);
    if (!tag) {
      throw new ApiError(404, 'Tag not found');
    }

    // Check if the clip has this tag
    const clipTags = await db.getClipTags(validatedClipId);
    const hasTag = clipTags.some(ct => ct.tag_id === validatedTagId);

    if (!hasTag) {
      throw new ApiError(404, 'Tag not associated with this clip');
    }

    // Remove the tag from the clip
    await db.removeTagFromClip(validatedClipId, validatedTagId);

    return NextResponse.json({ success: true, message: 'Tag removed from clip' });
  } catch (error) {
    return handleError(error);
  }
}
