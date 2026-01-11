import { R2Client } from '@video-clip-library/storage';

let storageClient: R2Client | null = null;

/**
 * Get the storage client singleton
 */
export function getStorage(): R2Client {
  if (!storageClient) {
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

    storageClient = new R2Client({
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      publicUrl,
    });
  }

  return storageClient;
}

/**
 * Reset the storage client (for testing)
 */
export function resetStorage(): void {
  storageClient = null;
}

/**
 * Set a mock storage client (for testing)
 */
export function setStorage(client: R2Client): void {
  storageClient = client;
}
