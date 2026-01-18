"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Clock, Play, User, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export type SourceStatus = "pending" | "processing" | "completed" | "failed";

interface SourceCardProps {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  status: SourceStatus;
  durationSeconds?: number | null;
  creatorName?: string | null;
  createdAt: string;
  clipCount?: number;
  className?: string;
  onDelete?: (id: string) => void;
}

const statusVariants: Record<
  SourceStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "success" | "processing";
  }
> = {
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "processing" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export function SourceCard({
  id,
  title,
  thumbnailUrl,
  status,
  durationSeconds,
  creatorName,
  createdAt,
  clipCount,
  className,
  onDelete,
}: SourceCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDuration = (seconds: number) => {
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete "${title}"? This will permanently delete the source video and all its clips.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/sources/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete source");
      }

      onDelete?.(id);
    } catch (error) {
      console.error("Error deleting source:", error);
      alert("Failed to delete source. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const statusConfig = statusVariants[status];

  return (
    <div className="relative group">
      <Link href={`/sources/${id}`} className="block">
        <Card
          className={cn(
            "overflow-hidden transition-all hover:shadow-lg hover:border-primary/50",
            className
          )}
        >
          {/* Thumbnail */}
          <div className="relative aspect-video bg-muted">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                unoptimized={thumbnailUrl.startsWith('http')}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}

            {/* Duration overlay */}
            {durationSeconds && durationSeconds > 0 && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 rounded text-xs text-white font-medium">
                {formatDuration(durationSeconds)}
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>

          <CardContent className="p-4">
            {/* Status badge */}
            <div className="flex items-center justify-between mb-2">
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              {clipCount !== undefined && clipCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {clipCount} clip{clipCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
          </CardContent>

          <CardFooter className="px-4 pb-4 pt-0">
            <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
              {/* Creator */}
              {creatorName && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{creatorName}</span>
                </div>
              )}

              {/* Time ago */}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </CardFooter>
        </Card>
      </Link>

      {/* Delete button - positioned top right, visible on hover */}
      {onDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete source"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
