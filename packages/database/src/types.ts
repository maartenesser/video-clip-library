/**
 * Database types for the video clip library
 * These types are generated from the Supabase schema
 */

// ============================================================================
// Enums
// ============================================================================

export type SourceStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type SourceType = 'youtube' | 'upload' | 'tiktok' | 'instagram' | 'other';

export type JobType = 'transcription' | 'clip_detection' | 'thumbnail_generation' | 'tagging';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type DetectionMethod = 'ai' | 'manual' | 'silence' | 'scene_change';

export type AssignedBy = 'ai' | 'user' | 'system';

// ============================================================================
// Base Types (Row types)
// ============================================================================

export interface Source {
  id: string;
  title: string;
  description: string | null;
  source_type: string;
  creator_name: string | null;
  original_file_url: string;
  original_file_key: string;
  duration_seconds: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Clip {
  id: string;
  source_id: string;
  start_time_seconds: number;
  end_time_seconds: number;
  duration_seconds: number; // Computed column
  file_url: string;
  file_key: string;
  thumbnail_url: string | null;
  transcript_segment: string | null;
  detection_method: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  color: string | null;
  is_system: boolean;
  display_order: number;
}

export interface ClipTag {
  clip_id: string;
  tag_id: string;
  confidence_score: number | null;
  assigned_by: string;
}

export interface ProcessingJob {
  id: string;
  source_id: string;
  job_type: string;
  status: string;
  progress_percent: number;
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// Insert Types (for creating new records)
// ============================================================================

export interface SourceInsert {
  id?: string;
  title: string;
  description?: string | null;
  source_type: string;
  creator_name?: string | null;
  original_file_url: string;
  original_file_key: string;
  duration_seconds?: number | null;
  status?: string;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClipInsert {
  id?: string;
  source_id: string;
  start_time_seconds: number;
  end_time_seconds: number;
  file_url: string;
  file_key: string;
  thumbnail_url?: string | null;
  transcript_segment?: string | null;
  detection_method?: string | null;
  created_at?: string;
}

export interface TagInsert {
  id?: string;
  name: string;
  category: string;
  color?: string | null;
  is_system?: boolean;
  display_order?: number;
}

export interface ClipTagInsert {
  clip_id: string;
  tag_id: string;
  confidence_score?: number | null;
  assigned_by?: string;
}

export interface ProcessingJobInsert {
  id?: string;
  source_id: string;
  job_type: string;
  status?: string;
  progress_percent?: number;
  error_message?: string | null;
  created_at?: string;
}

// ============================================================================
// Update Types (for updating existing records)
// ============================================================================

export interface SourceUpdate {
  id?: string;
  title?: string;
  description?: string | null;
  source_type?: string;
  creator_name?: string | null;
  original_file_url?: string;
  original_file_key?: string;
  duration_seconds?: number | null;
  status?: string;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClipUpdate {
  id?: string;
  source_id?: string;
  start_time_seconds?: number;
  end_time_seconds?: number;
  file_url?: string;
  file_key?: string;
  thumbnail_url?: string | null;
  transcript_segment?: string | null;
  detection_method?: string | null;
  created_at?: string;
}

export interface TagUpdate {
  id?: string;
  name?: string;
  category?: string;
  color?: string | null;
  is_system?: boolean;
  display_order?: number;
}

export interface ClipTagUpdate {
  clip_id?: string;
  tag_id?: string;
  confidence_score?: number | null;
  assigned_by?: string;
}

export interface ProcessingJobUpdate {
  id?: string;
  source_id?: string;
  job_type?: string;
  status?: string;
  progress_percent?: number;
  error_message?: string | null;
  created_at?: string;
}

// ============================================================================
// Extended Types (with relations)
// ============================================================================

export interface ClipWithSource extends Clip {
  source: Source;
}

export interface ClipWithTags extends Clip {
  tags: (ClipTag & { tag: Tag })[];
}

export interface ClipFull extends Clip {
  source: Source;
  tags: (ClipTag & { tag: Tag })[];
}

export interface SourceWithClips extends Source {
  clips: Clip[];
}

export interface SourceWithJobs extends Source {
  processing_jobs: ProcessingJob[];
}

export interface SourceFull extends Source {
  clips: ClipWithTags[];
  processing_jobs: ProcessingJob[];
}

// ============================================================================
// Query Filters
// ============================================================================

export interface SourceFilter {
  status?: SourceStatus;
  source_type?: SourceType;
  creator_name?: string;
  search?: string;
}

export interface ClipFilter {
  source_id?: string;
  detection_method?: DetectionMethod;
  tag_ids?: string[];
  min_duration?: number;
  max_duration?: number;
}

export interface TagFilter {
  category?: string;
  is_system?: boolean;
}

export interface ProcessingJobFilter {
  source_id?: string;
  job_type?: JobType;
  status?: JobStatus;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Database Schema Type (for Supabase client)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: Source;
        Insert: SourceInsert;
        Update: SourceUpdate;
        Relationships: [];
      };
      clips: {
        Row: Clip;
        Insert: ClipInsert;
        Update: ClipUpdate;
        Relationships: [
          {
            foreignKeyName: 'clips_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          }
        ];
      };
      tags: {
        Row: Tag;
        Insert: TagInsert;
        Update: TagUpdate;
        Relationships: [];
      };
      clip_tags: {
        Row: ClipTag;
        Insert: ClipTagInsert;
        Update: ClipTagUpdate;
        Relationships: [
          {
            foreignKeyName: 'clip_tags_clip_id_fkey';
            columns: ['clip_id'];
            isOneToOne: false;
            referencedRelation: 'clips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clip_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          }
        ];
      };
      processing_jobs: {
        Row: ProcessingJob;
        Insert: ProcessingJobInsert;
        Update: ProcessingJobUpdate;
        Relationships: [
          {
            foreignKeyName: 'processing_jobs_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
