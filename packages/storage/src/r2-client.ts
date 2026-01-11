import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { R2Config, DeleteResult } from './types.js';
import { DEFAULT_EXPIRATION } from './types.js';

/**
 * Cloudflare R2 storage client
 *
 * Provides methods for generating presigned URLs for uploads and downloads,
 * as well as delete operations for managing objects in R2 storage.
 *
 * R2 is S3-compatible, so we use the AWS SDK S3 client with R2's endpoint.
 */
export class R2Client {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl?: string;

  /**
   * Create a new R2Client instance
   *
   * @param config - R2 configuration including credentials and bucket info
   */
  constructor(config: R2Config) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;

    const s3Config: S3ClientConfig = {
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    this.client = new S3Client(s3Config);
  }

  /**
   * Generate a presigned URL for uploading a file
   *
   * @param key - The object key (path) in the bucket
   * @param contentType - MIME type of the file being uploaded
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Presigned URL for PUT request
   *
   * @example
   * ```typescript
   * const uploadUrl = await r2.getUploadUrl(
   *   'sources/abc123/original.mp4',
   *   'video/mp4',
   *   3600
   * );
   * // Use uploadUrl with PUT request to upload file
   * ```
   */
  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = DEFAULT_EXPIRATION.UPLOAD
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Generate a presigned URL for downloading a file
   *
   * @param key - The object key (path) in the bucket
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Presigned URL for GET request
   *
   * @example
   * ```typescript
   * const downloadUrl = await r2.getDownloadUrl('clips/xyz789.mp4', 3600);
   * // Use downloadUrl to download the file
   * ```
   */
  async getDownloadUrl(
    key: string,
    expiresIn: number = DEFAULT_EXPIRATION.DOWNLOAD
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Delete a single object from R2
   *
   * @param key - The object key (path) to delete
   * @throws Error if deletion fails
   *
   * @example
   * ```typescript
   * await r2.deleteObject('clips/xyz789.mp4');
   * ```
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Delete multiple objects from R2 in a single request
   *
   * @param keys - Array of object keys to delete
   * @returns Array of results indicating success/failure for each key
   *
   * @example
   * ```typescript
   * const results = await r2.deleteObjects([
   *   'clips/abc.mp4',
   *   'thumbnails/abc.jpg'
   * ]);
   * ```
   */
  async deleteObjects(keys: string[]): Promise<DeleteResult[]> {
    if (keys.length === 0) {
      return [];
    }

    // R2/S3 limits batch deletes to 1000 objects
    const batchSize = 1000;
    const results: DeleteResult[] = [];

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);

      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: false,
        },
      });

      try {
        const response = await this.client.send(command);

        // Add successful deletions
        if (response.Deleted) {
          for (const deleted of response.Deleted) {
            if (deleted.Key) {
              results.push({
                success: true,
                key: deleted.Key,
              });
            }
          }
        }

        // Add failed deletions
        if (response.Errors) {
          for (const error of response.Errors) {
            if (error.Key) {
              results.push({
                success: false,
                key: error.Key,
                error: error.Message || 'Unknown error',
              });
            }
          }
        }
      } catch (error) {
        // If the entire batch fails, mark all keys as failed
        for (const key of batch) {
          results.push({
            success: false,
            key,
            error: error instanceof Error ? error.message : 'Batch delete failed',
          });
        }
      }
    }

    return results;
  }

  /**
   * Get the public URL for an object (if public access is configured)
   *
   * @param key - The object key (path) in the bucket
   * @returns Public URL string
   * @throws Error if public URL is not configured
   *
   * @example
   * ```typescript
   * const publicUrl = r2.getPublicUrl('thumbnails/abc.jpg');
   * // Returns: https://your-public-url.com/thumbnails/abc.jpg
   * ```
   */
  getPublicUrl(key: string): string {
    if (!this.publicUrl) {
      throw new Error(
        'Public URL is not configured. Set R2_PUBLIC_URL environment variable.'
      );
    }

    // Remove trailing slash from publicUrl and leading slash from key
    const baseUrl = this.publicUrl.replace(/\/$/, '');
    const cleanKey = key.replace(/^\//, '');

    return `${baseUrl}/${cleanKey}`;
  }

  /**
   * Check if an object exists in R2
   *
   * @param key - The object key (path) to check
   * @returns True if object exists, false otherwise
   *
   * @example
   * ```typescript
   * const exists = await r2.objectExists('clips/xyz789.mp4');
   * if (exists) {
   *   // Object exists
   * }
   * ```
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      // NotFound error means object doesn't exist
      if (
        error instanceof Error &&
        (error.name === 'NotFound' || error.name === '404')
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get the underlying S3 client for advanced operations
   *
   * @returns The S3Client instance
   */
  getS3Client(): S3Client {
    return this.client;
  }

  /**
   * Get the bucket name
   *
   * @returns The configured bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }
}

/**
 * Create an R2Client from environment variables
 *
 * Required environment variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 *
 * Optional:
 * - R2_PUBLIC_URL
 *
 * @returns Configured R2Client instance
 * @throws Error if required environment variables are missing
 */
export function createR2ClientFromEnv(): R2Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId) {
    throw new Error('R2_ACCOUNT_ID environment variable is required');
  }
  if (!accessKeyId) {
    throw new Error('R2_ACCESS_KEY_ID environment variable is required');
  }
  if (!secretAccessKey) {
    throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
  }
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is required');
  }

  return new R2Client({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  });
}
