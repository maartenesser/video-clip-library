"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Film, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipGrid } from "@/components/clip-grid";
import type { Tag } from "@/components/tag-selector";
import { useToast } from "@/hooks/use-toast";

interface ClipQuality {
  overall_quality_score: number | null;
  speaking_quality_score: number | null;
  audio_quality_score: number | null;
  filler_word_count: number | null;
  hesitation_count: number | null;
  words_per_minute: number | null;
}

interface ClipGroup {
  id: string;
  name: string;
  group_type: 'duplicate' | 'same_topic' | 'multiple_takes';
}

interface ClipData {
  id: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  tags: Tag[];
  quality: ClipQuality | null;
  groups: ClipGroup[];
}

export default function ClipsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [clips, setClips] = useState<ClipData[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [assemblyClipIds, setAssemblyClipIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    tagIds: [] as string[],
    search: "",
    sortBy: "date-desc",
    minQuality: undefined as number | undefined,
  });

  // Track if initial load is complete
  const initialLoadDone = useRef(false);

  // Load assembly clips from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('assemblyClipIds');
    if (saved) {
      try {
        setAssemblyClipIds(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse assembly clips:', e);
      }
    }
  }, []);

  // Save assembly clips to localStorage
  useEffect(() => {
    localStorage.setItem('assemblyClipIds', JSON.stringify(assemblyClipIds));
  }, [assemblyClipIds]);

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
      // Only show loading skeleton on initial load, not on filter changes
      if (!initialLoadDone.current) {
        setIsLoading(true);
      }

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

        // Add quality filter
        if (currentFilters.minQuality !== undefined) {
          params.set("min_quality", currentFilters.minQuality.toString());
        }

        // Always include quality data
        params.set("include_quality", "true");
        params.set("include_groups", "true");

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
          quality: clip.quality || null,
          groups: (clip.groups || []).map((g: any) => ({
            id: g.id,
            name: g.name,
            group_type: g.group_type,
          })),
        }));

        if (pageNum === 1) {
          setClips(transformedClips);
        } else {
          setClips((prev) => [...prev, ...transformedClips]);
        }

        setTotalCount(data.count);
        setHasMore(pageNum < data.totalPages);
        initialLoadDone.current = true;
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
    minQuality?: number;
  }) => {
    setFilters({
      ...newFilters,
      minQuality: newFilters.minQuality,
    });
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchClips(nextPage, filters);
  };

  const handleDeleteClip = async (clipId: string) => {
    const response = await fetch(`/api/clips/${clipId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete clip');
    }

    // Remove from local state
    setClips((prev) => prev.filter((c) => c.id !== clipId));
    setTotalCount((prev) => prev - 1);

    // Remove from assembly if present
    setAssemblyClipIds((prev) => prev.filter((id) => id !== clipId));

    toast({
      title: "Clip deleted",
      description: "The clip has been removed from your library.",
    });
  };

  const handleAddToAssembly = (clipId: string) => {
    if (!assemblyClipIds.includes(clipId)) {
      setAssemblyClipIds((prev) => [...prev, clipId]);
      toast({
        title: "Added to assembly",
        description: "Clip added to your assembly queue.",
      });
    }
  };

  const handleAutoClean = async (clipId: string) => {
    // First analyze
    const analyzeResponse = await fetch(`/api/clips/${clipId}/clean`, {
      method: 'POST',
    });

    if (!analyzeResponse.ok) {
      throw new Error('Failed to analyze clip');
    }

    const analysis = await analyzeResponse.json();

    if (!analysis.analysis.canClean) {
      toast({
        title: "Clip is already clean",
        description: "No filler words or hesitations detected.",
      });
      return;
    }

    // Execute cleaning
    const cleanResponse = await fetch(`/api/clips/${clipId}/clean?execute=true`, {
      method: 'POST',
    });

    if (!cleanResponse.ok) {
      throw new Error('Failed to clean clip');
    }

    toast({
      title: "Cleaning started",
      description: `Removing ${analysis.analysis.fillerCount} filler words and ${analysis.analysis.hesitationCount} hesitations. Check back soon.`,
    });
  };

  const handleGoToAssembly = () => {
    router.push('/assemble');
  };

  const handleClearAssembly = () => {
    setAssemblyClipIds([]);
    toast({
      title: "Assembly cleared",
      description: "All clips removed from assembly queue.",
    });
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clip Library</h1>
          <p className="text-muted-foreground">
            {totalCount} clip{totalCount !== 1 ? "s" : ""} available
          </p>
        </div>

        {/* Assembly queue indicator */}
        {assemblyClipIds.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Package className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <span className="text-sm font-medium">
                {assemblyClipIds.length} clip{assemblyClipIds.length !== 1 ? "s" : ""} in assembly
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearAssembly}>
              Clear
            </Button>
            <Button size="sm" onClick={handleGoToAssembly}>
              Go to Assembly
            </Button>
          </div>
        )}
      </div>

      {/* Clip grid with filters */}
      <ClipGrid
        clips={clips}
        tags={tags}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onFilterChange={handleFilterChange}
        onDeleteClip={handleDeleteClip}
        onAddToAssembly={handleAddToAssembly}
        onAutoClean={handleAutoClean}
        assemblyClipIds={assemblyClipIds}
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
