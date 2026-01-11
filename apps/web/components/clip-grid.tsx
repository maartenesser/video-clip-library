"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ClipCard } from "@/components/clip-card";
import { TagSelector, type Tag } from "@/components/tag-selector";
import { SearchBar } from "@/components/search-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ClipData {
  id: string;
  thumbnailUrl?: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment?: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  tags: Tag[];
}

interface ClipGridProps {
  clips: ClipData[];
  tags: Tag[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFilterChange?: (filters: {
    tagIds: string[];
    search: string;
    sortBy: string;
  }) => void;
  className?: string;
}

export function ClipGrid({
  clips,
  tags,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onFilterChange,
  className,
}: ClipGridProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);

  const handleTagSelectionChange = (tagIds: string[]) => {
    setSelectedTagIds(tagIds);
    onFilterChange?.({
      tagIds,
      search: searchQuery,
      sortBy,
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleSearch = (value: string) => {
    onFilterChange?.({
      tagIds: selectedTagIds,
      search: value,
      sortBy,
    });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onFilterChange?.({
      tagIds: selectedTagIds,
      search: searchQuery,
      sortBy: value,
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4" data-testid="clip-grid-filters">
        <div className="flex-1">
          <SearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            placeholder="Search transcripts..."
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <TagSelector
            tags={tags}
            selectedTagIds={selectedTagIds}
            onSelectionChange={handleTagSelectionChange}
            placeholder="Filter by tags"
          />
        </div>
        <div className="w-full sm:w-[150px]">
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger data-testid="sort-select">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest first</SelectItem>
              <SelectItem value="date-asc">Oldest first</SelectItem>
              <SelectItem value="duration-desc">Longest first</SelectItem>
              <SelectItem value="duration-asc">Shortest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        data-testid="clip-grid"
      >
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            id={clip.id}
            thumbnailUrl={clip.thumbnailUrl}
            fileUrl={clip.fileUrl}
            durationSeconds={clip.durationSeconds}
            transcriptSegment={clip.transcriptSegment}
            tags={clip.tags}
            onClick={() => setSelectedClip(clip)}
          />
        ))}

        {/* Loading skeletons */}
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="space-y-2">
              <Skeleton className="aspect-video rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
      </div>

      {/* Empty state */}
      {!isLoading && clips.length === 0 && (
        <div
          className="text-center py-12 text-muted-foreground"
          data-testid="empty-state"
        >
          <p className="text-lg">No clips found</p>
          <p className="text-sm">
            Try adjusting your filters or search query
          </p>
        </div>
      )}

      {/* Load more button */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            data-testid="load-more"
          >
            Load more clips
          </Button>
        </div>
      )}

      {/* Clip detail dialog */}
      <Dialog open={!!selectedClip} onOpenChange={() => setSelectedClip(null)}>
        <DialogContent className="max-w-3xl">
          {selectedClip && (
            <>
              <DialogHeader>
                <DialogTitle>Clip Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Video player */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={selectedClip.fileUrl}
                    controls
                    className="w-full h-full"
                    autoPlay
                  />
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>{" "}
                    <span className="font-medium">
                      {formatDuration(selectedClip.durationSeconds)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time range:</span>{" "}
                    <span className="font-medium">
                      {formatTime(selectedClip.startTimeSeconds)} -{" "}
                      {formatTime(selectedClip.endTimeSeconds)}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {selectedClip.tags.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">
                      Tags:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedClip.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcript */}
                {selectedClip.transcriptSegment && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">
                      Transcript:
                    </span>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedClip.transcriptSegment}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
