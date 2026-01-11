"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Film } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { ClipGrid } from "@/components/clip-grid";
import type { Tag } from "@/components/tag-selector";

interface ClipData {
  id: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  tags: Tag[];
}

export default function ClipsPage() {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    tagIds: [] as string[],
    search: "",
    sortBy: "date-desc",
  });

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setTags(
            data.map((tag: any) => ({
              id: tag.id,
              name: tag.name,
              color: tag.color,
              category: tag.category,
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching tags:", error);
      }
    };

    fetchTags();
  }, []);

  const fetchClips = useCallback(
    async (pageNum: number, currentFilters: typeof filters) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "20",
        });

        // Parse sort
        const [orderBy, orderDirection] = currentFilters.sortBy.split("-");
        if (orderBy === "date") {
          params.set("orderBy", "created_at");
        } else if (orderBy === "duration") {
          params.set("orderBy", "duration_seconds");
        }
        params.set("orderDirection", orderDirection);

        // Add tag filter
        if (currentFilters.tagIds.length > 0) {
          params.set("tag_ids", currentFilters.tagIds.join(","));
        }

        // Add search
        if (currentFilters.search) {
          params.set("search", currentFilters.search);
        }

        const response = await fetch(`/api/clips?${params}`);
        if (!response.ok) throw new Error("Failed to fetch clips");

        const data = await response.json();

        // Transform API response
        const transformedClips: ClipData[] = data.data.map((clip: any) => ({
          id: clip.id,
          thumbnailUrl: clip.thumbnail_url,
          fileUrl: clip.file_url,
          durationSeconds: clip.duration_seconds,
          transcriptSegment: clip.transcript_segment,
          startTimeSeconds: clip.start_time_seconds,
          endTimeSeconds: clip.end_time_seconds,
          tags: (clip.tags || []).map((ct: any) => ({
            id: ct.tag?.id || ct.tag_id,
            name: ct.tag?.name || "Unknown",
            color: ct.tag?.color || null,
          })),
        }));

        if (pageNum === 1) {
          setClips(transformedClips);
        } else {
          setClips((prev) => [...prev, ...transformedClips]);
        }

        setTotalCount(data.count);
        setHasMore(pageNum < data.totalPages);
      } catch (error) {
        console.error("Error fetching clips:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Fetch clips when filters change
  useEffect(() => {
    setPage(1);
    fetchClips(1, filters);
  }, [filters, fetchClips]);

  const handleFilterChange = (newFilters: {
    tagIds: string[];
    search: string;
    sortBy: string;
  }) => {
    setFilters(newFilters);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchClips(nextPage, filters);
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clip Library</h1>
        <p className="text-muted-foreground">
          {totalCount} clip{totalCount !== 1 ? "s" : ""} available
        </p>
      </div>

      {/* Clip grid with filters */}
      <ClipGrid
        clips={clips}
        tags={tags}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onFilterChange={handleFilterChange}
      />

      {/* Empty state when no clips and not loading */}
      {!isLoading && clips.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Film className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No clips found</CardTitle>
            <CardDescription className="text-center">
              {filters.search || filters.tagIds.length > 0
                ? "Try adjusting your filters or search query"
                : "Upload some source videos to generate clips"}
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
