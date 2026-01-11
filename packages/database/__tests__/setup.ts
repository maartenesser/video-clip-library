/**
 * Test setup for database tests
 *
 * This module provides mock utilities for testing the database client
 * without requiring a live Supabase connection.
 */

import { vi } from 'vitest';

// ============================================================================
// Mock Data Generators
// ============================================================================

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createMockSource(overrides = {}) {
  return {
    id: generateUUID(),
    title: 'Test Video',
    description: 'A test video description',
    source_type: 'upload' as const,
    creator_name: 'Test Creator',
    original_file_url: 'https://example.com/video.mp4',
    original_file_key: 'videos/test-video.mp4',
    duration_seconds: 120.5,
    status: 'pending' as const,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockClip(sourceId: string, overrides = {}) {
  const startTime = 10.5;
  const endTime = 25.75;
  return {
    id: generateUUID(),
    source_id: sourceId,
    start_time_seconds: startTime,
    end_time_seconds: endTime,
    duration_seconds: endTime - startTime,
    file_url: 'https://example.com/clip.mp4',
    file_key: 'clips/test-clip.mp4',
    thumbnail_url: 'https://example.com/thumb.jpg',
    transcript_segment: 'This is a test transcript segment.',
    detection_method: 'ai' as const,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTag(overrides = {}) {
  return {
    id: generateUUID(),
    name: 'test_tag',
    category: 'content_type',
    color: '#FF6B6B',
    is_system: false,
    display_order: 0,
    ...overrides,
  };
}

export function createMockClipTag(clipId: string, tagId: string, overrides = {}) {
  return {
    clip_id: clipId,
    tag_id: tagId,
    confidence_score: 0.95,
    assigned_by: 'ai' as const,
    ...overrides,
  };
}

export function createMockProcessingJob(sourceId: string, overrides = {}) {
  return {
    id: generateUUID(),
    source_id: sourceId,
    job_type: 'transcription' as const,
    status: 'pending' as const,
    progress_percent: 0,
    error_message: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Default System Tags
// ============================================================================

export const DEFAULT_SYSTEM_TAGS = [
  { name: 'hook', category: 'content_type', color: '#FF6B6B', is_system: true, display_order: 1 },
  { name: 'product_benefit', category: 'content_type', color: '#4ECDC4', is_system: true, display_order: 2 },
  { name: 'proof', category: 'content_type', color: '#45B7D1', is_system: true, display_order: 3 },
  { name: 'testimonial', category: 'content_type', color: '#96CEB4', is_system: true, display_order: 4 },
  { name: 'objection_handling', category: 'content_type', color: '#FFEAA7', is_system: true, display_order: 5 },
  { name: 'cta', category: 'content_type', color: '#DDA0DD', is_system: true, display_order: 6 },
  { name: 'b_roll', category: 'content_type', color: '#98D8C8', is_system: true, display_order: 7 },
];

// ============================================================================
// Mock Supabase Client
// ============================================================================

export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

export function createMockQueryBuilder(returnData: unknown = null, count: number | null = null): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    ilike: vi.fn(),
    in: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
  };

  // Chain all methods to return the builder
  Object.keys(builder).forEach((key) => {
    const k = key as keyof MockQueryBuilder;
    builder[k].mockReturnValue(builder);
  });

  // Terminal methods return the result
  const result = { data: returnData, error: null, count };
  builder.select.mockReturnValue({ ...builder, then: (resolve: (value: unknown) => void) => resolve(result) });
  builder.single.mockResolvedValue(result);
  builder.range.mockResolvedValue(result);

  return builder;
}

export function createMockSupabaseClient() {
  const mockFrom = vi.fn();

  return {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  };
}

// ============================================================================
// Test Environment Setup
// ============================================================================

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
}

// Global test timeout
vi.setConfig({ testTimeout: 10000 });
