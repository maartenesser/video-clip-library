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

export type ClipGroupType = 'duplicate' | 'same_topic' | 'multiple_takes';

export type ChatRole = 'user' | 'assistant' | 'system';

export type AssemblyStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
  thumbnail_url: string | null;
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

export interface ClipQuality {
  clip_id: string;
  speaking_quality_score: number | null;
  audio_quality_score: number | null;
  overall_quality_score: number | null;
  trimmed_start_seconds: number;
  trimmed_end_seconds: number;
  hesitation_count: number;
  filler_word_count: number;
  words_per_minute: number | null;
  quality_metadata: Record<string, unknown> | null;
  analyzed_at: string;
}

export interface ClipGroup {
  id: string;
  name: string | null;
  group_type: ClipGroupType;
  source_id: string | null;
  representative_clip_id: string | null;
  created_at: string;
}

export interface ClipGroupMember {
  clip_id: string;
  group_id: string;
  similarity_score: number | null;
  is_representative: boolean;
}

export interface ClipEmbedding {
  clip_id: string;
  embedding: number[];
  model_name: string;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  clip_ids: string[];
  created_at: string;
}

export interface AssembledVideo {
  id: string;
  user_id: string | null;
  title: string;
  clip_ids: string[];
  file_url: string | null;
  file_key: string | null;
  duration_seconds: number | null;
  subtitle_style: Record<string, unknown> | null;
  status: AssemblyStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
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
  thumbnail_url?: string | null;
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

export interface ClipQualityInsert {
  clip_id: string;
  speaking_quality_score?: number | null;
  audio_quality_score?: number | null;
  overall_quality_score?: number | null;
  trimmed_start_seconds?: number;
  trimmed_end_seconds?: number;
  hesitation_count?: number;
  filler_word_count?: number;
  words_per_minute?: number | null;
  quality_metadata?: Record<string, unknown> | null;
  analyzed_at?: string;
}

export interface ClipGroupInsert {
  id?: string;
  name?: string | null;
  group_type: ClipGroupType;
  source_id?: string | null;
  representative_clip_id?: string | null;
  created_at?: string;
}

export interface ClipGroupMemberInsert {
  clip_id: string;
  group_id: string;
  similarity_score?: number | null;
  is_representative?: boolean;
}

export interface ClipEmbeddingInsert {
  clip_id: string;
  embedding: number[];
  model_name?: string;
  created_at?: string;
}

export interface ChatConversationInsert {
  id?: string;
  user_id?: string | null;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessageInsert {
  id?: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  clip_ids?: string[];
  created_at?: string;
}

export interface AssembledVideoInsert {
  id?: string;
  user_id?: string | null;
  title: string;
  clip_ids: string[];
  file_url?: string | null;
  file_key?: string | null;
  duration_seconds?: number | null;
  subtitle_style?: Record<string, unknown> | null;
  status?: AssemblyStatus;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
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
  thumbnail_url?: string | null;
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

export interface ClipQualityUpdate {
  speaking_quality_score?: number | null;
  audio_quality_score?: number | null;
  overall_quality_score?: number | null;
  trimmed_start_seconds?: number;
  trimmed_end_seconds?: number;
  hesitation_count?: number;
  filler_word_count?: number;
  words_per_minute?: number | null;
  quality_metadata?: Record<string, unknown> | null;
  analyzed_at?: string;
}

export interface ClipGroupUpdate {
  name?: string | null;
  group_type?: ClipGroupType;
  representative_clip_id?: string | null;
}

export interface ClipGroupMemberUpdate {
  similarity_score?: number | null;
  is_representative?: boolean;
}

export interface ClipEmbeddingUpdate {
  embedding?: number[];
  model_name?: string;
}

export interface ChatConversationUpdate {
  title?: string | null;
  updated_at?: string;
}

export interface ChatMessageUpdate {
  content?: string;
  clip_ids?: string[];
}

export interface AssembledVideoUpdate {
  title?: string;
  clip_ids?: string[];
  file_url?: string | null;
  file_key?: string | null;
  duration_seconds?: number | null;
  subtitle_style?: Record<string, unknown> | null;
  status?: AssemblyStatus;
  error_message?: string | null;
  updated_at?: string;
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

export interface ClipWithQuality extends Clip {
  quality: ClipQuality | null;
}

export interface ClipWithGroups extends Clip {
  groups: (ClipGroupMember & { group: ClipGroup })[];
}

export interface ClipWithEmbedding extends Clip {
  embedding: ClipEmbedding | null;
}

export interface ClipComplete extends Clip {
  source: Source;
  tags: (ClipTag & { tag: Tag })[];
  quality: ClipQuality | null;
  groups: (ClipGroupMember & { group: ClipGroup })[];
}

export interface ChatConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
}

export interface AssembledVideoWithClips extends AssembledVideo {
  clips: Clip[];
}

export interface ClipSearchResult extends Clip {
  similarity: number;
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

export interface ClipQualityFilter {
  min_overall_score?: number;
  min_speaking_score?: number;
  min_audio_score?: number;
  max_filler_words?: number;
  max_hesitations?: number;
}

export interface ClipGroupFilter {
  source_id?: string;
  group_type?: ClipGroupType;
}

export interface ChatConversationFilter {
  user_id?: string;
  search?: string;
}

export interface AssembledVideoFilter {
  user_id?: string;
  status?: AssemblyStatus;
}

export interface SemanticSearchParams {
  query_embedding: number[];
  threshold?: number;
  limit?: number;
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
      clip_quality: {
        Row: ClipQuality;
        Insert: ClipQualityInsert;
        Update: ClipQualityUpdate;
        Relationships: [
          {
            foreignKeyName: 'clip_quality_clip_id_fkey';
            columns: ['clip_id'];
            isOneToOne: true;
            referencedRelation: 'clips';
            referencedColumns: ['id'];
          }
        ];
      };
      clip_groups: {
        Row: ClipGroup;
        Insert: ClipGroupInsert;
        Update: ClipGroupUpdate;
        Relationships: [
          {
            foreignKeyName: 'clip_groups_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clip_groups_representative_clip_id_fkey';
            columns: ['representative_clip_id'];
            isOneToOne: false;
            referencedRelation: 'clips';
            referencedColumns: ['id'];
          }
        ];
      };
      clip_group_members: {
        Row: ClipGroupMember;
        Insert: ClipGroupMemberInsert;
        Update: ClipGroupMemberUpdate;
        Relationships: [
          {
            foreignKeyName: 'clip_group_members_clip_id_fkey';
            columns: ['clip_id'];
            isOneToOne: false;
            referencedRelation: 'clips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clip_group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'clip_groups';
            referencedColumns: ['id'];
          }
        ];
      };
      clip_embeddings: {
        Row: ClipEmbedding;
        Insert: ClipEmbeddingInsert;
        Update: ClipEmbeddingUpdate;
        Relationships: [
          {
            foreignKeyName: 'clip_embeddings_clip_id_fkey';
            columns: ['clip_id'];
            isOneToOne: true;
            referencedRelation: 'clips';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_conversations: {
        Row: ChatConversation;
        Insert: ChatConversationInsert;
        Update: ChatConversationUpdate;
        Relationships: [];
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: ChatMessageInsert;
        Update: ChatMessageUpdate;
        Relationships: [
          {
            foreignKeyName: 'chat_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'chat_conversations';
            referencedColumns: ['id'];
          }
        ];
      };
      assembled_videos: {
        Row: AssembledVideo;
        Insert: AssembledVideoInsert;
        Update: AssembledVideoUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_clips_by_embedding: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          clip_id: string;
          similarity: number;
        }[];
      };
      get_high_quality_clips: {
        Args: {
          min_quality?: number;
          source_filter?: string | null;
        };
        Returns: {
          clip_id: string;
          source_id: string;
          overall_quality: number;
          speaking_quality: number;
          audio_quality: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
