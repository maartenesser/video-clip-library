# @video-clip-library/database

Supabase database schema and TypeScript client for the video clip library system.

## Overview

This package provides:

- SQL schema definitions for Supabase/PostgreSQL
- TypeScript types for all database entities
- A typed client for CRUD operations
- Seed data for default content tags
- Row Level Security (RLS) policies

## Installation

```bash
npm install @video-clip-library/database
```

## Quick Start

```typescript
import { createDatabaseClient } from '@video-clip-library/database';

const db = createDatabaseClient({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_ANON_KEY!,
});

// Create a source
const source = await db.createSource({
  title: 'My Video',
  source_type: 'upload',
  original_file_url: 'https://example.com/video.mp4',
  original_file_key: 'videos/my-video.mp4',
  status: 'pending',
});

// Get sources with pagination
const { data, count, page, totalPages } = await db.getSources(
  { status: 'completed' },
  { page: 1, limit: 20 }
);
```

## Database Schema

### Tables

#### sources

Stores uploaded video files.

| Column            | Type         | Description                         |
| ----------------- | ------------ | ----------------------------------- |
| id                | UUID         | Primary key                         |
| title             | VARCHAR(255) | Video title                         |
| description       | TEXT         | Optional description                |
| source_type       | VARCHAR(50)  | youtube, upload, tiktok, instagram  |
| creator_name      | VARCHAR(255) | Original content creator            |
| original_file_url | TEXT         | URL to stored file                  |
| original_file_key | VARCHAR(500) | Storage key/path                    |
| duration_seconds  | DECIMAL      | Video duration                      |
| status            | VARCHAR(50)  | pending, processing, completed, failed |
| error_message     | TEXT         | Error details if failed             |
| created_at        | TIMESTAMPTZ  | Creation timestamp                  |
| updated_at        | TIMESTAMPTZ  | Last update timestamp               |

#### clips

Generated clips from source videos.

| Column              | Type         | Description                      |
| ------------------- | ------------ | -------------------------------- |
| id                  | UUID         | Primary key                      |
| source_id           | UUID         | Foreign key to sources           |
| start_time_seconds  | DECIMAL      | Clip start time                  |
| end_time_seconds    | DECIMAL      | Clip end time                    |
| duration_seconds    | DECIMAL      | Computed: end - start            |
| file_url            | TEXT         | URL to clip file                 |
| file_key            | VARCHAR(500) | Storage key/path                 |
| thumbnail_url       | TEXT         | Optional thumbnail               |
| transcript_segment  | TEXT         | Transcript for this segment      |
| detection_method    | VARCHAR(50)  | ai, manual, silence, scene_change |
| created_at          | TIMESTAMPTZ  | Creation timestamp               |

#### tags

Content type labels for categorizing clips.

| Column        | Type         | Description              |
| ------------- | ------------ | ------------------------ |
| id            | UUID         | Primary key              |
| name          | VARCHAR(100) | Unique tag name          |
| category      | VARCHAR(50)  | Tag category             |
| color         | VARCHAR(7)   | Hex color code           |
| is_system     | BOOLEAN      | System-managed tag       |
| display_order | INT          | UI display order         |

#### clip_tags

Many-to-many junction table for clips and tags.

| Column           | Type        | Description                |
| ---------------- | ----------- | -------------------------- |
| clip_id          | UUID        | Foreign key to clips       |
| tag_id           | UUID        | Foreign key to tags        |
| confidence_score | DECIMAL     | AI confidence (0-1)        |
| assigned_by      | VARCHAR(50) | ai, user, or system        |

#### processing_jobs

Tracks background processing tasks.

| Column           | Type        | Description                         |
| ---------------- | ----------- | ----------------------------------- |
| id               | UUID        | Primary key                         |
| source_id        | UUID        | Foreign key to sources              |
| job_type         | VARCHAR(50) | transcription, clip_detection, etc. |
| status           | VARCHAR(50) | pending, running, completed, failed |
| progress_percent | INT         | 0-100 progress indicator            |
| error_message    | TEXT        | Error details if failed             |
| created_at       | TIMESTAMPTZ | Creation timestamp                  |

## Default Tags

The seed data includes these system tags:

| Name               | Color   | Description                    |
| ------------------ | ------- | ------------------------------ |
| hook               | #FF6B6B | Attention-grabbing opener      |
| product_benefit    | #4ECDC4 | Product feature highlights     |
| proof              | #45B7D1 | Evidence and demonstrations    |
| testimonial        | #96CEB4 | Customer testimonials          |
| objection_handling | #FFEAA7 | Addressing concerns            |
| cta                | #DDA0DD | Call to action                 |
| b_roll             | #98D8C8 | Supplementary footage          |

## API Reference

### Sources

```typescript
// Get paginated sources
const result = await db.getSources(filter?, pagination?);

// Get single source
const source = await db.getSourceById(id);

// Create source
const source = await db.createSource(data);

// Update source
const source = await db.updateSource(id, updates);

// Delete source
await db.deleteSource(id);
```

### Clips

```typescript
// Get paginated clips
const result = await db.getClips(filter?, pagination?);

// Get clip by ID
const clip = await db.getClipById(id);

// Get clip with tags
const clip = await db.getClipWithTags(id);

// Get clips by source
const clips = await db.getClipsBySourceId(sourceId);

// Get clips by tag IDs
const clips = await db.getClipsByTagIds(tagIds);

// Create clip
const clip = await db.createClip(data);

// Update clip
const clip = await db.updateClip(id, updates);

// Delete clip
await db.deleteClip(id);
```

### Tags

```typescript
// Get all tags
const tags = await db.getTags(filter?);

// Get system tags
const tags = await db.getSystemTags();

// Get tag by ID or name
const tag = await db.getTagById(id);
const tag = await db.getTagByName(name);

// Create tag
const tag = await db.createTag(data);

// Update tag
const tag = await db.updateTag(id, updates);

// Delete tag (non-system only)
await db.deleteTag(id);
```

### Clip Tags

```typescript
// Get tags for a clip
const clipTags = await db.getClipTags(clipId);

// Add tag to clip
const clipTag = await db.addTagToClip({ clip_id, tag_id, confidence_score });

// Add multiple tags
const clipTags = await db.addTagsToClip(clipId, tagIds, assignedBy);

// Remove tag from clip
await db.removeTagFromClip(clipId, tagId);

// Update confidence score
const clipTag = await db.updateClipTagConfidence(clipId, tagId, score);
```

### Processing Jobs

```typescript
// Get paginated jobs
const result = await db.getProcessingJobs(filter?, pagination?);

// Get job by ID
const job = await db.getProcessingJobById(id);

// Get jobs by source
const jobs = await db.getProcessingJobsBySourceId(sourceId);

// Create job
const job = await db.createProcessingJob(data);

// Update job
const job = await db.updateProcessingJob(id, updates);

// Helper methods
const job = await db.updateProcessingJobProgress(id, percent);
const job = await db.completeProcessingJob(id);
const job = await db.failProcessingJob(id, errorMessage);

// Delete job
await db.deleteProcessingJob(id);
```

## Setup

### 1. Create Supabase Project

Create a new project at [supabase.com](https://supabase.com).

### 2. Run Schema Migration

Execute `src/schema.sql` in the Supabase SQL editor.

### 3. Seed Default Tags

Execute `src/seed.sql` in the Supabase SQL editor.

### 4. Configure Environment

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck
```

## Row Level Security

All tables have RLS enabled with policies for:

- **SELECT**: All users can read
- **INSERT/UPDATE**: Authenticated users only
- **DELETE**: Authenticated users only (system tags protected)

## License

MIT
