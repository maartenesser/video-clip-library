import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Source,
  SourceInsert,
  SourceUpdate,
  SourceFilter,
  Clip,
  ClipInsert,
  ClipUpdate,
  ClipFilter,
  ClipWithTags,
  Tag,
  TagInsert,
  TagUpdate,
  TagFilter,
  ClipTag,
  ClipTagInsert,
  ProcessingJob,
  ProcessingJobInsert,
  ProcessingJobUpdate,
  ProcessingJobFilter,
  PaginationParams,
  PaginatedResult,
} from './types.js';

// ============================================================================
// Client Configuration
// ============================================================================

export interface DatabaseClientConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

// ============================================================================
// Database Client
// ============================================================================

export class DatabaseClient {
  private client: SupabaseClient;

  constructor(config: DatabaseClientConfig) {
    this.client = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Get the underlying Supabase client for advanced operations
   */
  getSupabaseClient(): SupabaseClient {
    return this.client;
  }

  // ==========================================================================
  // Sources
  // ==========================================================================

  async getSources(
    filter?: SourceFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Source>> {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('sources')
      .select('*', { count: 'exact' });

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.source_type) {
      query = query.eq('source_type', filter.source_type);
    }
    if (filter?.creator_name) {
      query = query.ilike('creator_name', `%${filter.creator_name}%`);
    }
    if (filter?.search) {
      query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as Source[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getSourceById(id: string): Promise<Source | null> {
    const { data, error } = await this.client
      .from('sources')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Source | null;
  }

  async createSource(source: SourceInsert): Promise<Source> {
    const { data, error } = await this.client
      .from('sources')
      .insert(source)
      .select()
      .single();

    if (error) throw error;
    return data as Source;
  }

  async updateSource(id: string, update: SourceUpdate): Promise<Source> {
    const { data, error } = await this.client
      .from('sources')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Source;
  }

  async deleteSource(id: string): Promise<void> {
    const { error } = await this.client
      .from('sources')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Clips
  // ==========================================================================

  async getClips(
    filter?: ClipFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Clip>> {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('clips')
      .select('*', { count: 'exact' });

    if (filter?.source_id) {
      query = query.eq('source_id', filter.source_id);
    }
    if (filter?.detection_method) {
      query = query.eq('detection_method', filter.detection_method);
    }
    if (filter?.min_duration !== undefined) {
      query = query.gte('duration_seconds', filter.min_duration);
    }
    if (filter?.max_duration !== undefined) {
      query = query.lte('duration_seconds', filter.max_duration);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as Clip[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getClipById(id: string): Promise<Clip | null> {
    const { data, error } = await this.client
      .from('clips')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Clip | null;
  }

  async getClipWithTags(id: string): Promise<ClipWithTags | null> {
    const { data, error } = await this.client
      .from('clips')
      .select(`
        *,
        tags:clip_tags(
          clip_id,
          tag_id,
          confidence_score,
          assigned_by,
          tag:tags(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ClipWithTags | null;
  }

  async getClipsBySourceId(sourceId: string): Promise<Clip[]> {
    const { data, error } = await this.client
      .from('clips')
      .select('*')
      .eq('source_id', sourceId)
      .order('start_time_seconds', { ascending: true });

    if (error) throw error;
    return (data || []) as Clip[];
  }

  async getClipsByTagIds(tagIds: string[]): Promise<Clip[]> {
    const { data, error } = await this.client
      .from('clip_tags')
      .select('clip:clips(*)')
      .in('tag_id', tagIds);

    if (error) throw error;

    // Extract unique clips
    const clipMap = new Map<string, Clip>();
    for (const item of data || []) {
      const clipData = item as unknown as { clip: Clip };
      const clip = clipData.clip;
      if (clip && !clipMap.has(clip.id)) {
        clipMap.set(clip.id, clip);
      }
    }

    return Array.from(clipMap.values());
  }

  async createClip(clip: ClipInsert): Promise<Clip> {
    const { data, error } = await this.client
      .from('clips')
      .insert(clip)
      .select()
      .single();

    if (error) throw error;
    return data as Clip;
  }

  async updateClip(id: string, update: ClipUpdate): Promise<Clip> {
    const { data, error } = await this.client
      .from('clips')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Clip;
  }

  async deleteClip(id: string): Promise<void> {
    const { error } = await this.client
      .from('clips')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Tags
  // ==========================================================================

  async getTags(filter?: TagFilter): Promise<Tag[]> {
    let query = this.client
      .from('tags')
      .select('*');

    if (filter?.category) {
      query = query.eq('category', filter.category);
    }
    if (filter?.is_system !== undefined) {
      query = query.eq('is_system', filter.is_system);
    }

    query = query.order('display_order', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as Tag[];
  }

  async getTagById(id: string): Promise<Tag | null> {
    const { data, error } = await this.client
      .from('tags')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Tag | null;
  }

  async getTagByName(name: string): Promise<Tag | null> {
    const { data, error } = await this.client
      .from('tags')
      .select('*')
      .eq('name', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as Tag | null;
  }

  async getSystemTags(): Promise<Tag[]> {
    return this.getTags({ is_system: true });
  }

  async createTag(tag: TagInsert): Promise<Tag> {
    const { data, error } = await this.client
      .from('tags')
      .insert(tag)
      .select()
      .single();

    if (error) throw error;
    return data as Tag;
  }

  async updateTag(id: string, update: TagUpdate): Promise<Tag> {
    const { data, error } = await this.client
      .from('tags')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Tag;
  }

  async deleteTag(id: string): Promise<void> {
    const { error } = await this.client
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Clip Tags
  // ==========================================================================

  async getClipTags(clipId: string): Promise<(ClipTag & { tag: Tag })[]> {
    const { data, error } = await this.client
      .from('clip_tags')
      .select('*, tag:tags(*)')
      .eq('clip_id', clipId);

    if (error) throw error;
    return (data || []) as (ClipTag & { tag: Tag })[];
  }

  async addTagToClip(clipTag: ClipTagInsert): Promise<ClipTag> {
    const { data, error } = await this.client
      .from('clip_tags')
      .insert(clipTag)
      .select()
      .single();

    if (error) throw error;
    return data as ClipTag;
  }

  async addTagsToClip(clipId: string, tagIds: string[], assignedBy: 'ai' | 'user' | 'system' = 'ai'): Promise<ClipTag[]> {
    const clipTags: ClipTagInsert[] = tagIds.map(tagId => ({
      clip_id: clipId,
      tag_id: tagId,
      confidence_score: null,
      assigned_by: assignedBy,
    }));

    const { data, error } = await this.client
      .from('clip_tags')
      .insert(clipTags)
      .select();

    if (error) throw error;
    return (data || []) as ClipTag[];
  }

  async removeTagFromClip(clipId: string, tagId: string): Promise<void> {
    const { error } = await this.client
      .from('clip_tags')
      .delete()
      .eq('clip_id', clipId)
      .eq('tag_id', tagId);

    if (error) throw error;
  }

  async removeAllTagsFromClip(clipId: string): Promise<void> {
    const { error } = await this.client
      .from('clip_tags')
      .delete()
      .eq('clip_id', clipId);

    if (error) throw error;
  }

  async updateClipTagConfidence(clipId: string, tagId: string, confidenceScore: number): Promise<ClipTag> {
    const { data, error } = await this.client
      .from('clip_tags')
      .update({ confidence_score: confidenceScore })
      .eq('clip_id', clipId)
      .eq('tag_id', tagId)
      .select()
      .single();

    if (error) throw error;
    return data as ClipTag;
  }

  // ==========================================================================
  // Processing Jobs
  // ==========================================================================

  async getProcessingJobs(
    filter?: ProcessingJobFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ProcessingJob>> {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('processing_jobs')
      .select('*', { count: 'exact' });

    if (filter?.source_id) {
      query = query.eq('source_id', filter.source_id);
    }
    if (filter?.job_type) {
      query = query.eq('job_type', filter.job_type);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as ProcessingJob[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getProcessingJobById(id: string): Promise<ProcessingJob | null> {
    const { data, error } = await this.client
      .from('processing_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ProcessingJob | null;
  }

  async getProcessingJobsBySourceId(sourceId: string): Promise<ProcessingJob[]> {
    const { data, error } = await this.client
      .from('processing_jobs')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ProcessingJob[];
  }

  async createProcessingJob(job: ProcessingJobInsert): Promise<ProcessingJob> {
    const { data, error } = await this.client
      .from('processing_jobs')
      .insert(job)
      .select()
      .single();

    if (error) throw error;
    return data as ProcessingJob;
  }

  async updateProcessingJob(id: string, update: ProcessingJobUpdate): Promise<ProcessingJob> {
    const { data, error } = await this.client
      .from('processing_jobs')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ProcessingJob;
  }

  async updateProcessingJobProgress(id: string, progressPercent: number): Promise<ProcessingJob> {
    return this.updateProcessingJob(id, { progress_percent: progressPercent });
  }

  async completeProcessingJob(id: string): Promise<ProcessingJob> {
    return this.updateProcessingJob(id, { status: 'completed', progress_percent: 100 });
  }

  async failProcessingJob(id: string, errorMessage: string): Promise<ProcessingJob> {
    return this.updateProcessingJob(id, { status: 'failed', error_message: errorMessage });
  }

  async deleteProcessingJob(id: string): Promise<void> {
    const { error } = await this.client
      .from('processing_jobs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDatabaseClient(config: DatabaseClientConfig): DatabaseClient {
  return new DatabaseClient(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default DatabaseClient;
