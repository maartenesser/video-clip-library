"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoUploader } from "@/components/video-uploader";

interface UploadFormData {
  title: string;
  description: string;
  sourceType: string;
  creatorName: string;
  fileKey: string;
  fileUrl: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<UploadFormData>({
    title: "",
    description: "",
    sourceType: "upload",
    creatorName: "",
    fileKey: "",
    fileUrl: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleUploadComplete = (fileKey: string, fileUrl: string) => {
    setFormData((prev) => ({
      ...prev,
      fileKey,
      fileUrl,
    }));
    setUploadComplete(true);
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
    setUploadComplete(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fileKey || !formData.fileUrl) {
      setError("Please upload a video file first");
      return;
    }

    if (!formData.title.trim()) {
      setError("Please enter a title");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          source_type: formData.sourceType,
          creator_name: formData.creatorName || null,
          original_file_url: formData.fileUrl,
          original_file_key: formData.fileKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create source");
      }

      const source = await response.json();
      router.push(`/sources/${source.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  const isFormValid = uploadComplete && formData.title.trim().length > 0;

  return (
    <div className="container py-8 max-w-2xl">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-2 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Upload Video</CardTitle>
          <CardDescription>
            Upload a video file to process and generate clips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Video uploader */}
            <div className="space-y-2">
              <Label>Video File</Label>
              <VideoUploader
                onUploadComplete={handleUploadComplete}
                onError={handleUploadError}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter video title"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Enter video description (optional)"
                rows={3}
              />
            </div>

            {/* Source type */}
            <div className="space-y-2">
              <Label htmlFor="sourceType">Source Type</Label>
              <Select
                value={formData.sourceType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, sourceType: value }))
                }
              >
                <SelectTrigger id="sourceType">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">Direct Upload</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Creator name */}
            <div className="space-y-2">
              <Label htmlFor="creatorName">Creator Name</Label>
              <Input
                id="creatorName"
                value={formData.creatorName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    creatorName: e.target.value,
                  }))
                }
                placeholder="Enter creator name (optional)"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-4 bg-destructive/10 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end gap-4">
              <Link href="/">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={!isFormValid || isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isSubmitting ? "Creating..." : "Create Source"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
