# Video Clip Library - Features Documentation

## Overview

The Video Clip Library is a comprehensive platform for managing, processing, and assembling video clips with AI-powered quality analysis and semantic search capabilities.

## Core Features

### 1. Video Processing Pipeline

The Cloudflare Workers-based pipeline processes uploaded videos through the following stages:

1. **Audio Extraction** - Extracts audio from video files using FFmpeg
2. **Transcription** - Uses OpenAI Whisper API for accurate speech-to-text
3. **Clip Detection** - Identifies natural clip boundaries based on transcript segments
4. **Clip Extraction** - Cuts video into individual clips with thumbnails
5. **Quality Analysis** - Rates clips on speaking quality, audio quality, and overall score
6. **Error Detection** - Identifies filler words, hesitations, and silences
7. **Duplicate Detection** - Groups similar clips using sentence embeddings
8. **Upload to R2** - Stores processed clips in Cloudflare R2

### 2. Clip Quality Rating

Each clip receives quality scores (1-5 scale):

- **Overall Quality Score** - Combined metric weighing all factors
- **Speaking Quality Score** - Based on words per minute, filler word density, hesitation frequency
- **Audio Quality Score** - Volume consistency, background noise levels

Additional metrics tracked:
- Filler word count (um, uh, like, basically, etc.)
- Hesitation count
- Words per minute
- Suggested trim points

### 3. Similar Clip Detection & Grouping

Clips are automatically grouped by similarity:

- **Duplicate** (≥95% similarity) - Same content, different takes
- **Multiple Takes** (≥85% + near in time) - Same topic recorded sequentially
- **Same Topic** (≥75% similarity) - Related content

Visual indicators in the UI:
- Red left border = Duplicate
- Purple left border = Multiple Takes
- Blue left border = Same Topic

### 4. Auto-Clean Feature

Automatically removes imperfections from clips:

**API Endpoint:** `POST /api/clips/[id]/clean`

- Analyzes clips for filler words and silences
- Removes detected issues using FFmpeg
- Preserves natural speech flow with small buffers
- Uploads cleaned version to R2

**Supported removals:**
- English filler words: um, uh, like, basically, actually, literally, honestly
- Dutch filler words: eh, euh, uhm, nou, ja, dus, eigenlijk, gewoon
- Silences longer than 0.3 seconds

### 5. Clip Assembly

Combine multiple clips into a single video:

**Features:**
- Drag-and-drop clip ordering
- Smooth crossfade transitions (0.5s)
- Burned-in subtitles with customizable styling
- AI guidance prompts for optimizing the final video

**Subtitle options:**
- Font: Arial, Helvetica, Verdana, Georgia, Times New Roman
- Size: Small (18px) to Extra Large (48px)
- Position: Top, Middle, Bottom
- Custom color picker

### 6. Semantic Search & AI Chat

**Semantic Search:** `/api/clips/semantic-search`
- Search clips by meaning, not just keywords
- Uses OpenAI embeddings for vector similarity

**AI Chat:** `/chat`
- Natural language interface for finding clips
- AI suggests clips based on your description
- Can recommend clip order for specific formats (YouTube Shorts, etc.)

### 7. Clip Management

**From Clips Page:**
- Filter by quality score (Excellent 4.5+, Good 4+, Above avg 3.5+, Average 3+)
- Filter by tags
- Search transcripts
- Sort by date or duration

**Clip Actions:**
- Add to Assembly - Queue clips for video creation
- Auto-Clean - Remove filler words and silences
- Delete - Remove clip permanently (with confirmation)

### 8. Source Video Management

**Upload sources via:**
- Direct file upload
- URL import

**Source thumbnails:**
- Auto-generated from first good frame
- Displayed in source list

## API Reference

### Clips API

```
GET /api/clips - List clips with filters
GET /api/clips/[id] - Get single clip
DELETE /api/clips/[id] - Delete clip
POST /api/clips/[id]/clean - Analyze/clean clip
GET /api/clips/[id]/clean - Get cleaning status
POST /api/clips/semantic-search - Semantic search
```

### Assembly API

```
GET /api/assemble - List assembly jobs
POST /api/assemble - Create assembly job
GET /api/assemble/[id] - Get job status
```

### Chat API

```
POST /api/chat - Send message to AI assistant
GET /api/chat/conversations - List conversations
```

### Sources API

```
GET /api/sources - List sources
POST /api/sources - Create source
GET /api/sources/[id] - Get source with clips
DELETE /api/sources/[id] - Delete source
```

### Tags API

```
GET /api/tags - List all tags
POST /api/tags - Create tag
```

## Database Schema

### Main Tables

- `sources` - Uploaded video sources
- `clips` - Individual video clips
- `clip_tags` - Many-to-many clip-tag relationships
- `tags` - Tag definitions

### Quality Tables

- `clip_quality` - Quality scores and metrics
- `clip_embeddings` - Vector embeddings for semantic search
- `clip_groups` - Similarity groups
- `clip_group_members` - Group membership

### Assembly Tables

- `assembled_videos` - Assembly job records

### Chat Tables

- `chat_conversations` - Conversation sessions
- `chat_messages` - Individual messages

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# OpenAI
OPENAI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

## Worker Scripts

### Processing Workers (`workers/cloudflare/`)

- `pipeline.py` - Main video processing pipeline
- `transcribe.py` - Whisper transcription
- `error_detect.py` - Filler word and silence detection
- `quality_rate.py` - Quality scoring
- `assemble.py` - Video assembly with transitions

### Utility Scripts

- `auto_clean_clip.py` - Standalone clip cleaning
- `analyze_clips_quality.py` - Batch quality analysis
- `generate_source_thumbnail.py` - Thumbnail generation

## Testing

### E2E Tests (Playwright)

```bash
pnpm exec playwright test
```

Test files in `apps/web/e2e/`:
- Upload flow
- Clip quality display
- Chat assistant
- Assembly workflow

### Unit Tests

```bash
pnpm test
```

## Deployment

### Vercel (Frontend)

The Next.js app deploys to Vercel with:
- Automatic builds on push
- Environment variables configured in Vercel dashboard

### Cloudflare Workers (Processing)

Deploy with:
```bash
wrangler deploy
```

Requires Cloudflare paid plan ($5/month) for CPU-intensive video processing.
