"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface UploadedFile {
  file: File;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
  presignedUrl?: string;
}

interface VideoUploaderProps {
  onUploadComplete?: (fileKey: string, fileUrl: string) => void;
  onError?: (error: string) => void;
  maxSize?: number; // in bytes
  className?: string;
}

const ACCEPTED_VIDEO_TYPES = {
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
  "video/x-msvideo": [".avi"],
  "video/x-matroska": [".mkv"],
};

export function VideoUploader({
  onUploadComplete,
  onError,
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB default
  className,
}: VideoUploaderProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const uploadFile = async (file: File) => {
    setUploadedFile({
      file,
      progress: 0,
      status: "uploading",
    });

    try {
      // Request presigned URL
      const response = await fetch("/api/sources/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, fileKey, fileUrl } = await response.json();

      setUploadedFile((prev) =>
        prev ? { ...prev, presignedUrl: uploadUrl } : null
      );

      // Upload to presigned URL with progress tracking
      await uploadWithProgress(file, uploadUrl, (progress) => {
        setUploadedFile((prev) =>
          prev ? { ...prev, progress } : null
        );
      });

      setUploadedFile((prev) =>
        prev ? { ...prev, progress: 100, status: "success" } : null
      );

      onUploadComplete?.(fileKey, fileUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setUploadedFile((prev) =>
        prev ? { ...prev, status: "error", error: errorMessage } : null
      );
      onError?.(errorMessage);
    }
  };

  const uploadWithProgress = (
    file: File,
    url: string,
    onProgress: (progress: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadFile(acceptedFiles[0]);
      }
    },
    [onUploadComplete, onError]
  );

  const { getRootProps, getInputProps, isDragReject, fileRejections } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_VIDEO_TYPES,
      maxSize,
      multiple: false,
      onDragEnter: () => setIsDragActive(true),
      onDragLeave: () => setIsDragActive(false),
      onDropAccepted: () => setIsDragActive(false),
      onDropRejected: () => setIsDragActive(false),
    });

  const handleRetry = () => {
    if (uploadedFile) {
      uploadFile(uploadedFile.file);
    }
  };

  const handleClear = () => {
    setUploadedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className={cn("w-full", className)}>
      {!uploadedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive && !isDragReject
              ? "border-primary bg-primary/5"
              : isDragReject
              ? "border-destructive bg-destructive/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} data-testid="file-input" />
          <div className="flex flex-col items-center gap-4">
            <div
              className={cn(
                "p-4 rounded-full",
                isDragActive && !isDragReject
                  ? "bg-primary/10"
                  : isDragReject
                  ? "bg-destructive/10"
                  : "bg-muted"
              )}
            >
              <Upload
                className={cn(
                  "h-8 w-8",
                  isDragActive && !isDragReject
                    ? "text-primary"
                    : isDragReject
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {isDragActive
                  ? isDragReject
                    ? "Invalid file type"
                    : "Drop the video here"
                  : "Drag and drop a video file"}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse your files
              </p>
              <p className="text-xs text-muted-foreground">
                Supported formats: MP4, WebM, MOV, AVI, MKV (max{" "}
                {formatFileSize(maxSize)})
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {uploadedFile.status === "success" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {uploadedFile.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-medium truncate max-w-[300px]">
                      {uploadedFile.file.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  {formatFileSize(uploadedFile.file.size)}
                </div>

                {uploadedFile.status === "uploading" && (
                  <div className="space-y-2">
                    <Progress value={uploadedFile.progress} />
                    <p className="text-sm text-muted-foreground">
                      Uploading... {uploadedFile.progress}%
                    </p>
                  </div>
                )}

                {uploadedFile.status === "success" && (
                  <p className="text-sm text-green-600">
                    Upload complete!
                  </p>
                )}

                {uploadedFile.status === "error" && (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">
                      {uploadedFile.error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                    >
                      Retry Upload
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {fileRejections.length > 0 && (
        <div className="mt-4 p-4 bg-destructive/10 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">File rejected</span>
          </div>
          <p className="mt-1 text-sm text-destructive">
            {fileRejections[0].errors[0].message}
          </p>
        </div>
      )}
    </div>
  );
}
