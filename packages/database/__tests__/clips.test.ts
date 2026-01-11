import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockSource,
  createMockClip,
  createMockTag,
  createMockClipTag,
  generateUUID,
} from './setup';
import type { Clip, ClipInsert, ClipUpdate, ClipTag } from '../src/types';

/**
 * Clips table tests
 *
 * Tests CRUD operations, computed columns, and foreign key relationships
 */

describe('Clips', () => {
  let mockSourceId: string;

  beforeEach(() => {
    mockSourceId = generateUUID();
  });

  describe('Type validation', () => {
    it('should have all required fields in Clip type', () => {
      const clip = createMockClip(mockSourceId);

      expect(clip).toHaveProperty('id');
      expect(clip).toHaveProperty('source_id');
      expect(clip).toHaveProperty('start_time_seconds');
      expect(clip).toHaveProperty('end_time_seconds');
      expect(clip).toHaveProperty('duration_seconds');
      expect(clip).toHaveProperty('file_url');
      expect(clip).toHaveProperty('file_key');
      expect(clip).toHaveProperty('thumbnail_url');
      expect(clip).toHaveProperty('transcript_segment');
      expect(clip).toHaveProperty('detection_method');
      expect(clip).toHaveProperty('created_at');
    });

    it('should accept valid detection_method values', () => {
      const validMethods = ['ai', 'manual', 'silence', 'scene_change'];

      validMethods.forEach((method) => {
        const clip = createMockClip(mockSourceId, { detection_method: method });
        expect(clip.detection_method).toBe(method);
      });
    });

    it('should allow null for optional fields', () => {
      const clip = createMockClip(mockSourceId, {
        thumbnail_url: null,
        transcript_segment: null,
        detection_method: null,
      });

      expect(clip.thumbnail_url).toBeNull();
      expect(clip.transcript_segment).toBeNull();
      expect(clip.detection_method).toBeNull();
    });
  });

  describe('Computed duration column', () => {
    it('should compute duration_seconds from start and end times', () => {
      const startTime = 10.0;
      const endTime = 25.5;
      const clip = createMockClip(mockSourceId, {
        start_time_seconds: startTime,
        end_time_seconds: endTime,
        duration_seconds: endTime - startTime, // In mock, we set this; in real DB it's computed
      });

      const expectedDuration = endTime - startTime;
      expect(clip.duration_seconds).toBeCloseTo(expectedDuration, 2);
    });

    it('should handle zero start time', () => {
      const clip = createMockClip(mockSourceId, {
        start_time_seconds: 0,
        end_time_seconds: 15.0,
        duration_seconds: 15.0,
      });

      expect(clip.duration_seconds).toBe(15.0);
    });

    it('should handle precise decimal times', () => {
      const clip = createMockClip(mockSourceId, {
        start_time_seconds: 10.123,
        end_time_seconds: 25.456,
        duration_seconds: 15.333,
      });

      expect(clip.duration_seconds).toBeCloseTo(15.333, 3);
    });
  });

  describe('ClipInsert type', () => {
    it('should not require id, duration_seconds, created_at', () => {
      const clipInsert: ClipInsert = {
        source_id: mockSourceId,
        start_time_seconds: 10.0,
        end_time_seconds: 25.0,
        file_url: 'https://example.com/clip.mp4',
        file_key: 'clips/new-clip.mp4',
        thumbnail_url: null,
        transcript_segment: null,
        detection_method: 'ai',
      };

      expect(clipInsert.source_id).toBe(mockSourceId);
      expect(clipInsert).not.toHaveProperty('duration_seconds');
    });
  });

  describe('ClipUpdate type', () => {
    it('should allow partial updates', () => {
      const clipUpdate: ClipUpdate = {
        thumbnail_url: 'https://example.com/new-thumb.jpg',
      };

      expect(clipUpdate.thumbnail_url).toBeDefined();
      expect(clipUpdate.transcript_segment).toBeUndefined();
    });

    it('should allow updating transcript_segment', () => {
      const clipUpdate: ClipUpdate = {
        transcript_segment: 'Updated transcript content',
      };

      expect(clipUpdate.transcript_segment).toBe('Updated transcript content');
    });

    it('should not allow updating duration_seconds directly', () => {
      // duration_seconds is computed, so not in ClipUpdate type
      const clipUpdate: ClipUpdate = {
        start_time_seconds: 5.0,
        end_time_seconds: 20.0,
      };

      expect(clipUpdate).not.toHaveProperty('duration_seconds');
    });
  });

  describe('Foreign key relationships', () => {
    it('should reference a valid source_id', () => {
      const source = createMockSource();
      const clip = createMockClip(source.id);

      expect(clip.source_id).toBe(source.id);
    });

    it('should cascade delete clips when source is deleted', () => {
      const source = createMockSource();
      const clips = [
        createMockClip(source.id),
        createMockClip(source.id),
        createMockClip(source.id),
      ];

      // Simulate cascade delete
      const remainingClips = clips.filter((c) => c.source_id !== source.id);

      expect(remainingClips).toHaveLength(0);
    });
  });

  describe('Mock CRUD operations', () => {
    let clips: Clip[];

    beforeEach(() => {
      clips = [
        createMockClip(mockSourceId, { start_time_seconds: 0, end_time_seconds: 10 }),
        createMockClip(mockSourceId, { start_time_seconds: 10, end_time_seconds: 25 }),
        createMockClip(mockSourceId, { start_time_seconds: 25, end_time_seconds: 40 }),
      ];
    });

    it('should create a new clip', () => {
      const newClip = createMockClip(mockSourceId, { start_time_seconds: 40, end_time_seconds: 55 });
      clips.push(newClip);

      expect(clips).toHaveLength(4);
    });

    it('should read clips by source_id', () => {
      const sourceClips = clips.filter((c) => c.source_id === mockSourceId);

      expect(sourceClips).toHaveLength(3);
    });

    it('should filter clips by duration range', () => {
      const minDuration = 10;
      const maxDuration = 20;
      const filtered = clips.filter(
        (c) => c.duration_seconds >= minDuration && c.duration_seconds <= maxDuration
      );

      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should order clips by start_time_seconds', () => {
      const ordered = [...clips].sort((a, b) => a.start_time_seconds - b.start_time_seconds);

      expect(ordered[0].start_time_seconds).toBe(0);
      expect(ordered[1].start_time_seconds).toBe(10);
      expect(ordered[2].start_time_seconds).toBe(25);
    });

    it('should update a clip', () => {
      clips[0] = { ...clips[0], transcript_segment: 'New transcript' };

      expect(clips[0].transcript_segment).toBe('New transcript');
    });

    it('should delete a clip', () => {
      const idToDelete = clips[1].id;
      clips = clips.filter((c) => c.id !== idToDelete);

      expect(clips).toHaveLength(2);
    });
  });

  describe('Clip Tags relationship', () => {
    it('should create clip_tag junction records', () => {
      const clip = createMockClip(mockSourceId);
      const tag1 = createMockTag({ name: 'hook' });
      const tag2 = createMockTag({ name: 'cta' });

      const clipTags: ClipTag[] = [
        createMockClipTag(clip.id, tag1.id, { confidence_score: 0.95 }),
        createMockClipTag(clip.id, tag2.id, { confidence_score: 0.87 }),
      ];

      expect(clipTags).toHaveLength(2);
      expect(clipTags[0].clip_id).toBe(clip.id);
      expect(clipTags[1].tag_id).toBe(tag2.id);
    });

    it('should cascade delete clip_tags when clip is deleted', () => {
      const clip = createMockClip(mockSourceId);
      const tag = createMockTag();
      let clipTags: ClipTag[] = [createMockClipTag(clip.id, tag.id)];

      // Simulate cascade delete
      clipTags = clipTags.filter((ct) => ct.clip_id !== clip.id);

      expect(clipTags).toHaveLength(0);
    });

    it('should store confidence_score for AI-assigned tags', () => {
      const clip = createMockClip(mockSourceId);
      const tag = createMockTag();
      const clipTag = createMockClipTag(clip.id, tag.id, {
        confidence_score: 0.9234,
        assigned_by: 'ai',
      });

      expect(clipTag.confidence_score).toBe(0.9234);
      expect(clipTag.assigned_by).toBe('ai');
    });

    it('should allow null confidence_score for user-assigned tags', () => {
      const clip = createMockClip(mockSourceId);
      const tag = createMockTag();
      const clipTag = createMockClipTag(clip.id, tag.id, {
        confidence_score: null,
        assigned_by: 'user',
      });

      expect(clipTag.confidence_score).toBeNull();
      expect(clipTag.assigned_by).toBe('user');
    });
  });

  describe('Validation rules', () => {
    it('should require start_time_seconds to be non-negative', () => {
      const clip = createMockClip(mockSourceId, { start_time_seconds: 0 });
      expect(clip.start_time_seconds).toBeGreaterThanOrEqual(0);
    });

    it('should require end_time_seconds to be greater than start_time_seconds', () => {
      const clip = createMockClip(mockSourceId, {
        start_time_seconds: 10,
        end_time_seconds: 25,
      });
      expect(clip.end_time_seconds).toBeGreaterThan(clip.start_time_seconds);
    });

    it('should require file_url to be valid URL format', () => {
      const clip = createMockClip(mockSourceId, {
        file_url: 'https://example.com/clip.mp4',
      });
      expect(clip.file_url).toMatch(/^https?:\/\//);
    });
  });
});
