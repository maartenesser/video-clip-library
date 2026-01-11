import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { uploadUrlSchema } from '@/lib/schemas';
import { handleError } from '@/lib/api-utils';
import { getStorage } from '@/lib/storage';
import { generateSourceKey, getExtensionFromContentType } from '@video-clip-library/storage';

/**
 * POST /api/sources/upload-url
 *
 * Generate a presigned URL for uploading a source video.
 * Returns the upload URL along with the file key and source metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = uploadUrlSchema.parse(body);

    const storage = getStorage();

    // Generate a new source ID
    const sourceId = uuidv4();

    // Determine filename from content type if needed
    const extension = getExtensionFromContentType(validated.contentType);
    const filename = validated.filename || `original.${extension}`;

    // Generate the storage key
    const fileKey = generateSourceKey(sourceId, filename);

    // Generate presigned upload URL (valid for 1 hour)
    const uploadUrl = await storage.getUploadUrl(fileKey, validated.contentType, 3600);

    // Build the public URL (if configured)
    let fileUrl: string;
    try {
      fileUrl = storage.getPublicUrl(fileKey);
    } catch {
      // If public URL is not configured, use a placeholder
      // The actual URL will be updated after upload
      fileUrl = `https://storage.example.com/${fileKey}`;
    }

    return NextResponse.json({
      sourceId,
      uploadUrl,
      fileKey,
      fileUrl,
      expiresIn: 3600,
      metadata: {
        title: validated.title,
        description: validated.description,
        source_type: validated.source_type,
        creator_name: validated.creator_name,
      },
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
