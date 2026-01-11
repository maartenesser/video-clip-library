# @video-clip-library/storage

Cloudflare R2 storage client for the video clip library system. Provides presigned URL generation for secure uploads and downloads, along with utilities for file key management.

## Features

- **Presigned URL Generation**: Secure upload and download URLs with configurable expiration
- **S3-Compatible**: Uses AWS SDK with Cloudflare R2's S3-compatible API
- **File Organization**: Consistent key generation for sources, clips, and thumbnails
- **Batch Operations**: Efficient multi-object deletion
- **Public URL Support**: Optional public URL generation for CDN access

## Installation

```bash
pnpm add @video-clip-library/storage
```

## Environment Variables

The following environment variables are required:

```bash
# Cloudflare Account ID (found in Cloudflare dashboard)
R2_ACCOUNT_ID=your-account-id

# R2 API Token credentials (create in Cloudflare dashboard > R2 > API Tokens)
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key

# R2 bucket name
R2_BUCKET_NAME=your-bucket-name

# Optional: Public URL for the bucket (if public access is enabled)
# This is used for generating public URLs to assets like thumbnails
R2_PUBLIC_URL=https://your-bucket.your-domain.com
```

### Getting Credentials

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **R2** in the sidebar
3. Find your **Account ID** in the sidebar
4. Create an **API Token** with read/write permissions
5. Copy the **Access Key ID** and **Secret Access Key**

## Usage

### Basic Setup

```typescript
import { R2Client, createR2ClientFromEnv } from '@video-clip-library/storage';

// Create from environment variables
const r2 = createR2ClientFromEnv();

// Or create with explicit config
const r2 = new R2Client({
  accountId: 'your-account-id',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  bucketName: 'your-bucket',
  publicUrl: 'https://cdn.example.com', // optional
});
```

### Generating Upload URLs

```typescript
import { generateSourceKey } from '@video-clip-library/storage';

// Generate a presigned upload URL for a source video
const sourceId = 'abc-123';
const key = generateSourceKey(sourceId); // 'sources/abc-123/original.mp4'
const uploadUrl = await r2.getUploadUrl(key, 'video/mp4', 3600);

// Client can now PUT to this URL to upload the file
```

### Generating Download URLs

```typescript
import { generateClipKey } from '@video-clip-library/storage';

// Generate a presigned download URL for a clip
const clipId = 'xyz-789';
const key = generateClipKey(clipId); // 'clips/xyz-789.mp4'
const downloadUrl = await r2.getDownloadUrl(key, 3600);

// Client can GET this URL to download the file
```

### Working with Thumbnails

```typescript
import { generateThumbnailKey } from '@video-clip-library/storage';

const clipId = 'xyz-789';
const key = generateThumbnailKey(clipId); // 'thumbnails/xyz-789.jpg'

// For public thumbnails (if R2_PUBLIC_URL is configured)
const publicUrl = r2.getPublicUrl(key);
// Returns: https://cdn.example.com/thumbnails/xyz-789.jpg

// For private thumbnails
const signedUrl = await r2.getDownloadUrl(key, 900); // 15 min expiry
```

### Deleting Files

```typescript
// Delete a single file
await r2.deleteObject('clips/xyz-789.mp4');

// Delete multiple files
const results = await r2.deleteObjects([
  'clips/xyz-789.mp4',
  'thumbnails/xyz-789.jpg',
]);

// Check results
results.forEach((result) => {
  if (!result.success) {
    console.error(`Failed to delete ${result.key}: ${result.error}`);
  }
});
```

### Checking if File Exists

```typescript
const exists = await r2.objectExists('clips/xyz-789.mp4');
if (exists) {
  // File exists in R2
}
```

## File Organization

The storage package follows a consistent file organization pattern:

```
bucket/
├── sources/
│   └── {sourceId}/
│       ├── original.mp4      # Original uploaded video
│       └── thumbnail.jpg     # Source preview thumbnail
├── clips/
│   └── {clipId}.mp4          # Generated video clips
└── thumbnails/
    └── {clipId}.jpg          # Clip thumbnails
```

### Key Generation Functions

| Function | Pattern | Example |
|----------|---------|---------|
| `generateSourceKey(id)` | `sources/{id}/original.mp4` | `sources/abc123/original.mp4` |
| `generateClipKey(id)` | `clips/{id}.mp4` | `clips/xyz789.mp4` |
| `generateThumbnailKey(id)` | `thumbnails/{id}.jpg` | `thumbnails/xyz789.jpg` |
| `generateSourceThumbnailKey(id)` | `sources/{id}/thumbnail.jpg` | `sources/abc123/thumbnail.jpg` |

## API Reference

### R2Client

#### Constructor

```typescript
new R2Client(config: R2Config)
```

#### Methods

| Method | Description |
|--------|-------------|
| `getUploadUrl(key, contentType, expiresIn?)` | Generate presigned PUT URL |
| `getDownloadUrl(key, expiresIn?)` | Generate presigned GET URL |
| `deleteObject(key)` | Delete a single object |
| `deleteObjects(keys)` | Delete multiple objects |
| `getPublicUrl(key)` | Get public URL (requires `publicUrl` config) |
| `objectExists(key)` | Check if object exists |
| `getS3Client()` | Get underlying S3Client for advanced operations |
| `getBucketName()` | Get configured bucket name |

### Utility Functions

| Function | Description |
|----------|-------------|
| `generateSourceKey(sourceId, filename?)` | Generate source video key |
| `generateClipKey(clipId, extension?)` | Generate clip video key |
| `generateThumbnailKey(clipId, extension?)` | Generate thumbnail key |
| `generateSourceThumbnailKey(sourceId, extension?)` | Generate source thumbnail key |
| `parseStorageKey(key)` | Parse a storage key to extract type and ID |
| `getContentType(extension)` | Get MIME type for file extension |
| `getExtensionFromContentType(contentType)` | Get extension for MIME type |

## Default Expiration Times

```typescript
import { DEFAULT_EXPIRATION } from '@video-clip-library/storage';

DEFAULT_EXPIRATION.UPLOAD;   // 3600 (1 hour)
DEFAULT_EXPIRATION.DOWNLOAD; // 3600 (1 hour)
DEFAULT_EXPIRATION.SHORT;    // 900 (15 minutes)
DEFAULT_EXPIRATION.LONG;     // 86400 (24 hours)
```

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Clean build artifacts
pnpm clean
```

## License

MIT
