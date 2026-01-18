import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

/**
 * GET /api/media/[...path]
 *
 * Proxy endpoint for serving media files from R2.
 * Streams video files and images directly from R2 storage.
 *
 * Example: /api/media/clips/abc123/clip_0001.mp4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const key = path.join('/');

    if (!key) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Validate the path to prevent directory traversal
    if (key.includes('..') || key.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const storage = getStorage();
    const s3Client = storage.getS3Client();
    const bucketName = storage.getBucketName();

    // Import the command dynamically to avoid issues with edge runtime
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get content type from the response or infer from extension
    const contentType = response.ContentType || getContentType(key);

    // Get the body as a stream
    const stream = response.Body as ReadableStream;

    // Return the stream with appropriate headers
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': response.ContentLength?.toString() || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('Media proxy error:', error);

    // Check if it's a not found error
    if (error instanceof Error && error.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}
