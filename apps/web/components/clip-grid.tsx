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
import { Star, Mic, Volume2, Timer, AlertCircle, Copy, Trash2, Plus, Sparkles } from "lucide-react";

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
  thumbnailUrl?: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment?: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  tags: Tag[];
  quality?: ClipQuality | null;
  groups?: ClipGroup[];
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
    minQuality?: number;
  }) => void;
  onDeleteClip?: (clipId: string) => Promise<void>;
  onAddToAssembly?: (clipId: string) => void;
  onAutoClean?: (clipId: string) => Promise<void>;
  assemblyClipIds?: string[];
  className?: string;
}

export function ClipGrid({
  clips,
  tags,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onFilterChange,
  onDeleteClip,
  onAddToAssembly,
  onAutoClean,
  assemblyClipIds = [],
  className,
}: ClipGridProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [minQuality, setMinQuality] = useState<string>("all");
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getQualityValue = (): number | undefined => {
    return minQuality === "all" ? undefined : parseFloat(minQuality);
  };

  const handleTagSelectionChange = (tagIds: string[]) => {
    setSelectedTagIds(tagIds);
    onFilterChange?.({
      tagIds,
      search: searchQuery,
      sortBy,
      minQuality: getQualityValue(),
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
      minQuality: getQualityValue(),
    });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onFilterChange?.({
      tagIds: selectedTagIds,
      search: searchQuery,
      sortBy: value,
      minQuality: getQualityValue(),
    });
  };

  const handleQualityChange = (value: string) => {
    setMinQuality(value);
    const qualityValue = value === "all" ? undefined : parseFloat(value);
    onFilterChange?.({
      tagIds: selectedTagIds,
      search: searchQuery,
      sortBy,
      minQuality: qualityValue,
    });
  };

  const handleDeleteClip = async () => {
    if (!selectedClip || !onDeleteClip) return;
    setIsDeleting(true);
    try {
      await onDeleteClip(selectedClip.id);
      setSelectedClip(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete clip:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddToAssembly = () => {
    if (!selectedClip || !onAddToAssembly) return;
    onAddToAssembly(selectedClip.id);
  };

  const handleAutoClean = async () => {
    if (!selectedClip || !onAutoClean) return;
    setIsCleaning(true);
    try {
      await onAutoClean(selectedClip.id);
    } catch (error) {
      console.error('Failed to clean clip:', error);
    } finally {
      setIsCleaning(false);
    }
  };

  const isInAssembly = (clipId: string) => assemblyClipIds.includes(clipId);

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

  const getQualityColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 4.5) return "text-green-500";
    if (score >= 4.0) return "text-green-400";
    if (score >= 3.5) return "text-yellow-500";
    if (score >= 3.0) return "text-orange-500";
    return "text-red-500";
  };

  const getGroupTypeLabel = (type: string) => {
    switch (type) {
      case 'duplicate': return 'Duplicate';
      case 'same_topic': return 'Same Topic';
      case 'multiple_takes': return 'Multiple Takes';
      default: return type;
    }
  };

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case 'duplicate': return 'bg-red-100 text-red-700';
      case 'same_topic': return 'bg-blue-100 text-blue-700';
      case 'multiple_takes': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
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
          <Select value={minQuality} onValueChange={handleQualityChange}>
            <SelectTrigger data-testid="quality-filter">
              <SelectValue placeholder="Min quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All quality</SelectItem>
              <SelectItem value="4.5">Excellent (4.5+)</SelectItem>
              <SelectItem value="4">Good (4+)</SelectItem>
              <SelectItem value="3.5">Above avg (3.5+)</SelectItem>
              <SelectItem value="3">Average (3+)</SelectItem>
            </SelectContent>
          </Select>
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
            qualityScore={clip.quality?.overall_quality_score ?? undefined}
            groupCount={clip.groups?.length ?? 0}
            groupType={clip.groups?.[0]?.group_type}
            isInAssembly={isInAssembly(clip.id)}
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

      {/* Clip detail dialog - mobile optimized */}
      <Dialog open={!!selectedClip} onOpenChange={() => setSelectedClip(null)}>
        <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
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
                    playsInline
                  />
                </div>

                {/* Metadata - stack on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
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

                {/* Quality scores */}
                {selectedClip.quality && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">
                      Quality Analysis:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {/* Overall score */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Star className={`h-4 w-4 ${getQualityColor(selectedClip.quality.overall_quality_score)}`} />
                        <div>
                          <div className="text-xs text-muted-foreground">Overall</div>
                          <div className={`font-medium ${getQualityColor(selectedClip.quality.overall_quality_score)}`}>
                            {selectedClip.quality.overall_quality_score?.toFixed(1) ?? 'N/A'}/5
                          </div>
                        </div>
                      </div>
                      {/* Speaking score */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Mic className={`h-4 w-4 ${getQualityColor(selectedClip.quality.speaking_quality_score)}`} />
                        <div>
                          <div className="text-xs text-muted-foreground">Speaking</div>
                          <div className={`font-medium ${getQualityColor(selectedClip.quality.speaking_quality_score)}`}>
                            {selectedClip.quality.speaking_quality_score?.toFixed(1) ?? 'N/A'}/5
                          </div>
                        </div>
                      </div>
                      {/* Audio score */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Volume2 className={`h-4 w-4 ${getQualityColor(selectedClip.quality.audio_quality_score)}`} />
                        <div>
                          <div className="text-xs text-muted-foreground">Audio</div>
                          <div className={`font-medium ${getQualityColor(selectedClip.quality.audio_quality_score)}`}>
                            {selectedClip.quality.audio_quality_score?.toFixed(1) ?? 'N/A'}/5
                          </div>
                        </div>
                      </div>
                      {/* WPM */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">WPM</div>
                          <div className="font-medium">
                            {selectedClip.quality.words_per_minute?.toFixed(0) ?? 'N/A'}
                          </div>
                        </div>
                      </div>
                      {/* Filler words */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">Fillers</div>
                          <div className="font-medium">
                            {selectedClip.quality.filler_word_count ?? 0}
                          </div>
                        </div>
                      </div>
                      {/* Hesitations */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-xs text-muted-foreground">Hesitations</div>
                          <div className="font-medium">
                            {selectedClip.quality.hesitation_count ?? 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Groups */}
                {selectedClip.groups && selectedClip.groups.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-2">
                      Similar Clips:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedClip.groups.map((group) => (
                        <Badge
                          key={group.id}
                          variant="secondary"
                          className={getGroupTypeColor(group.group_type)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {getGroupTypeLabel(group.group_type)}
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

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {onAddToAssembly && (
                    <Button
                      variant={isInAssembly(selectedClip.id) ? "secondary" : "default"}
                      size="sm"
                      onClick={handleAddToAssembly}
                      disabled={isInAssembly(selectedClip.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {isInAssembly(selectedClip.id) ? "In Assembly" : "Add to Assembly"}
                    </Button>
                  )}

                  {onAutoClean && selectedClip.quality &&
                   ((selectedClip.quality.filler_word_count ?? 0) > 0 ||
                    (selectedClip.quality.hesitation_count ?? 0) > 0) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoClean}
                      disabled={isCleaning}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      {isCleaning ? "Cleaning..." : "Auto-Clean"}
                    </Button>
                  )}

                  {onDeleteClip && (
                    <>
                      {!showDeleteConfirm ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
                          <span className="text-sm text-destructive">Delete this clip?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteClip}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Yes, Delete"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
