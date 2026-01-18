import { NextRequest, NextResponse } from 'next/server';
import { listClipsQuerySchema } from '@/lib/schemas';
import { handleError, getQueryParams, searchParamsToObject } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';
import type { ClipFilter, PaginationParams } from '@video-clip-library/database';

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

// Helper to fetch quality data for clips
async function fetchQualityData(db: any, clipIds: string[]): Promise<Map<string, any>> {
  const qualityMap = new Map();

  for (const clipId of clipIds) {
    try {
      const quality = await db.getClipQuality(clipId);
      if (quality) {
        qualityMap.set(clipId, quality);
      }
    } catch (e) {
      // Skip clips without quality data
    }
  }

  return qualityMap;
}

// Helper to fetch group data for clips
async function fetchGroupData(db: any, clipIds: string[]): Promise<Map<string, any[]>> {
  const groupMap = new Map();

  for (const clipId of clipIds) {
    try {
      const groups = await db.getClipGroups_byClipId(clipId);
      if (groups && groups.length > 0) {
        groupMap.set(clipId, groups);
      }
    } catch (e) {
      // Skip clips without group data
    }
  }

  return groupMap;
}

// Helper to add quality and group data to clips
function enrichClips(clips: any[], qualityMap: Map<string, any>, groupMap: Map<string, any[]>): any[] {
  return clips.map(clip => ({
    ...clip,
    quality: qualityMap.get(clip.id) || null,
    groups: groupMap.get(clip.id) || [],
  }));
}

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
        const aVal = a[pagination.orderBy as keyof typeof a] ?? '';
        const bVal = b[pagination.orderBy as keyof typeof b] ?? '';
        if (pagination.orderDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      });

      // Paginate
      const offset = (pagination.page! - 1) * pagination.limit!;
      let paginatedClips = filteredClips.slice(offset, offset + pagination.limit!);

      // Add proxy URLs
      paginatedClips = addProxyUrls(paginatedClips);

      // Fetch and add quality data if requested
      if (validated.include_quality) {
        const clipIds = paginatedClips.map((c: any) => c.id);
        const qualityMap = await fetchQualityData(db, clipIds);
        const groupMap = validated.include_groups
          ? await fetchGroupData(db, clipIds)
          : new Map();

        paginatedClips = enrichClips(paginatedClips, qualityMap, groupMap);

        // Filter by min_quality if specified
        if (validated.min_quality !== undefined) {
          const minQuality = validated.min_quality;
          paginatedClips = paginatedClips.filter((c: any) =>
            c.quality?.overall_quality_score >= minQuality
          );
        }
      }

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

    // Add proxy URLs to clips
    result.data = addProxyUrls(result.data);

    // Fetch and add quality data if requested
    if (validated.include_quality) {
      const clipIds = result.data.map((c: any) => c.id);
      const qualityMap = await fetchQualityData(db, clipIds);
      const groupMap = validated.include_groups
        ? await fetchGroupData(db, clipIds)
        : new Map();

      result.data = enrichClips(result.data, qualityMap, groupMap);

      // Filter by min_quality if specified
      if (validated.min_quality !== undefined) {
        const minQuality = validated.min_quality;
        result.data = result.data.filter((c: any) =>
          c.quality?.overall_quality_score >= minQuality
        );
        result.count = result.data.length;
        result.totalPages = Math.ceil(result.count / pagination.limit!);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
