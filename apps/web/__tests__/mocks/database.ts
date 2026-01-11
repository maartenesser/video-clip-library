import { vi } from 'vitest';
import type {
  Source,
  Clip,
  Tag,
  ClipTag,
  ProcessingJob,
  ClipWithTags,
  PaginatedResult,
} from '@video-clip-library/database';

// Sample data
export const mockSource: Source = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  title: 'Test Video',
  description: 'A test video description',
  source_type: 'upload',
  creator_name: 'Test Creator',
  original_file_url: 'https://storage.example.com/sources/abc123/original.mp4',
  original_file_key: 'sources/abc123/original.mp4',
  duration_seconds: 120,
  status: 'completed',
  error_message: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const mockClip: Clip = {
  id: 'e47ac10b-58cc-4372-a567-0e02b2c3d480',
  source_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  start_time_seconds: 10,
  end_time_seconds: 30,
  duration_seconds: 20,
  file_url: 'https://storage.example.com/clips/clip1.mp4',
  file_key: 'clips/clip1.mp4',
  thumbnail_url: 'https://storage.example.com/thumbnails/clip1.jpg',
  transcript_segment: 'This is the transcript segment',
  detection_method: 'ai',
  created_at: '2024-01-01T00:00:00Z',
};

export const mockTag: Tag = {
  id: 'd47ac10b-58cc-4372-a567-0e02b2c3d481',
  name: 'demo',
  category: 'content',
  color: '#FF0000',
  is_system: false,
  display_order: 1,
};

export const mockClipTag: ClipTag = {
  clip_id: 'e47ac10b-58cc-4372-a567-0e02b2c3d480',
  tag_id: 'd47ac10b-58cc-4372-a567-0e02b2c3d481',
  confidence_score: 0.95,
  assigned_by: 'ai',
};

export const mockProcessingJob: ProcessingJob = {
  id: 'c47ac10b-58cc-4372-a567-0e02b2c3d482',
  source_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  job_type: 'transcription',
  status: 'completed',
  progress_percent: 100,
  error_message: null,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockClipWithTags: ClipWithTags = {
  ...mockClip,
  tags: [{ ...mockClipTag, tag: mockTag }],
};

// Create mock database client
export function createMockDatabaseClient() {
  return {
    // Sources
    getSources: vi.fn().mockResolvedValue({
      data: [mockSource],
      count: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as PaginatedResult<Source>),
    getSourceById: vi.fn().mockResolvedValue(mockSource),
    createSource: vi.fn().mockResolvedValue(mockSource),
    updateSource: vi.fn().mockResolvedValue(mockSource),
    deleteSource: vi.fn().mockResolvedValue(undefined),

    // Clips
    getClips: vi.fn().mockResolvedValue({
      data: [mockClip],
      count: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as PaginatedResult<Clip>),
    getClipById: vi.fn().mockResolvedValue(mockClip),
    getClipWithTags: vi.fn().mockResolvedValue(mockClipWithTags),
    getClipsBySourceId: vi.fn().mockResolvedValue([mockClip]),
    getClipsByTagIds: vi.fn().mockResolvedValue([mockClip]),
    createClip: vi.fn().mockResolvedValue(mockClip),
    updateClip: vi.fn().mockResolvedValue(mockClip),
    deleteClip: vi.fn().mockResolvedValue(undefined),

    // Tags
    getTags: vi.fn().mockResolvedValue([mockTag]),
    getTagById: vi.fn().mockResolvedValue(mockTag),
    getTagByName: vi.fn().mockResolvedValue(mockTag),
    getSystemTags: vi.fn().mockResolvedValue([]),
    createTag: vi.fn().mockResolvedValue(mockTag),
    updateTag: vi.fn().mockResolvedValue(mockTag),
    deleteTag: vi.fn().mockResolvedValue(undefined),

    // Clip Tags
    getClipTags: vi.fn().mockResolvedValue([{ ...mockClipTag, tag: mockTag }]),
    addTagToClip: vi.fn().mockResolvedValue(mockClipTag),
    addTagsToClip: vi.fn().mockResolvedValue([mockClipTag]),
    removeTagFromClip: vi.fn().mockResolvedValue(undefined),
    removeAllTagsFromClip: vi.fn().mockResolvedValue(undefined),
    updateClipTagConfidence: vi.fn().mockResolvedValue(mockClipTag),

    // Processing Jobs
    getProcessingJobs: vi.fn().mockResolvedValue({
      data: [mockProcessingJob],
      count: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    getProcessingJobById: vi.fn().mockResolvedValue(mockProcessingJob),
    getProcessingJobsBySourceId: vi.fn().mockResolvedValue([mockProcessingJob]),
    createProcessingJob: vi.fn().mockResolvedValue(mockProcessingJob),
    updateProcessingJob: vi.fn().mockResolvedValue(mockProcessingJob),
    updateProcessingJobProgress: vi.fn().mockResolvedValue(mockProcessingJob),
    completeProcessingJob: vi.fn().mockResolvedValue({ ...mockProcessingJob, status: 'completed' }),
    failProcessingJob: vi.fn().mockResolvedValue({ ...mockProcessingJob, status: 'failed' }),
    deleteProcessingJob: vi.fn().mockResolvedValue(undefined),

    // Supabase client
    getSupabaseClient: vi.fn().mockReturnValue({}),
  };
}

export type MockDatabaseClient = ReturnType<typeof createMockDatabaseClient>;
