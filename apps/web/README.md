# Video Clip Library - Web API

Next.js API layer for the video clip library system. Provides REST API endpoints for managing video sources, clips, and tags.

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Cloudflare R2 account

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=video-clips
R2_PUBLIC_URL=https://your-public-url.com

# Cloudflare Worker Webhook
CLOUDFLARE_WEBHOOK_SECRET=your-webhook-secret
```

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Testing

```bash
pnpm test:api        # Run tests once
pnpm test:api:watch  # Watch mode
pnpm test:api:coverage  # With coverage
```

## API Endpoints

### Sources

#### Generate Upload URL

```
POST /api/sources/upload-url
```

Generate a presigned URL for uploading a source video to R2 storage.

**Request Body:**
```json
{
  "filename": "my-video.mp4",
  "contentType": "video/mp4",
  "title": "My Video",
  "description": "Optional description",
  "source_type": "upload",
  "creator_name": "Creator Name"
}
```

**Response (201):**
```json
{
  "sourceId": "uuid",
  "uploadUrl": "https://r2.../presigned-url",
  "fileKey": "sources/uuid/my-video.mp4",
  "fileUrl": "https://storage.../sources/uuid/my-video.mp4",
  "expiresIn": 3600,
  "metadata": {
    "title": "My Video",
    "description": "Optional description",
    "source_type": "upload",
    "creator_name": "Creator Name"
  }
}
```

#### Create Source

```
POST /api/sources
```

Create a new source after the video has been uploaded.

**Request Body:**
```json
{
  "title": "My Video",
  "description": "Optional description",
  "source_type": "upload",
  "creator_name": "Creator Name",
  "original_file_url": "https://storage.../sources/uuid/video.mp4",
  "original_file_key": "sources/uuid/video.mp4",
  "duration_seconds": 120
}
```

**Response (201):** Source object with processing job created.

#### List Sources

```
GET /api/sources
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `status` - Filter by: pending, processing, completed, failed
- `source_type` - Filter by: youtube, upload, tiktok, instagram, other
- `search` - Search in title and description
- `orderBy` (default: created_at)
- `orderDirection` (default: desc)

**Response:**
```json
{
  "data": [...],
  "count": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

#### Get Source

```
GET /api/sources/:id
```

Returns source with clips and processing jobs.

**Response:**
```json
{
  "id": "uuid",
  "title": "Video Title",
  "clips": [...],
  "processing_jobs": [...]
}
```

#### Delete Source

```
DELETE /api/sources/:id
```

Deletes a source and all associated clips.

### Clips

#### List/Search Clips

```
GET /api/clips
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `source_id` - Filter by source UUID
- `tag_ids` - Comma-separated tag UUIDs
- `search` - Search in transcript
- `min_duration` - Minimum duration in seconds
- `max_duration` - Maximum duration in seconds
- `orderBy` (default: created_at)
- `orderDirection` (default: desc)

#### Get Clip

```
GET /api/clips/:id
```

Returns clip with all tags.

#### Update Clip

```
PATCH /api/clips/:id
```

**Request Body:**
```json
{
  "start_time_seconds": 10,
  "end_time_seconds": 30,
  "transcript_segment": "Updated transcript",
  "detection_method": "manual"
}
```

#### Delete Clip

```
DELETE /api/clips/:id
```

### Tags

#### Get Clip Tags

```
GET /api/clips/:id/tags
```

Returns all tags associated with a clip.

#### Add Tags to Clip

```
POST /api/clips/:id/tags
```

**Request Body:**
```json
{
  "tag_ids": ["uuid1", "uuid2"],
  "assigned_by": "user"
}
```

`assigned_by` options: ai, user, system

#### Remove Tag from Clip

```
DELETE /api/clips/:id/tags/:tagId
```

### Webhooks

#### Cloudflare Worker Webhook

```
POST /api/webhooks/cloudflare
```

Receives job completion notifications from Cloudflare Workers.

**Headers:**
- `x-webhook-signature` - HMAC-SHA256 signature

**Request Body:**
```json
{
  "job_id": "uuid",
  "source_id": "uuid",
  "job_type": "transcription",
  "status": "completed",
  "result": {
    "clips": [...],
    "transcript": "..."
  },
  "error_message": "Optional error"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": [
    {
      "path": "field.name",
      "message": "Validation message"
    }
  ]
}
```

**Status Codes:**
- 200 - Success
- 201 - Created
- 400 - Validation error
- 401 - Unauthorized (invalid webhook signature)
- 404 - Not found
- 500 - Internal server error

## Architecture

```
apps/web/
├── app/
│   ├── api/
│   │   ├── sources/
│   │   │   ├── route.ts         # GET (list), POST (create)
│   │   │   ├── upload-url/
│   │   │   │   └── route.ts     # POST (presigned URL)
│   │   │   └── [id]/
│   │   │       └── route.ts     # GET, DELETE
│   │   ├── clips/
│   │   │   ├── route.ts         # GET (search)
│   │   │   └── [id]/
│   │   │       ├── route.ts     # GET, PATCH, DELETE
│   │   │       └── tags/
│   │   │           ├── route.ts     # GET, POST
│   │   │           └── [tagId]/
│   │   │               └── route.ts # DELETE
│   │   └── webhooks/
│   │       └── cloudflare/
│   │           └── route.ts     # POST
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── api-utils.ts             # Error handling utilities
│   ├── database.ts              # Database client singleton
│   ├── schemas.ts               # Zod validation schemas
│   └── storage.ts               # Storage client singleton
├── __tests__/
│   ├── api/                     # API route tests
│   ├── mocks/                   # Mock clients
│   └── setup.ts                 # Test setup
└── vitest.config.ts
```

## Dependencies

- `@video-clip-library/database` - Supabase client
- `@video-clip-library/storage` - R2 storage client
- `next` - Next.js framework
- `zod` - Schema validation
- `uuid` - UUID generation
