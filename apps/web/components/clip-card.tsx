"use client";

import * as React from "react";
import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Play, Pause, Star, Copy } from "lucide-react";
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
  qualityScore?: number;
  groupCount?: number;
  groupType?: 'duplicate' | 'same_topic' | 'multiple_takes';
  isInAssembly?: boolean;
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
  qualityScore,
  groupCount = 0,
  groupType,
  isInAssembly = false,
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

  const getQualityColor = (score: number) => {
    if (score >= 4.5) return "bg-green-500";
    if (score >= 4.0) return "bg-green-400";
    if (score >= 3.5) return "bg-yellow-400";
    if (score >= 3.0) return "bg-orange-400";
    return "bg-red-400";
  };

  const getGroupBorderColor = (type?: string) => {
    switch (type) {
      case 'duplicate': return "border-l-4 border-l-red-500";
      case 'same_topic': return "border-l-4 border-l-blue-500";
      case 'multiple_takes': return "border-l-4 border-l-purple-500";
      default: return "";
    }
  };

  const getAssemblyStyle = () => {
    return isInAssembly ? "ring-2 ring-primary ring-offset-2" : "";
  };

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick]
  );

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        getGroupBorderColor(groupType),
        getAssemblyStyle(),
        className
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      role="button"
      aria-label={transcriptSegment ? `Video clip: ${transcriptSegment.substring(0, 50)}...` : `Video clip - ${formatDuration(durationSeconds)}`}
      data-testid="clip-card"
    >
      {/* Video/Thumbnail container */}
      <div className="relative aspect-video bg-muted">
        {/* Thumbnail (shown when not hovered) */}
        {thumbnailUrl && !isHovered && (
          <Image
            src={thumbnailUrl}
            alt="Clip thumbnail"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            data-testid="clip-thumbnail"
            unoptimized={thumbnailUrl.startsWith('http')}
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

        {/* Quality score badge */}
        {qualityScore !== undefined && (
          <div
            className={cn(
              "absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium text-white flex items-center gap-0.5",
              getQualityColor(qualityScore)
            )}
            data-testid="quality-score"
            title={`Quality: ${qualityScore.toFixed(1)}/5`}
          >
            <Star className="h-3 w-3 fill-current" />
            {qualityScore.toFixed(1)}
          </div>
        )}

        {/* Group indicator */}
        {groupCount > 0 && (
          <div
            className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-purple-500 rounded text-xs font-medium text-white flex items-center gap-0.5"
            data-testid="group-badge"
            title={`Part of ${groupCount} group${groupCount > 1 ? 's' : ''}`}
          >
            <Copy className="h-3 w-3" />
            {groupCount}
          </div>
        )}
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
