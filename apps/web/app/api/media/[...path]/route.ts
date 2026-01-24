import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getStorage } from '@/lib/storage';

/**
 * GET /api/media/[...path]
 *
 * Proxy endpoint for serving media files from R2.
 * Streams video files and images directly from R2 storage.
 * Supports HTTP Range requests for video seeking.
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

    // Get Range header from request for partial content support
    const rangeHeader = request.headers.get('range');

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      Range: rangeHeader || undefined,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get content type from the response or infer from extension
    const contentType = response.ContentType || getContentType(key);

    // Convert AWS SDK stream to web-standard ReadableStream
    const stream = toWebStream(response.Body as Readable | ReadableStream);

    // Build response headers
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    };

    // Handle partial content (Range request)
    if (response.ContentRange) {
      headers['Content-Range'] = response.ContentRange;
      headers['Content-Length'] = response.ContentLength?.toString() || '';

      return new NextResponse(stream, {
        status: 206,
        headers,
      });
    }

    // Full content response
    headers['Content-Length'] = response.ContentLength?.toString() || '';

    return new NextResponse(stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Media proxy error:', error);

    // Check if it's a not found error
    if (error instanceof Error && error.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Handle invalid Range requests
    if (error instanceof Error && error.name === 'InvalidRange') {
      return new NextResponse(null, { status: 416 }); // Range Not Satisfiable
    }

    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    );
  }
}

/**
 * Convert AWS SDK stream body to web-standard ReadableStream
 */
function toWebStream(body: Readable | ReadableStream): ReadableStream {
  // If already a web ReadableStream, return it
  if (body instanceof ReadableStream) {
    return body;
  }

  // Node.js Readable stream - convert to web stream
  if (typeof (body as Readable).pipe === 'function') {
    return Readable.toWeb(body as Readable) as ReadableStream;
  }

  throw new Error('Unsupported body type');
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
