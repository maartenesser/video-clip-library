"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Video, ExternalLink, User, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcessingStatus, type JobStatus, type JobType } from "@/components/processing-status";
import { ClipCard } from "@/components/clip-card";

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface Clip {
  id: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  tags: Tag[];
}

interface ProcessingJob {
  id: string;
  jobType: JobType;
  status: JobStatus;
  progressPercent: number;
  errorMessage: string | null;
  createdAt: string;
}

interface Source {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  creatorName: string | null;
  originalFileUrl: string;
  durationSeconds: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  clips: Clip[];
  processingJobs: ProcessingJob[];
}

const statusVariants: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "processing" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "processing" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function SourceDetailPage() {
  const params = useParams();
  const sourceId = params.id as string;

  const [source, setSource] = useState<Source | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSource = useCallback(async () => {
    try {
      const response = await fetch(`/api/sources/${sourceId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Source not found");
        }
        throw new Error("Failed to fetch source");
      }

      const data = await response.json();

      // Transform API response
      const transformedSource: Source = {
        id: data.id,
        title: data.title,
        description: data.description,
        sourceType: data.source_type,
        creatorName: data.creator_name,
        originalFileUrl: data.original_file_url,
        durationSeconds: data.duration_seconds,
        status: data.status,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        clips: (data.clips || []).map((clip: any) => ({
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
        })),
        processingJobs: (data.processing_jobs || []).map((job: any) => ({
          id: job.id,
          jobType: job.job_type as JobType,
          status: job.status as JobStatus,
          progressPercent: job.progress_percent,
          errorMessage: job.error_message,
          createdAt: job.created_at,
        })),
      };

      setSource(transformedSource);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    fetchSource();
  }, [fetchSource]);

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

  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="aspect-video rounded-lg" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">Error</CardTitle>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Link href="/sources">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sources
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!source) return null;

  const statusConfig = statusVariants[source.status] || statusVariants.pending;

  return (
    <div className="container py-8 space-y-6">
      {/* Back button */}
      <Link href="/sources">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Sources
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{source.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            <Badge variant="outline">{source.sourceType}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video player */}
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={source.originalFileUrl}
                  controls
                  className="w-full h-full"
                  poster={undefined}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabs for clips and details */}
          <Tabs defaultValue="clips" className="w-full">
            <TabsList>
              <TabsTrigger value="clips">
                Clips ({source.clips.length})
              </TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="clips" className="mt-4">
              {source.clips.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {source.clips.map((clip) => (
                    <ClipCard
                      key={clip.id}
                      id={clip.id}
                      thumbnailUrl={clip.thumbnailUrl}
                      fileUrl={clip.fileUrl}
                      durationSeconds={clip.durationSeconds}
                      transcriptSegment={clip.transcriptSegment}
                      tags={clip.tags}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {source.status === "processing" ? (
                      <p>Clips are being generated...</p>
                    ) : source.status === "pending" ? (
                      <p>Waiting for processing to start</p>
                    ) : source.status === "failed" ? (
                      <p>Processing failed - no clips generated</p>
                    ) : (
                      <p>No clips generated for this source</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  {source.description && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        Description
                      </h3>
                      <p>{source.description}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {source.creatorName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Creator</p>
                          <p className="font-medium">{source.creatorName}</p>
                        </div>
                      </div>
                    )}

                    {source.durationSeconds && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Duration</p>
                          <p className="font-medium">
                            {formatDuration(source.durationSeconds)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Uploaded</p>
                        <p className="font-medium">
                          {format(new Date(source.createdAt), "PPP")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Source Type</p>
                        <p className="font-medium capitalize">{source.sourceType}</p>
                      </div>
                    </div>
                  </div>

                  {source.errorMessage && (
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <p className="text-sm font-medium text-destructive">
                        Error: {source.errorMessage}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Processing status */}
          <ProcessingStatus
            sourceId={source.id}
            jobs={source.processingJobs}
            onRefresh={fetchSource}
            enableRealtime={
              source.status === "processing" || source.status === "pending"
            }
          />

          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Clips</span>
                <span className="font-medium">{source.clips.length}</span>
              </div>
              {source.durationSeconds && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source Duration</span>
                  <span className="font-medium">
                    {formatDuration(source.durationSeconds)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">
                  {formatDistanceToNow(new Date(source.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
