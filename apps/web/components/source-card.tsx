"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Clock, Play, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
}: SourceCardProps) {
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

  const statusConfig = statusVariants[status];

  return (
    <Link href={`/sources/${id}`} className="block group">
      <Card
        className={cn(
          "overflow-hidden transition-all hover:shadow-lg hover:border-primary/50",
          className
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
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
  );
}
