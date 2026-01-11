/**
 * Configuration for Cloudflare R2 client
 */
export interface R2Config {
  /**
   * Cloudflare account ID
   */
  accountId: string;

  /**
   * R2 access key ID (from R2 API tokens)
   */
  accessKeyId: string;

  /**
   * R2 secret access key (from R2 API tokens)
   */
  secretAccessKey: string;

  /**
   * R2 bucket name
   */
  bucketName: string;

  /**
   * Optional public URL for the bucket (if public access is enabled)
   * Used for generating public URLs to assets
   */
  publicUrl?: string;
}

/**
 * Options for generating presigned upload URLs
 */
export interface UploadUrlOptions {
  /**
   * The object key (path) in the bucket
   */
  key: string;

  /**
   * Content type of the file being uploaded
   */
  contentType: string;

  /**
   * URL expiration time in seconds (default: 3600 = 1 hour)
   */
  expiresIn?: number;

  /**
   * Optional content length for the upload
   */
  contentLength?: number;
}

/**
 * Options for generating presigned download URLs
 */
export interface DownloadUrlOptions {
  /**
   * The object key (path) in the bucket
   */
  key: string;

  /**
   * URL expiration time in seconds (default: 3600 = 1 hour)
   */
  expiresIn?: number;

  /**
   * Optional filename for Content-Disposition header
   */
  downloadFilename?: string;
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  /**
   * Whether the deletion was successful
   */
  success: boolean;

  /**
   * The key that was deleted
   */
  key: string;

  /**
   * Error message if deletion failed
   */
  error?: string;
}

/**
 * Supported content types for video files
 */
export const VIDEO_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
] as const;

/**
 * Supported content types for image files (thumbnails)
 */
export const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/**
 * Default URL expiration times in seconds
 */
export const DEFAULT_EXPIRATION = {
  /**
   * Upload URL expiration (1 hour)
   */
  UPLOAD: 3600,

  /**
   * Download URL expiration (1 hour)
   */
  DOWNLOAD: 3600,

  /**
   * Short-lived URL expiration (15 minutes)
   */
  SHORT: 900,

  /**
   * Long-lived URL expiration (24 hours)
   */
  LONG: 86400,
} as const;
