import { z } from 'zod';

// ============================================================================
// Source Schemas
// ============================================================================

export const sourceTypeSchema = z.enum(['youtube', 'upload', 'tiktok', 'instagram', 'other']);

export const createSourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(5000).optional().nullable(),
  source_type: sourceTypeSchema,
  creator_name: z.string().max(255).optional().nullable(),
  original_file_url: z.string().url('Invalid URL'),
  original_file_key: z.string().min(1, 'File key is required'),
  duration_seconds: z.number().positive().optional().nullable(),
});

export const uploadUrlSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().regex(/^video\//, 'Content type must be a video type'),
  title: z.string().min(1, 'Title is required').max(255).optional(),
  description: z.string().max(5000).optional(),
  source_type: sourceTypeSchema.optional().default('upload'),
  creator_name: z.string().max(255).optional(),
});

export const listSourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  source_type: sourceTypeSchema.optional(),
  search: z.string().optional(),
  orderBy: z.string().optional().default('created_at'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================================================
// Clip Schemas
// ============================================================================

export const detectionMethodSchema = z.enum(['ai', 'manual', 'silence', 'scene_change']);

export const updateClipSchema = z.object({
  start_time_seconds: z.number().nonnegative().optional(),
  end_time_seconds: z.number().positive().optional(),
  transcript_segment: z.string().optional().nullable(),
  detection_method: detectionMethodSchema.optional(),
});

export const listClipsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  source_id: z.string().uuid().optional(),
  tag_ids: z.string().transform((val) => val.split(',').filter(Boolean)).optional(),
  search: z.string().optional(),
  min_duration: z.coerce.number().nonnegative().optional(),
  max_duration: z.coerce.number().positive().optional(),
  orderBy: z.string().optional().default('created_at'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================================================
// Tag Schemas
// ============================================================================

export const addTagsSchema = z.object({
  tag_ids: z.array(z.string().uuid()).min(1, 'At least one tag ID is required'),
  assigned_by: z.enum(['ai', 'user', 'system']).optional().default('user'),
});

export const addTagByNameSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100).optional().default('custom'),
  assigned_by: z.enum(['ai', 'user', 'system']).optional().default('user'),
});

// ============================================================================
// Webhook Schemas
// ============================================================================

export const cloudflareWebhookSchema = z.object({
  job_id: z.string().uuid(),
  source_id: z.string().uuid(),
  job_type: z.enum(['transcription', 'clip_detection', 'thumbnail_generation', 'tagging']),
  status: z.enum(['completed', 'failed']),
  result: z.object({
    clips: z.array(z.object({
      start_time_seconds: z.number().nonnegative(),
      end_time_seconds: z.number().positive(),
      file_key: z.string(),
      file_url: z.string().url(),
      thumbnail_url: z.string().url().optional(),
      transcript_segment: z.string().optional(),
      detection_method: detectionMethodSchema.optional(),
    })).optional(),
    transcript: z.string().optional(),
    error: z.string().optional(),
  }).optional(),
  error_message: z.string().optional(),
});

// ============================================================================
// Common Schemas
// ============================================================================

export const uuidParamSchema = z.string().uuid('Invalid ID format');

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;
export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;
export type UpdateClipInput = z.infer<typeof updateClipSchema>;
export type ListClipsQuery = z.infer<typeof listClipsQuerySchema>;
export type AddTagsInput = z.infer<typeof addTagsSchema>;
export type CloudflareWebhookPayload = z.infer<typeof cloudflareWebhookSchema>;
