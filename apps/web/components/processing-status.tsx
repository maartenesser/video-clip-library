"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type JobType =
  | "transcription"
  | "clip_detection"
  | "thumbnail_generation"
  | "tagging";

interface ProcessingJob {
  id: string;
  jobType: JobType;
  status: JobStatus;
  progressPercent: number;
  errorMessage?: string | null;
  createdAt: string;
}

interface ProcessingStatusProps {
  sourceId: string;
  jobs: ProcessingJob[];
  onRefresh?: () => void;
  enableRealtime?: boolean;
  className?: string;
}

const jobTypeLabels: Record<JobType, string> = {
  transcription: "Transcription",
  clip_detection: "Clip Detection",
  thumbnail_generation: "Thumbnails",
  tagging: "Auto-Tagging",
};

const statusConfig: Record<
  JobStatus,
  {
    icon: React.ElementType;
    color: string;
    label: string;
  }
> = {
  pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-500", label: "Processing" },
  completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
  failed: { icon: AlertCircle, color: "text-destructive", label: "Failed" },
  cancelled: { icon: AlertCircle, color: "text-muted-foreground", label: "Cancelled" },
};

export function ProcessingStatus({
  sourceId,
  jobs,
  onRefresh,
  enableRealtime = false,
  className,
}: ProcessingStatusProps) {
  const [currentJobs, setCurrentJobs] = useState(jobs);

  // Update jobs when prop changes
  useEffect(() => {
    setCurrentJobs(jobs);
  }, [jobs]);

  // Realtime polling (simplified - in production use Supabase realtime)
  useEffect(() => {
    if (!enableRealtime) return;

    const hasActiveJobs = currentJobs.some(
      (job) => job.status === "running" || job.status === "pending"
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      onRefresh?.();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [enableRealtime, currentJobs, onRefresh]);

  const overallProgress = React.useMemo(() => {
    if (currentJobs.length === 0) return 0;
    const totalProgress = currentJobs.reduce(
      (sum, job) => sum + job.progressPercent,
      0
    );
    return Math.round(totalProgress / currentJobs.length);
  }, [currentJobs]);

  const allCompleted = currentJobs.every(
    (job) => job.status === "completed" || job.status === "cancelled"
  );

  const hasFailed = currentJobs.some((job) => job.status === "failed");

  const getOverallStatus = (): JobStatus => {
    if (hasFailed) return "failed";
    if (allCompleted) return "completed";
    if (currentJobs.some((job) => job.status === "running")) return "running";
    return "pending";
  };

  const overallStatus = getOverallStatus();
  const OverallIcon = statusConfig[overallStatus].icon;

  if (currentJobs.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            No processing jobs
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="processing-status">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Processing Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <OverallIcon
              className={cn(
                "h-5 w-5",
                statusConfig[overallStatus].color,
                overallStatus === "running" && "animate-spin"
              )}
            />
            <Badge
              variant={
                overallStatus === "completed"
                  ? "success"
                  : overallStatus === "failed"
                  ? "destructive"
                  : overallStatus === "running"
                  ? "processing"
                  : "secondary"
              }
            >
              {statusConfig[overallStatus].label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} />
        </div>

        {/* Individual jobs */}
        <div className="space-y-3">
          {currentJobs.map((job) => {
            const JobIcon = statusConfig[job.status].icon;
            return (
              <div
                key={job.id}
                className="flex items-center gap-3"
                data-testid={`job-${job.id}`}
              >
                <JobIcon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    statusConfig[job.status].color,
                    job.status === "running" && "animate-spin"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {jobTypeLabels[job.jobType]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {job.progressPercent}%
                    </span>
                  </div>
                  {job.status === "running" && (
                    <Progress
                      value={job.progressPercent}
                      className="h-1 mt-1"
                    />
                  )}
                  {job.status === "failed" && job.errorMessage && (
                    <p className="text-xs text-destructive mt-1 truncate">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
