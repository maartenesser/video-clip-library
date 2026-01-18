"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Film,
  Plus,
  Trash2,
  GripVertical,
  Download,
  Loader2,
  Check,
  X,
  Play,
  Type,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ClipData {
  id: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  durationSeconds: number;
  transcriptSegment: string | null;
}

interface AssemblyJob {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "failed";
  clip_count: number;
  file_url?: string;
  duration_seconds?: number;
  error_message?: string;
  created_at: string;
}

interface SubtitleStyle {
  font: string;
  size: number;
  position: string;
  color: string;
}

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  font: "Arial",
  size: 24,
  position: "bottom",
  color: "#FFFFFF",
};

export default function AssemblePage() {
  const [availableClips, setAvailableClips] = useState<ClipData[]>([]);
  const [selectedClips, setSelectedClips] = useState<ClipData[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(true);
  const [isClipDialogOpen, setIsClipDialogOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [useSmartTransitions, setUseSmartTransitions] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<AssemblyJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<AssemblyJob[]>([]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch available clips and check for clips from chat or clips page
  useEffect(() => {
    const fetchClips = async () => {
      try {
        const response = await fetch("/api/clips?limit=100");
        if (response.ok) {
          const data = await response.json();
          const clips = data.data.map((clip: any) => ({
            id: clip.id,
            thumbnailUrl: clip.thumbnail_url,
            fileUrl: clip.file_url,
            durationSeconds: clip.duration_seconds,
            transcriptSegment: clip.transcript_segment,
          }));
          setAvailableClips(clips);

          // Check for clips added from clips page (assemblyClipIds)
          const clipIds = localStorage.getItem("assemblyClipIds");
          if (clipIds) {
            try {
              const parsedIds = JSON.parse(clipIds) as string[];
              if (parsedIds.length > 0) {
                const selectedFromIds = clips.filter((c: ClipData) =>
                  parsedIds.includes(c.id)
                );
                if (selectedFromIds.length > 0) {
                  setSelectedClips(selectedFromIds);
                }
              }
            } catch (e) {
              console.error("Error parsing assembly clip IDs:", e);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching clips:", error);
      } finally {
        setIsLoadingClips(false);
      }
    };

    fetchClips();

    // Check for clips added from chat (legacy format)
    const chatClips = localStorage.getItem("assemblyClips");
    if (chatClips) {
      try {
        const parsedClips = JSON.parse(chatClips) as ClipData[];
        if (parsedClips.length > 0) {
          setSelectedClips(parsedClips);
          // Clear localStorage after loading
          localStorage.removeItem("assemblyClips");
        }
      } catch (e) {
        console.error("Error parsing assembly clips from localStorage:", e);
        localStorage.removeItem("assemblyClips");
      }
    }
  }, []);

  // Fetch recent assembly jobs
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch("/api/assemble?limit=5");
        if (response.ok) {
          const data = await response.json();
          setRecentJobs(data.data);
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
      }
    };

    fetchJobs();
  }, []);

  // Poll for job status updates
  useEffect(() => {
    if (!currentJob || currentJob.status === "completed" || currentJob.status === "failed") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/assemble/${currentJob.id}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentJob(data);

          if (data.status === "completed" || data.status === "failed") {
            // Refresh recent jobs
            const jobsResponse = await fetch("/api/assemble?limit=5");
            if (jobsResponse.ok) {
              const jobsData = await jobsResponse.json();
              setRecentJobs(jobsData.data);
            }
          }
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = selectedClips.reduce((sum, clip) => sum + clip.durationSeconds, 0);

  const handleAddClip = (clip: ClipData) => {
    if (!selectedClips.find((c) => c.id === clip.id)) {
      setSelectedClips([...selectedClips, clip]);
    }
  };

  const handleRemoveClip = (clipId: string) => {
    setSelectedClips(selectedClips.filter((c) => c.id !== clipId));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newClips = [...selectedClips];
    const [removed] = newClips.splice(draggedIndex, 1);
    newClips.splice(index, 0, removed);
    setSelectedClips(newClips);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async () => {
    if (selectedClips.length === 0 || !title.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          clip_ids: selectedClips.map((c) => c.id),
          include_subtitles: includeSubtitles,
          subtitle_style: includeSubtitles ? subtitleStyle : undefined,
          use_smart_transitions: useSmartTransitions,
          ai_prompt: aiPrompt.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create assembly job");
      }

      const data = await response.json();
      setCurrentJob(data);

      // Clear assembly from localStorage
      localStorage.removeItem("assemblyClipIds");

      // Reset form
      setSelectedClips([]);
      setTitle("");
      setAiPrompt("");
    } catch (error) {
      console.error("Error creating assembly job:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "processing":
        return <Badge variant="default">Processing</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assemble Video</h1>
        <p className="text-muted-foreground">
          Combine clips into a single video with optional subtitles
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main assembly area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Video Title</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Enter a title for your assembled video"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Selected clips */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Selected Clips</CardTitle>
                  <CardDescription>
                    {selectedClips.length} clip{selectedClips.length !== 1 ? "s" : ""} • Total:{" "}
                    {formatDuration(totalDuration)}
                  </CardDescription>
                </div>
                <Dialog open={isClipDialogOpen} onOpenChange={setIsClipDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Clips
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Select Clips</DialogTitle>
                      <DialogDescription>
                        Choose clips to add to your assembly
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                      {isLoadingClips ? (
                        <div className="col-span-full flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : availableClips.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          No clips available
                        </div>
                      ) : (
                        availableClips.map((clip) => {
                          const isSelected = selectedClips.some((c) => c.id === clip.id);
                          return (
                            <button
                              key={clip.id}
                              onClick={() => {
                                if (isSelected) {
                                  handleRemoveClip(clip.id);
                                } else {
                                  handleAddClip(clip);
                                }
                              }}
                              className={cn(
                                "relative rounded-lg overflow-hidden border-2 transition-all",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/20"
                                  : "border-transparent hover:border-muted-foreground/30"
                              )}
                            >
                              <div className="aspect-video bg-muted relative">
                                {clip.thumbnailUrl ? (
                                  <img
                                    src={clip.thumbnailUrl}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Play className="h-8 w-8 text-muted-foreground/50" />
                                  </div>
                                )}
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 rounded text-xs text-white">
                                  {formatDuration(clip.durationSeconds)}
                                </div>
                                {isSelected && (
                                  <div className="absolute top-1 right-1 p-1 bg-primary rounded-full">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                              {clip.transcriptSegment && (
                                <p className="text-xs text-muted-foreground p-2 line-clamp-2 text-left">
                                  {clip.transcriptSegment}
                                </p>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {selectedClips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Film className="h-12 w-12 mb-4 opacity-50" />
                  <p>No clips selected</p>
                  <p className="text-sm">Click "Add Clips" to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedClips.map((clip, index) => (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border bg-card transition-all cursor-move",
                        draggedIndex === index && "opacity-50 border-primary"
                      )}
                    >
                      <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-20 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                          {clip.thumbnailUrl ? (
                            <img
                              src={clip.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {clip.transcriptSegment || `Clip ${index + 1}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(clip.durationSeconds)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveClip(clip.id)}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subtitle options */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                <CardTitle className="text-lg">Subtitles</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-subtitles"
                  checked={includeSubtitles}
                  onCheckedChange={(checked) => setIncludeSubtitles(checked as boolean)}
                />
                <Label htmlFor="include-subtitles">Include burned-in subtitles</Label>
              </div>

              {includeSubtitles && (
                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="font">Font</Label>
                    <Select
                      value={subtitleStyle.font}
                      onValueChange={(value) =>
                        setSubtitleStyle({ ...subtitleStyle, font: value })
                      }
                    >
                      <SelectTrigger id="font">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Verdana">Verdana</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Select
                      value={subtitleStyle.size.toString()}
                      onValueChange={(value) =>
                        setSubtitleStyle({ ...subtitleStyle, size: parseInt(value) })
                      }
                    >
                      <SelectTrigger id="size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="18">Small (18px)</SelectItem>
                        <SelectItem value="24">Medium (24px)</SelectItem>
                        <SelectItem value="32">Large (32px)</SelectItem>
                        <SelectItem value="48">Extra Large (48px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Select
                      value={subtitleStyle.position}
                      onValueChange={(value) =>
                        setSubtitleStyle({ ...subtitleStyle, position: value })
                      }
                    >
                      <SelectTrigger id="position">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="middle">Middle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="color"
                        type="color"
                        value={subtitleStyle.color}
                        onChange={(e) =>
                          setSubtitleStyle({ ...subtitleStyle, color: e.target.value })
                        }
                        className="w-12 h-9 p-1"
                      />
                      <Input
                        value={subtitleStyle.color}
                        onChange={(e) =>
                          setSubtitleStyle({ ...subtitleStyle, color: e.target.value })
                        }
                        className="flex-1"
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transitions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <CardTitle className="text-lg">Transitions</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="smart-transitions"
                  checked={useSmartTransitions}
                  onCheckedChange={(checked) => setUseSmartTransitions(checked as boolean)}
                />
                <Label htmlFor="smart-transitions">
                  Use smooth crossfade transitions between clips
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Adds 0.5 second crossfade transitions for a professional look
              </p>
            </CardContent>
          </Card>

          {/* AI Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <CardTitle className="text-lg">AI Guidance</CardTitle>
              </div>
              <CardDescription>
                Provide context to help create a better video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="E.g., 'This is for a YouTube Short about product benefits. Keep the energy high and include a call to action at the end.'"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Your prompt helps optimize clip order, transitions, and pacing
              </p>
            </CardContent>
          </Card>

          {/* Submit button */}
          <Button
            size="lg"
            className="w-full"
            disabled={selectedClips.length === 0 || !title.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Film className="h-4 w-4 mr-2" />
                Assemble Video
              </>
            )}
          </Button>
        </div>

        {/* Sidebar - Job status */}
        <div className="space-y-6">
          {/* Current job status */}
          {currentJob && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Current Job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{currentJob.title}</span>
                  {getStatusBadge(currentJob.status)}
                </div>

                {currentJob.status === "processing" && (
                  <div className="space-y-2">
                    <Progress value={undefined} className="animate-pulse" />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing {currentJob.clip_count} clips...
                    </p>
                  </div>
                )}

                {currentJob.status === "completed" && currentJob.file_url && (
                  <div className="space-y-3">
                    <div className="aspect-video bg-muted rounded overflow-hidden">
                      <video
                        src={currentJob.file_url}
                        controls
                        className="w-full h-full"
                      />
                    </div>
                    <Button asChild className="w-full">
                      <a href={currentJob.file_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download Video
                      </a>
                    </Button>
                  </div>
                )}

                {currentJob.status === "failed" && (
                  <div className="p-3 bg-destructive/10 rounded-lg">
                    <p className="text-sm text-destructive">
                      {currentJob.error_message || "An error occurred"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent jobs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Assemblies</CardTitle>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No assemblies yet
                </p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.clip_count} clips •{" "}
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(job.status)}
                        {job.status === "completed" && job.file_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={job.file_url} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
