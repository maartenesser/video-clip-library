"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface ClipCardProps {
  id: string;
  thumbnailUrl?: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment?: string | null;
  tags?: Tag[];
  onClick?: () => void;
  className?: string;
}

export function ClipCard({
  id,
  thumbnailUrl,
  fileUrl,
  durationSeconds,
  transcriptSegment,
  tags = [],
  onClick,
  className,
}: ClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay may be blocked
        });
      }
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const getTagColor = (color?: string | null) => {
    if (!color) return undefined;
    // If it's a valid hex color, use it as background
    if (color.startsWith("#")) {
      return { backgroundColor: color, color: getContrastColor(color) };
    }
    return undefined;
  };

  const getContrastColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  };

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
        className
      )}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="clip-card"
    >
      {/* Video/Thumbnail container */}
      <div className="relative aspect-video bg-muted">
        {/* Thumbnail (shown when not hovered) */}
        {thumbnailUrl && !isHovered && (
          <img
            src={thumbnailUrl}
            alt="Clip thumbnail"
            className="w-full h-full object-cover"
            data-testid="clip-thumbnail"
          />
        )}

        {/* Video preview (shown on hover) */}
        <video
          ref={videoRef}
          src={fileUrl}
          muted
          loop
          playsInline
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          data-testid="clip-video"
        />

        {/* Play/Pause indicator */}
        {!thumbnailUrl && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}

        {/* Hover play indicator */}
        {isHovered && isPlaying && (
          <div className="absolute top-2 left-2 p-1.5 bg-black/50 rounded-full">
            <Pause className="h-3 w-3 text-white" />
          </div>
        )}

        {/* Duration overlay */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 rounded text-xs text-white font-medium">
          {formatDuration(durationSeconds)}
        </div>
      </div>

      <CardContent className="p-3">
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2" data-testid="clip-tags">
            {tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs"
                style={getTagColor(tag.color)}
              >
                {tag.name}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Transcript preview */}
        {transcriptSegment && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {transcriptSegment}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
