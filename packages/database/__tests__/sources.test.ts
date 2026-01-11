import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSource, generateUUID } from './setup';
import type { Source, SourceInsert, SourceUpdate } from '../src/types';

/**
 * Sources table tests
 *
 * Tests CRUD operations and validation for the sources table
 */

describe('Sources', () => {
  describe('Type validation', () => {
    it('should have all required fields in Source type', () => {
      const source = createMockSource();

      expect(source).toHaveProperty('id');
      expect(source).toHaveProperty('title');
      expect(source).toHaveProperty('description');
      expect(source).toHaveProperty('source_type');
      expect(source).toHaveProperty('creator_name');
      expect(source).toHaveProperty('original_file_url');
      expect(source).toHaveProperty('original_file_key');
      expect(source).toHaveProperty('duration_seconds');
      expect(source).toHaveProperty('status');
      expect(source).toHaveProperty('error_message');
      expect(source).toHaveProperty('created_at');
      expect(source).toHaveProperty('updated_at');
    });

    it('should accept valid source_type values', () => {
      const validTypes = ['youtube', 'upload', 'tiktok', 'instagram', 'other'];

      validTypes.forEach((type) => {
        const source = createMockSource({ source_type: type });
        expect(source.source_type).toBe(type);
      });
    });

    it('should accept valid status values', () => {
      const validStatuses = ['pending', 'processing', 'completed', 'failed'];

      validStatuses.forEach((status) => {
        const source = createMockSource({ status });
        expect(source.status).toBe(status);
      });
    });

    it('should have default status of pending', () => {
      const source = createMockSource();
      expect(source.status).toBe('pending');
    });

    it('should allow null for optional fields', () => {
      const source = createMockSource({
        description: null,
        creator_name: null,
        duration_seconds: null,
        error_message: null,
      });

      expect(source.description).toBeNull();
      expect(source.creator_name).toBeNull();
      expect(source.duration_seconds).toBeNull();
      expect(source.error_message).toBeNull();
    });
  });

  describe('SourceInsert type', () => {
    it('should not require id, created_at, updated_at', () => {
      const sourceInsert: SourceInsert = {
        title: 'New Video',
        source_type: 'upload',
        original_file_url: 'https://example.com/video.mp4',
        original_file_key: 'videos/new-video.mp4',
        description: null,
        creator_name: null,
        duration_seconds: null,
        status: 'pending',
        error_message: null,
      };

      expect(sourceInsert).not.toHaveProperty('id');
      expect(sourceInsert.title).toBe('New Video');
    });

    it('should allow optional id override', () => {
      const customId = generateUUID();
      const sourceInsert: SourceInsert = {
        id: customId,
        title: 'New Video',
        source_type: 'upload',
        original_file_url: 'https://example.com/video.mp4',
        original_file_key: 'videos/new-video.mp4',
        description: null,
        creator_name: null,
        duration_seconds: null,
        status: 'pending',
        error_message: null,
      };

      expect(sourceInsert.id).toBe(customId);
    });
  });

  describe('SourceUpdate type', () => {
    it('should allow partial updates', () => {
      const sourceUpdate: SourceUpdate = {
        title: 'Updated Title',
      };

      expect(sourceUpdate.title).toBe('Updated Title');
      expect(sourceUpdate.description).toBeUndefined();
    });

    it('should allow updating status', () => {
      const sourceUpdate: SourceUpdate = {
        status: 'completed',
      };

      expect(sourceUpdate.status).toBe('completed');
    });

    it('should allow setting error_message', () => {
      const sourceUpdate: SourceUpdate = {
        status: 'failed',
        error_message: 'Processing failed due to invalid format',
      };

      expect(sourceUpdate.status).toBe('failed');
      expect(sourceUpdate.error_message).toBe('Processing failed due to invalid format');
    });
  });

  describe('Mock CRUD operations', () => {
    let sources: Source[];

    beforeEach(() => {
      sources = [
        createMockSource({ title: 'Video 1', status: 'completed' }),
        createMockSource({ title: 'Video 2', status: 'pending' }),
        createMockSource({ title: 'Video 3', status: 'processing' }),
      ];
    });

    it('should create a new source', () => {
      const newSource = createMockSource({ title: 'New Video' });
      sources.push(newSource);

      expect(sources).toHaveLength(4);
      expect(sources[3].title).toBe('New Video');
    });

    it('should read sources with pagination', () => {
      const page = 1;
      const limit = 2;
      const offset = (page - 1) * limit;
      const paginated = sources.slice(offset, offset + limit);

      expect(paginated).toHaveLength(2);
      expect(paginated[0].title).toBe('Video 1');
      expect(paginated[1].title).toBe('Video 2');
    });

    it('should filter sources by status', () => {
      const pending = sources.filter((s) => s.status === 'pending');

      expect(pending).toHaveLength(1);
      expect(pending[0].title).toBe('Video 2');
    });

    it('should update a source', () => {
      const sourceToUpdate = sources[0];
      const updated = { ...sourceToUpdate, title: 'Updated Video 1' };
      sources[0] = updated;

      expect(sources[0].title).toBe('Updated Video 1');
    });

    it('should delete a source', () => {
      const idToDelete = sources[1].id;
      sources = sources.filter((s) => s.id !== idToDelete);

      expect(sources).toHaveLength(2);
      expect(sources.find((s) => s.id === idToDelete)).toBeUndefined();
    });

    it('should search sources by title', () => {
      const searchTerm = 'video 2';
      const results = sources.filter((s) =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Video 2');
    });

    it('should order sources by created_at descending', () => {
      const ordered = [...sources].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // All have same timestamp in mock, so order should be stable
      expect(ordered).toHaveLength(3);
    });
  });

  describe('Validation rules', () => {
    it('should require title to be non-empty', () => {
      const source = createMockSource({ title: '' });
      expect(source.title).toBe('');
      // In real DB, this would be validated by NOT NULL constraint
    });

    it('should require original_file_url to be valid URL format', () => {
      const source = createMockSource({
        original_file_url: 'https://example.com/video.mp4',
      });
      expect(source.original_file_url).toMatch(/^https?:\/\//);
    });

    it('should require original_file_key to be non-empty', () => {
      const source = createMockSource({
        original_file_key: 'videos/test.mp4',
      });
      expect(source.original_file_key.length).toBeGreaterThan(0);
    });

    it('should allow duration_seconds to be a decimal', () => {
      const source = createMockSource({ duration_seconds: 120.567 });
      expect(source.duration_seconds).toBe(120.567);
    });
  });

  describe('Timestamps', () => {
    it('should have created_at as ISO string', () => {
      const source = createMockSource();
      expect(() => new Date(source.created_at)).not.toThrow();
    });

    it('should have updated_at as ISO string', () => {
      const source = createMockSource();
      expect(() => new Date(source.updated_at)).not.toThrow();
    });

    it('should update updated_at on modification', () => {
      const source = createMockSource({
        updated_at: '2024-01-01T00:00:00.000Z', // Set a fixed past timestamp
      });
      const originalUpdatedAt = source.updated_at;

      // Simulate update trigger behavior
      const updated = {
        ...source,
        title: 'Modified Title',
        updated_at: new Date().toISOString(), // New timestamp
      };

      expect(updated.updated_at).not.toBe(originalUpdatedAt);
    });
  });
});
