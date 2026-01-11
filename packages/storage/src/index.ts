/**
 * @video-clip-library/storage
 *
 * Cloudflare R2 storage client for the video clip library system.
 * Provides presigned URL generation for uploads/downloads and file key utilities.
 */

// Main R2 client
export { R2Client, createR2ClientFromEnv } from './r2-client.js';

// Key generation utilities
export {
  generateSourceKey,
  generateClipKey,
  generateThumbnailKey,
  generateSourceThumbnailKey,
  parseStorageKey,
  getContentType,
  getExtensionFromContentType,
  STORAGE_PREFIXES,
  type StorageKeyInfo,
} from './presigned.js';

// Types
export {
  type R2Config,
  type UploadUrlOptions,
  type DownloadUrlOptions,
  type DeleteResult,
  type VideoContentType,
  type ImageContentType,
  VIDEO_CONTENT_TYPES,
  IMAGE_CONTENT_TYPES,
  DEFAULT_EXPIRATION,
} from './types.js';
