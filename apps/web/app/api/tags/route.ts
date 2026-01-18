import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

/**
 * GET /api/tags
 *
 * Get all available tags.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const tags = await db.getTags();
    return NextResponse.json(tags);
  } catch (error) {
    return handleError(error);
  }
}
