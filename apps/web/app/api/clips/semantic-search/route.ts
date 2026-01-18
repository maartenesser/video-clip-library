import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { semanticSearchSchema } from '@/lib/schemas';
import { handleError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

// Lazy-initialize OpenAI client to avoid build-time errors
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// Helper to convert clips to use proxy URLs
function addProxyUrls(clips: any[]) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return clips.map((clip) => {
    let proxyFileUrl = clip.file_url;
    let proxyThumbnailUrl = clip.thumbnail_url;

    if (clip.file_key) {
      proxyFileUrl = `${baseUrl}/api/media/${clip.file_key}`;
      const thumbnailKey = clip.file_key.replace('.mp4', '_thumb.jpg');
      proxyThumbnailUrl = `${baseUrl}/api/media/${thumbnailKey}`;
    }

    return {
      ...clip,
      file_url: proxyFileUrl,
      thumbnail_url: proxyThumbnailUrl,
    };
  });
}

/**
 * POST /api/clips/semantic-search
 *
 * Search clips by semantic similarity using embeddings.
 * Uses OpenAI text-embedding-3-small for query embeddings.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = semanticSearchSchema.parse(body);

    // Generate query embedding using OpenAI
    const embeddingResponse = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: validated.query,
      dimensions: 384, // Match the dimension used by all-MiniLM-L6-v2
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search database for similar clips
    const db = getDatabase();
    let searchResults = await db.searchClipsBySimilarity(
      queryEmbedding,
      validated.threshold,
      validated.limit
    );

    // Filter by source_id if provided
    if (validated.source_id) {
      searchResults = searchResults.filter(clip => clip.source_id === validated.source_id);
    }

    // Add proxy URLs to results
    const clipsWithUrls = addProxyUrls(searchResults);

    return NextResponse.json({
      data: clipsWithUrls,
      count: clipsWithUrls.length,
      query: validated.query,
      threshold: validated.threshold,
    });
  } catch (error) {
    return handleError(error);
  }
}
