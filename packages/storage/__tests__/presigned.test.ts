import { describe, it, expect } from 'vitest';
import {
  generateSourceKey,
  generateClipKey,
  generateThumbnailKey,
  generateSourceThumbnailKey,
  parseStorageKey,
  getContentType,
  getExtensionFromContentType,
  STORAGE_PREFIXES,
} from '../src/presigned.js';

describe('Key Generation Functions', () => {
  describe('generateSourceKey', () => {
    it('should generate correct key with default filename', () => {
      const key = generateSourceKey('abc123');
      expect(key).toBe('sources/abc123/original.mp4');
    });

    it('should generate correct key with custom filename', () => {
      const key = generateSourceKey('abc123', 'video.mov');
      expect(key).toBe('sources/abc123/video.mov');
    });

    it('should allow alphanumeric IDs', () => {
      expect(() => generateSourceKey('abc123XYZ')).not.toThrow();
      expect(generateSourceKey('abc123XYZ')).toBe(
        'sources/abc123XYZ/original.mp4'
      );
    });

    it('should allow hyphens in IDs', () => {
      expect(() => generateSourceKey('abc-123-xyz')).not.toThrow();
      expect(generateSourceKey('abc-123-xyz')).toBe(
        'sources/abc-123-xyz/original.mp4'
      );
    });

    it('should allow underscores in IDs', () => {
      expect(() => generateSourceKey('abc_123_xyz')).not.toThrow();
      expect(generateSourceKey('abc_123_xyz')).toBe(
        'sources/abc_123_xyz/original.mp4'
      );
    });

    it('should throw on empty ID', () => {
      expect(() => generateSourceKey('')).toThrow(
        'sourceId must be a non-empty string'
      );
    });

    it('should throw on ID with invalid characters', () => {
      expect(() => generateSourceKey('abc/123')).toThrow(
        'sourceId contains invalid characters'
      );
      expect(() => generateSourceKey('abc..123')).toThrow(
        'sourceId contains invalid characters'
      );
      expect(() => generateSourceKey('../etc/passwd')).toThrow(
        'sourceId contains invalid characters'
      );
    });
  });

  describe('generateClipKey', () => {
    it('should generate correct key with default extension', () => {
      const key = generateClipKey('xyz789');
      expect(key).toBe('clips/xyz789.mp4');
    });

    it('should generate correct key with custom extension', () => {
      const key = generateClipKey('xyz789', 'webm');
      expect(key).toBe('clips/xyz789.webm');
    });

    it('should throw on empty ID', () => {
      expect(() => generateClipKey('')).toThrow(
        'clipId must be a non-empty string'
      );
    });

    it('should throw on ID with path traversal attempt', () => {
      expect(() => generateClipKey('../secret')).toThrow(
        'clipId contains invalid characters'
      );
    });
  });

  describe('generateThumbnailKey', () => {
    it('should generate correct key with default extension', () => {
      const key = generateThumbnailKey('xyz789');
      expect(key).toBe('thumbnails/xyz789.jpg');
    });

    it('should generate correct key with png extension', () => {
      const key = generateThumbnailKey('xyz789', 'png');
      expect(key).toBe('thumbnails/xyz789.png');
    });

    it('should generate correct key with webp extension', () => {
      const key = generateThumbnailKey('xyz789', 'webp');
      expect(key).toBe('thumbnails/xyz789.webp');
    });

    it('should throw on empty ID', () => {
      expect(() => generateThumbnailKey('')).toThrow(
        'clipId must be a non-empty string'
      );
    });
  });

  describe('generateSourceThumbnailKey', () => {
    it('should generate correct key with default extension', () => {
      const key = generateSourceThumbnailKey('abc123');
      expect(key).toBe('sources/abc123/thumbnail.jpg');
    });

    it('should generate correct key with png extension', () => {
      const key = generateSourceThumbnailKey('abc123', 'png');
      expect(key).toBe('sources/abc123/thumbnail.png');
    });

    it('should throw on empty ID', () => {
      expect(() => generateSourceThumbnailKey('')).toThrow(
        'sourceId must be a non-empty string'
      );
    });
  });
});

describe('parseStorageKey', () => {
  describe('clip keys', () => {
    it('should parse clip key correctly', () => {
      const info = parseStorageKey('clips/xyz789.mp4');
      expect(info).toEqual({
        type: 'clip',
        id: 'xyz789',
        extension: 'mp4',
      });
    });

    it('should parse clip key with different extension', () => {
      const info = parseStorageKey('clips/abc-123.webm');
      expect(info).toEqual({
        type: 'clip',
        id: 'abc-123',
        extension: 'webm',
      });
    });
  });

  describe('thumbnail keys', () => {
    it('should parse thumbnail key correctly', () => {
      const info = parseStorageKey('thumbnails/xyz789.jpg');
      expect(info).toEqual({
        type: 'thumbnail',
        id: 'xyz789',
        extension: 'jpg',
      });
    });

    it('should parse thumbnail key with png extension', () => {
      const info = parseStorageKey('thumbnails/abc_123.png');
      expect(info).toEqual({
        type: 'thumbnail',
        id: 'abc_123',
        extension: 'png',
      });
    });
  });

  describe('source keys', () => {
    it('should parse source key correctly', () => {
      const info = parseStorageKey('sources/abc123/original.mp4');
      expect(info).toEqual({
        type: 'source',
        id: 'abc123',
        filename: 'original.mp4',
      });
    });

    it('should parse source key with custom filename', () => {
      const info = parseStorageKey('sources/abc123/my-video.mov');
      expect(info).toEqual({
        type: 'source',
        id: 'abc123',
        filename: 'my-video.mov',
      });
    });

    it('should parse source thumbnail key', () => {
      const info = parseStorageKey('sources/abc123/thumbnail.jpg');
      expect(info).toEqual({
        type: 'source',
        id: 'abc123',
        filename: 'thumbnail.jpg',
      });
    });
  });

  describe('invalid keys', () => {
    it('should return null for invalid key format', () => {
      expect(parseStorageKey('invalid/path/to/file.mp4')).toBeNull();
      expect(parseStorageKey('file.mp4')).toBeNull();
      expect(parseStorageKey('')).toBeNull();
      expect(parseStorageKey('random-string')).toBeNull();
    });

    it('should return null for partial matches', () => {
      expect(parseStorageKey('clips/')).toBeNull();
      expect(parseStorageKey('thumbnails/')).toBeNull();
      expect(parseStorageKey('sources/abc123')).toBeNull();
    });
  });
});

describe('Content Type Utilities', () => {
  describe('getContentType', () => {
    it('should return correct content type for video extensions', () => {
      expect(getContentType('mp4')).toBe('video/mp4');
      expect(getContentType('mov')).toBe('video/quicktime');
      expect(getContentType('avi')).toBe('video/x-msvideo');
      expect(getContentType('webm')).toBe('video/webm');
      expect(getContentType('mkv')).toBe('video/x-matroska');
    });

    it('should return correct content type for image extensions', () => {
      expect(getContentType('jpg')).toBe('image/jpeg');
      expect(getContentType('jpeg')).toBe('image/jpeg');
      expect(getContentType('png')).toBe('image/png');
      expect(getContentType('webp')).toBe('image/webp');
      expect(getContentType('gif')).toBe('image/gif');
    });

    it('should be case insensitive', () => {
      expect(getContentType('MP4')).toBe('video/mp4');
      expect(getContentType('JPG')).toBe('image/jpeg');
      expect(getContentType('Webm')).toBe('video/webm');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getContentType('xyz')).toBe('application/octet-stream');
      expect(getContentType('unknown')).toBe('application/octet-stream');
    });
  });

  describe('getExtensionFromContentType', () => {
    it('should return correct extension for video content types', () => {
      expect(getExtensionFromContentType('video/mp4')).toBe('mp4');
      expect(getExtensionFromContentType('video/quicktime')).toBe('mov');
      expect(getExtensionFromContentType('video/x-msvideo')).toBe('avi');
      expect(getExtensionFromContentType('video/webm')).toBe('webm');
      expect(getExtensionFromContentType('video/x-matroska')).toBe('mkv');
    });

    it('should return correct extension for image content types', () => {
      expect(getExtensionFromContentType('image/jpeg')).toBe('jpg');
      expect(getExtensionFromContentType('image/png')).toBe('png');
      expect(getExtensionFromContentType('image/webp')).toBe('webp');
      expect(getExtensionFromContentType('image/gif')).toBe('gif');
    });

    it('should be case insensitive', () => {
      expect(getExtensionFromContentType('VIDEO/MP4')).toBe('mp4');
      expect(getExtensionFromContentType('Image/JPEG')).toBe('jpg');
    });

    it('should return bin for unknown content types', () => {
      expect(getExtensionFromContentType('application/octet-stream')).toBe(
        'bin'
      );
      expect(getExtensionFromContentType('unknown/type')).toBe('bin');
    });
  });
});

describe('STORAGE_PREFIXES', () => {
  it('should have correct prefix values', () => {
    expect(STORAGE_PREFIXES.SOURCES).toBe('sources/');
    expect(STORAGE_PREFIXES.CLIPS).toBe('clips/');
    expect(STORAGE_PREFIXES.THUMBNAILS).toBe('thumbnails/');
  });

  it('should be readonly', () => {
    // TypeScript const assertion makes it readonly, this tests the values exist
    expect(Object.keys(STORAGE_PREFIXES)).toHaveLength(3);
  });
});

describe('Key Generation Consistency', () => {
  it('should generate keys that can be parsed back', () => {
    const sourceId = 'src-abc-123';
    const clipId = 'clip-xyz-789';

    // Source key
    const sourceKey = generateSourceKey(sourceId);
    const sourceInfo = parseStorageKey(sourceKey);
    expect(sourceInfo?.type).toBe('source');
    expect(sourceInfo?.id).toBe(sourceId);

    // Clip key
    const clipKey = generateClipKey(clipId);
    const clipInfo = parseStorageKey(clipKey);
    expect(clipInfo?.type).toBe('clip');
    expect(clipInfo?.id).toBe(clipId);

    // Thumbnail key
    const thumbnailKey = generateThumbnailKey(clipId);
    const thumbnailInfo = parseStorageKey(thumbnailKey);
    expect(thumbnailInfo?.type).toBe('thumbnail');
    expect(thumbnailInfo?.id).toBe(clipId);
  });

  it('should maintain consistent file organization pattern', () => {
    const sourceId = 'source-1';
    const clipId = 'clip-1';

    expect(generateSourceKey(sourceId)).toMatch(/^sources\/[^/]+\/[^/]+$/);
    expect(generateClipKey(clipId)).toMatch(/^clips\/[^/]+\.\w+$/);
    expect(generateThumbnailKey(clipId)).toMatch(/^thumbnails\/[^/]+\.\w+$/);
  });
});
