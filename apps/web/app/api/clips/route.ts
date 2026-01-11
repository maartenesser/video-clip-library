import { NextRequest, NextResponse } from 'next/server';
import { listClipsQuerySchema } from '@/lib/schemas';
import { handleError, getQueryParams, searchParamsToObject } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';
import type { ClipFilter, PaginationParams } from '@video-clip-library/database';

/**
 * GET /api/clips
 *
 * Search and filter clips with pagination.
 * Supports filtering by source, tags, duration, and text search.
 */
export async function GET(request: NextRequest) {
  try {
    const params = searchParamsToObject(getQueryParams(request));
    const validated = listClipsQuerySchema.parse(params);

    const db = getDatabase();

    // Build filter object
    const filter: ClipFilter = {};
    if (validated.source_id) {
      filter.source_id = validated.source_id;
    }
    if (validated.min_duration !== undefined) {
      filter.min_duration = validated.min_duration;
    }
    if (validated.max_duration !== undefined) {
      filter.max_duration = validated.max_duration;
    }
    if (validated.tag_ids && validated.tag_ids.length > 0) {
      filter.tag_ids = validated.tag_ids;
    }

    // Build pagination object
    const pagination: PaginationParams = {
      page: validated.page,
      limit: validated.limit,
      orderBy: validated.orderBy,
      orderDirection: validated.orderDirection,
    };

    // If searching by tags, use a different query method
    if (filter.tag_ids && filter.tag_ids.length > 0) {
      // Get clips by tag IDs
      const tagClips = await db.getClipsByTagIds(filter.tag_ids);

      // Apply other filters manually
      let filteredClips = tagClips;

      if (filter.source_id) {
        filteredClips = filteredClips.filter(c => c.source_id === filter.source_id);
      }
      if (filter.min_duration !== undefined) {
        filteredClips = filteredClips.filter(c => c.duration_seconds >= filter.min_duration!);
      }
      if (filter.max_duration !== undefined) {
        filteredClips = filteredClips.filter(c => c.duration_seconds <= filter.max_duration!);
      }

      // Apply search filter on transcript
      if (validated.search) {
        const searchLower = validated.search.toLowerCase();
        filteredClips = filteredClips.filter(c =>
          c.transcript_segment?.toLowerCase().includes(searchLower)
        );
      }

      // Sort
      filteredClips.sort((a, b) => {
        const aVal = a[pagination.orderBy as keyof typeof a];
        const bVal = b[pagination.orderBy as keyof typeof b];
        if (pagination.orderDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      });

      // Paginate
      const offset = (pagination.page! - 1) * pagination.limit!;
      const paginatedClips = filteredClips.slice(offset, offset + pagination.limit!);

      return NextResponse.json({
        data: paginatedClips,
        count: filteredClips.length,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(filteredClips.length / pagination.limit!),
      });
    }

    // Standard query without tag filtering
    const result = await db.getClips(filter, pagination);

    // If search is provided, filter by transcript (done on client side for now)
    if (validated.search) {
      const searchLower = validated.search.toLowerCase();
      result.data = result.data.filter(c =>
        c.transcript_segment?.toLowerCase().includes(searchLower)
      );
      result.count = result.data.length;
      result.totalPages = Math.ceil(result.count / pagination.limit!);
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
