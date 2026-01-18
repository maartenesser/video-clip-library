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
  ClipWithQuality,
  ClipComplete,
  ClipSearchResult,
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
  ClipQuality,
  ClipQualityInsert,
  ClipQualityUpdate,
  ClipQualityFilter,
  ClipGroup,
  ClipGroupInsert,
  ClipGroupUpdate,
  ClipGroupFilter,
  ClipGroupMember,
  ClipGroupMemberInsert,
  ClipEmbedding,
  ClipEmbeddingInsert,
  ChatConversation,
  ChatConversationInsert,
  ChatConversationUpdate,
  ChatConversationFilter,
  ChatConversationWithMessages,
  ChatMessage,
  ChatMessageInsert,
  AssembledVideo,
  AssembledVideoInsert,
  AssembledVideoUpdate,
  AssembledVideoFilter,
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

  // ==========================================================================
  // Clip Quality
  // ==========================================================================

  async getClipQuality(clipId: string): Promise<ClipQuality | null> {
    const { data, error } = await this.client
      .from('clip_quality')
      .select('*')
      .eq('clip_id', clipId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ClipQuality | null;
  }

  async getClipsWithQuality(
    filter?: ClipQualityFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ClipWithQuality>> {
    const { page = 1, limit = 20, orderBy = 'overall_quality_score', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('clips')
      .select(`
        *,
        quality:clip_quality(*)
      `, { count: 'exact' });

    if (filter?.min_overall_score !== undefined) {
      query = query.gte('clip_quality.overall_quality_score', filter.min_overall_score);
    }
    if (filter?.min_speaking_score !== undefined) {
      query = query.gte('clip_quality.speaking_quality_score', filter.min_speaking_score);
    }
    if (filter?.min_audio_score !== undefined) {
      query = query.gte('clip_quality.audio_quality_score', filter.min_audio_score);
    }
    if (filter?.max_filler_words !== undefined) {
      query = query.lte('clip_quality.filler_word_count', filter.max_filler_words);
    }
    if (filter?.max_hesitations !== undefined) {
      query = query.lte('clip_quality.hesitation_count', filter.max_hesitations);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc', referencedTable: 'clip_quality' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as ClipWithQuality[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async createClipQuality(quality: ClipQualityInsert): Promise<ClipQuality> {
    const { data, error } = await this.client
      .from('clip_quality')
      .insert(quality)
      .select()
      .single();

    if (error) throw error;
    return data as ClipQuality;
  }

  async updateClipQuality(clipId: string, update: ClipQualityUpdate): Promise<ClipQuality> {
    const { data, error } = await this.client
      .from('clip_quality')
      .update(update)
      .eq('clip_id', clipId)
      .select()
      .single();

    if (error) throw error;
    return data as ClipQuality;
  }

  async upsertClipQuality(quality: ClipQualityInsert): Promise<ClipQuality> {
    const { data, error } = await this.client
      .from('clip_quality')
      .upsert(quality)
      .select()
      .single();

    if (error) throw error;
    return data as ClipQuality;
  }

  async deleteClipQuality(clipId: string): Promise<void> {
    const { error } = await this.client
      .from('clip_quality')
      .delete()
      .eq('clip_id', clipId);

    if (error) throw error;
  }

  // ==========================================================================
  // Clip Groups
  // ==========================================================================

  async getClipGroups(
    filter?: ClipGroupFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ClipGroup>> {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('clip_groups')
      .select('*', { count: 'exact' });

    if (filter?.source_id) {
      query = query.eq('source_id', filter.source_id);
    }
    if (filter?.group_type) {
      query = query.eq('group_type', filter.group_type);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as ClipGroup[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getClipGroupById(id: string): Promise<ClipGroup | null> {
    const { data, error } = await this.client
      .from('clip_groups')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ClipGroup | null;
  }

  async getClipGroupWithMembers(id: string): Promise<(ClipGroup & { members: (ClipGroupMember & { clip: Clip })[] }) | null> {
    const { data, error } = await this.client
      .from('clip_groups')
      .select(`
        *,
        members:clip_group_members(
          clip_id,
          group_id,
          similarity_score,
          is_representative,
          clip:clips(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as (ClipGroup & { members: (ClipGroupMember & { clip: Clip })[] }) | null;
  }

  async getClipGroupsBySourceId(sourceId: string): Promise<ClipGroup[]> {
    const { data, error } = await this.client
      .from('clip_groups')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ClipGroup[];
  }

  async createClipGroup(group: ClipGroupInsert): Promise<ClipGroup> {
    const { data, error } = await this.client
      .from('clip_groups')
      .insert(group)
      .select()
      .single();

    if (error) throw error;
    return data as ClipGroup;
  }

  async updateClipGroup(id: string, update: ClipGroupUpdate): Promise<ClipGroup> {
    const { data, error } = await this.client
      .from('clip_groups')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ClipGroup;
  }

  async deleteClipGroup(id: string): Promise<void> {
    const { error } = await this.client
      .from('clip_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Clip Group Members
  // ==========================================================================

  async addClipToGroup(member: ClipGroupMemberInsert): Promise<ClipGroupMember> {
    const { data, error } = await this.client
      .from('clip_group_members')
      .insert(member)
      .select()
      .single();

    if (error) throw error;
    return data as ClipGroupMember;
  }

  async addClipsToGroup(groupId: string, clipIds: string[], similarityScores?: number[]): Promise<ClipGroupMember[]> {
    const members: ClipGroupMemberInsert[] = clipIds.map((clipId, index) => ({
      clip_id: clipId,
      group_id: groupId,
      similarity_score: similarityScores?.[index] ?? null,
      is_representative: index === 0,
    }));

    const { data, error } = await this.client
      .from('clip_group_members')
      .insert(members)
      .select();

    if (error) throw error;
    return (data || []) as ClipGroupMember[];
  }

  async removeClipFromGroup(clipId: string, groupId: string): Promise<void> {
    const { error } = await this.client
      .from('clip_group_members')
      .delete()
      .eq('clip_id', clipId)
      .eq('group_id', groupId);

    if (error) throw error;
  }

  async setRepresentativeClip(clipId: string, groupId: string): Promise<void> {
    // First, unset all representatives in the group
    await this.client
      .from('clip_group_members')
      .update({ is_representative: false })
      .eq('group_id', groupId);

    // Then set the new representative
    const { error } = await this.client
      .from('clip_group_members')
      .update({ is_representative: true })
      .eq('clip_id', clipId)
      .eq('group_id', groupId);

    if (error) throw error;

    // Also update the group's representative_clip_id
    await this.client
      .from('clip_groups')
      .update({ representative_clip_id: clipId })
      .eq('id', groupId);
  }

  async getClipGroups_byClipId(clipId: string): Promise<ClipGroup[]> {
    const { data, error } = await this.client
      .from('clip_group_members')
      .select('group:clip_groups(*)')
      .eq('clip_id', clipId);

    if (error) throw error;
    return (data || []).map((item) => (item as unknown as { group: ClipGroup }).group);
  }

  // ==========================================================================
  // Clip Embeddings
  // ==========================================================================

  async getClipEmbedding(clipId: string): Promise<ClipEmbedding | null> {
    const { data, error } = await this.client
      .from('clip_embeddings')
      .select('*')
      .eq('clip_id', clipId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ClipEmbedding | null;
  }

  async createClipEmbedding(embedding: ClipEmbeddingInsert): Promise<ClipEmbedding> {
    const { data, error } = await this.client
      .from('clip_embeddings')
      .insert(embedding)
      .select()
      .single();

    if (error) throw error;
    return data as ClipEmbedding;
  }

  async upsertClipEmbedding(embedding: ClipEmbeddingInsert): Promise<ClipEmbedding> {
    const { data, error } = await this.client
      .from('clip_embeddings')
      .upsert(embedding)
      .select()
      .single();

    if (error) throw error;
    return data as ClipEmbedding;
  }

  async deleteClipEmbedding(clipId: string): Promise<void> {
    const { error } = await this.client
      .from('clip_embeddings')
      .delete()
      .eq('clip_id', clipId);

    if (error) throw error;
  }

  async searchClipsBySimilarity(
    queryEmbedding: number[],
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<ClipSearchResult[]> {
    const { data, error } = await this.client.rpc('search_clips_by_embedding', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) throw error;

    // Fetch full clip data for the results
    const clipIds = (data || []).map((r: { clip_id: string }) => r.clip_id);
    if (clipIds.length === 0) return [];

    const { data: clips, error: clipError } = await this.client
      .from('clips')
      .select('*')
      .in('id', clipIds);

    if (clipError) throw clipError;

    // Merge similarity scores with clips
    const similarityMap = new Map((data || []).map((r: { clip_id: string; similarity: number }) => [r.clip_id, r.similarity]));
    return (clips || []).map((clip) => ({
      ...clip,
      similarity: similarityMap.get(clip.id) || 0,
    })) as ClipSearchResult[];
  }

  // ==========================================================================
  // Chat Conversations
  // ==========================================================================

  async getChatConversations(
    filter?: ChatConversationFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<ChatConversation>> {
    const { page = 1, limit = 20, orderBy = 'updated_at', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('chat_conversations')
      .select('*', { count: 'exact' });

    if (filter?.user_id) {
      query = query.eq('user_id', filter.user_id);
    }
    if (filter?.search) {
      query = query.ilike('title', `%${filter.search}%`);
    }

    query = query
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as ChatConversation[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getChatConversationById(id: string): Promise<ChatConversation | null> {
    const { data, error } = await this.client
      .from('chat_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ChatConversation | null;
  }

  async getChatConversationWithMessages(id: string): Promise<ChatConversationWithMessages | null> {
    const { data, error } = await this.client
      .from('chat_conversations')
      .select(`
        *,
        messages:chat_messages(*)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ChatConversationWithMessages | null;
  }

  async createChatConversation(conversation: ChatConversationInsert): Promise<ChatConversation> {
    const { data, error } = await this.client
      .from('chat_conversations')
      .insert(conversation)
      .select()
      .single();

    if (error) throw error;
    return data as ChatConversation;
  }

  async updateChatConversation(id: string, update: ChatConversationUpdate): Promise<ChatConversation> {
    const { data, error } = await this.client
      .from('chat_conversations')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ChatConversation;
  }

  async deleteChatConversation(id: string): Promise<void> {
    const { error } = await this.client
      .from('chat_conversations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Chat Messages
  // ==========================================================================

  async getChatMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await this.client
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as ChatMessage[];
  }

  async createChatMessage(message: ChatMessageInsert): Promise<ChatMessage> {
    const { data, error } = await this.client
      .from('chat_messages')
      .insert(message)
      .select()
      .single();

    if (error) throw error;

    // Update conversation's updated_at
    await this.client
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.conversation_id);

    return data as ChatMessage;
  }

  async deleteChatMessage(id: string): Promise<void> {
    const { error } = await this.client
      .from('chat_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Assembled Videos
  // ==========================================================================

  async getAssembledVideos(
    filter?: AssembledVideoFilter,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<AssembledVideo>> {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDirection = 'desc' } = pagination || {};
    const offset = (page - 1) * limit;

    let query = this.client
      .from('assembled_videos')
      .select('*', { count: 'exact' });

    if (filter?.user_id) {
      query = query.eq('user_id', filter.user_id);
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
      data: (data || []) as AssembledVideo[],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getAssembledVideoById(id: string): Promise<AssembledVideo | null> {
    const { data, error } = await this.client
      .from('assembled_videos')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as AssembledVideo | null;
  }

  async createAssembledVideo(video: AssembledVideoInsert): Promise<AssembledVideo> {
    const { data, error } = await this.client
      .from('assembled_videos')
      .insert(video)
      .select()
      .single();

    if (error) throw error;
    return data as AssembledVideo;
  }

  async updateAssembledVideo(id: string, update: AssembledVideoUpdate): Promise<AssembledVideo> {
    const { data, error } = await this.client
      .from('assembled_videos')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as AssembledVideo;
  }

  async completeAssembledVideo(id: string, fileUrl: string, fileKey: string, durationSeconds: number): Promise<AssembledVideo> {
    return this.updateAssembledVideo(id, {
      file_url: fileUrl,
      file_key: fileKey,
      duration_seconds: durationSeconds,
      status: 'completed',
    });
  }

  async failAssembledVideo(id: string, errorMessage: string): Promise<AssembledVideo> {
    return this.updateAssembledVideo(id, {
      status: 'failed',
      error_message: errorMessage,
    });
  }

  async deleteAssembledVideo(id: string): Promise<void> {
    const { error } = await this.client
      .from('assembled_videos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==========================================================================
  // Extended Clip Queries
  // ==========================================================================

  async getClipComplete(id: string): Promise<ClipComplete | null> {
    const { data, error } = await this.client
      .from('clips')
      .select(`
        *,
        source:sources(*),
        tags:clip_tags(
          clip_id,
          tag_id,
          confidence_score,
          assigned_by,
          tag:tags(*)
        ),
        quality:clip_quality(*),
        groups:clip_group_members(
          clip_id,
          group_id,
          similarity_score,
          is_representative,
          group:clip_groups(*)
        )
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as ClipComplete | null;
  }

  async getHighQualityClips(minQuality: number = 3.5, sourceId?: string): Promise<ClipWithQuality[]> {
    const { data, error } = await this.client.rpc('get_high_quality_clips', {
      min_quality: minQuality,
      source_filter: sourceId || null,
    });

    if (error) throw error;

    // Fetch full clip data for the results
    const clipIds = (data || []).map((r: { clip_id: string }) => r.clip_id);
    if (clipIds.length === 0) return [];

    const { data: clips, error: clipError } = await this.client
      .from('clips')
      .select(`
        *,
        quality:clip_quality(*)
      `)
      .in('id', clipIds);

    if (clipError) throw clipError;

    return (clips || []) as ClipWithQuality[];
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
