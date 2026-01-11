/**
 * File key generation utilities for R2 storage
 *
 * File organization pattern:
 * - sources/{sourceId}/original.mp4 - Original uploaded source videos
 * - clips/{clipId}.mp4 - Generated video clips
 * - thumbnails/{clipId}.jpg - Clip thumbnail images
 */

/**
 * Generate the storage key for a source video
 *
 * @param sourceId - Unique identifier for the source video
 * @param filename - Optional custom filename (defaults to 'original.mp4')
 * @returns Storage key path
 *
 * @example
 * ```typescript
 * const key = generateSourceKey('abc123');
 * // Returns: 'sources/abc123/original.mp4'
 *
 * const customKey = generateSourceKey('abc123', 'video.mov');
 * // Returns: 'sources/abc123/video.mov'
 * ```
 */
export function generateSourceKey(
  sourceId: string,
  filename: string = 'original.mp4'
): string {
  validateId(sourceId, 'sourceId');
  return `sources/${sourceId}/${filename}`;
}

/**
 * Generate the storage key for a clip video
 *
 * @param clipId - Unique identifier for the clip
 * @param extension - File extension (default: 'mp4')
 * @returns Storage key path
 *
 * @example
 * ```typescript
 * const key = generateClipKey('xyz789');
 * // Returns: 'clips/xyz789.mp4'
 *
 * const webmKey = generateClipKey('xyz789', 'webm');
 * // Returns: 'clips/xyz789.webm'
 * ```
 */
export function generateClipKey(
  clipId: string,
  extension: string = 'mp4'
): string {
  validateId(clipId, 'clipId');
  return `clips/${clipId}.${extension}`;
}

/**
 * Generate the storage key for a clip thumbnail
 *
 * @param clipId - Unique identifier for the clip
 * @param extension - Image extension (default: 'jpg')
 * @returns Storage key path
 *
 * @example
 * ```typescript
 * const key = generateThumbnailKey('xyz789');
 * // Returns: 'thumbnails/xyz789.jpg'
 *
 * const pngKey = generateThumbnailKey('xyz789', 'png');
 * // Returns: 'thumbnails/xyz789.png'
 * ```
 */
export function generateThumbnailKey(
  clipId: string,
  extension: string = 'jpg'
): string {
  validateId(clipId, 'clipId');
  return `thumbnails/${clipId}.${extension}`;
}

/**
 * Generate the storage key for a source thumbnail/preview
 *
 * @param sourceId - Unique identifier for the source video
 * @param extension - Image extension (default: 'jpg')
 * @returns Storage key path
 *
 * @example
 * ```typescript
 * const key = generateSourceThumbnailKey('abc123');
 * // Returns: 'sources/abc123/thumbnail.jpg'
 * ```
 */
export function generateSourceThumbnailKey(
  sourceId: string,
  extension: string = 'jpg'
): string {
  validateId(sourceId, 'sourceId');
  return `sources/${sourceId}/thumbnail.${extension}`;
}

/**
 * Parse a storage key to extract its components
 *
 * @param key - Storage key path
 * @returns Parsed key information or null if invalid
 *
 * @example
 * ```typescript
 * const info = parseStorageKey('clips/xyz789.mp4');
 * // Returns: { type: 'clip', id: 'xyz789', extension: 'mp4' }
 *
 * const sourceInfo = parseStorageKey('sources/abc123/original.mp4');
 * // Returns: { type: 'source', id: 'abc123', filename: 'original.mp4' }
 * ```
 */
export function parseStorageKey(key: string): StorageKeyInfo | null {
  // Match clips pattern: clips/{clipId}.{ext}
  const clipMatch = key.match(/^clips\/([^/]+)\.(\w+)$/);
  if (clipMatch) {
    return {
      type: 'clip',
      id: clipMatch[1],
      extension: clipMatch[2],
    };
  }

  // Match thumbnails pattern: thumbnails/{clipId}.{ext}
  const thumbnailMatch = key.match(/^thumbnails\/([^/]+)\.(\w+)$/);
  if (thumbnailMatch) {
    return {
      type: 'thumbnail',
      id: thumbnailMatch[1],
      extension: thumbnailMatch[2],
    };
  }

  // Match sources pattern: sources/{sourceId}/{filename}
  const sourceMatch = key.match(/^sources\/([^/]+)\/(.+)$/);
  if (sourceMatch) {
    return {
      type: 'source',
      id: sourceMatch[1],
      filename: sourceMatch[2],
    };
  }

  return null;
}

/**
 * Get the content type for a file extension
 *
 * @param extension - File extension (without dot)
 * @returns MIME type string
 *
 * @example
 * ```typescript
 * getContentType('mp4');  // Returns: 'video/mp4'
 * getContentType('jpg');  // Returns: 'image/jpeg'
 * ```
 */
export function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    // Video types
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    // Image types
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };

  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Get the file extension from a content type
 *
 * @param contentType - MIME type string
 * @returns File extension (without dot)
 *
 * @example
 * ```typescript
 * getExtensionFromContentType('video/mp4');  // Returns: 'mp4'
 * getExtensionFromContentType('image/jpeg'); // Returns: 'jpg'
 * ```
 */
export function getExtensionFromContentType(contentType: string): string {
  const extensions: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return extensions[contentType.toLowerCase()] || 'bin';
}

/**
 * Validate that an ID is valid for use in storage keys
 *
 * @param id - The ID to validate
 * @param name - Name of the parameter for error messages
 * @throws Error if ID is invalid
 */
function validateId(id: string, name: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error(`${name} must be a non-empty string`);
  }

  // IDs should be alphanumeric with optional hyphens and underscores
  // This prevents path traversal and other security issues
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(
      `${name} contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed.`
    );
  }
}

/**
 * Parsed storage key information
 */
export interface StorageKeyInfo {
  /**
   * Type of stored object
   */
  type: 'source' | 'clip' | 'thumbnail';

  /**
   * The extracted ID (sourceId or clipId)
   */
  id: string;

  /**
   * File extension (for clips and thumbnails)
   */
  extension?: string;

  /**
   * Full filename (for sources)
   */
  filename?: string;
}

/**
 * Storage key prefixes for different object types
 */
export const STORAGE_PREFIXES = {
  SOURCES: 'sources/',
  CLIPS: 'clips/',
  THUMBNAILS: 'thumbnails/',
} as const;
