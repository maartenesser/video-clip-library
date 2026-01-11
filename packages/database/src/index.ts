// Export client
export { DatabaseClient, createDatabaseClient, type DatabaseClientConfig } from './client.js';

// Export all types
export type {
  // Enums
  SourceStatus,
  SourceType,
  JobType,
  JobStatus,
  DetectionMethod,
  AssignedBy,
  // Base types
  Source,
  Clip,
  Tag,
  ClipTag,
  ProcessingJob,
  // Insert types
  SourceInsert,
  ClipInsert,
  TagInsert,
  ClipTagInsert,
  ProcessingJobInsert,
  // Update types
  SourceUpdate,
  ClipUpdate,
  TagUpdate,
  ClipTagUpdate,
  ProcessingJobUpdate,
  // Extended types
  ClipWithSource,
  ClipWithTags,
  ClipFull,
  SourceWithClips,
  SourceWithJobs,
  SourceFull,
  // Filters
  SourceFilter,
  ClipFilter,
  TagFilter,
  ProcessingJobFilter,
  // Pagination
  PaginationParams,
  PaginatedResult,
  // Database schema
  Database,
} from './types.js';
