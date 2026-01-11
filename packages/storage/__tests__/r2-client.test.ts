import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockSend,
  mockGetSignedUrl,
  setupS3Mocks,
  clearMockCommands,
  mockCommands,
  mockObjectNotFound,
  mockDeleteError,
  mockBatchFailure,
} from './mocks/s3-mock.js';

// Mock the AWS SDK modules before importing R2Client
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({
    constructor: { name: 'DeleteObjectCommand' },
    input,
  })),
  DeleteObjectsCommand: vi.fn().mockImplementation((input) => ({
    constructor: { name: 'DeleteObjectsCommand' },
    input,
  })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({
    constructor: { name: 'GetObjectCommand' },
    input,
  })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({
    constructor: { name: 'PutObjectCommand' },
    input,
  })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({
    constructor: { name: 'HeadObjectCommand' },
    input,
  })),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Import after mocking
import { R2Client, createR2ClientFromEnv } from '../src/r2-client.js';
import type { R2Config } from '../src/types.js';

describe('R2Client', () => {
  const testConfig: R2Config = {
    accountId: 'test-account-id',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    bucketName: 'test-bucket',
    publicUrl: 'https://cdn.example.com',
  };

  let client: R2Client;

  beforeEach(() => {
    setupS3Mocks();
    client = new R2Client(testConfig);
  });

  afterEach(() => {
    clearMockCommands();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an R2Client with valid config', () => {
      expect(client).toBeInstanceOf(R2Client);
      expect(client.getBucketName()).toBe('test-bucket');
    });

    it('should work without public URL', () => {
      const configWithoutPublicUrl: R2Config = {
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        bucketName: 'test-bucket',
      };
      const clientWithoutPublicUrl = new R2Client(configWithoutPublicUrl);
      expect(clientWithoutPublicUrl).toBeInstanceOf(R2Client);
    });
  });

  describe('getUploadUrl', () => {
    it('should generate a presigned upload URL', async () => {
      const key = 'sources/abc123/original.mp4';
      const contentType = 'video/mp4';

      const url = await client.getUploadUrl(key, contentType);

      expect(url).toContain('test-bucket');
      expect(url).toContain(key);
      expect(url).toContain('operation=upload');
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should use default expiration when not specified', async () => {
      const key = 'clips/xyz789.mp4';
      const contentType = 'video/mp4';

      const url = await client.getUploadUrl(key, contentType);

      // Default expiration is 3600 seconds
      expect(url).toContain('X-Amz-Expires=3600');
    });

    it('should use custom expiration when specified', async () => {
      const key = 'clips/xyz789.mp4';
      const contentType = 'video/mp4';
      const expiresIn = 7200;

      const url = await client.getUploadUrl(key, contentType, expiresIn);

      expect(url).toContain(`X-Amz-Expires=${expiresIn}`);
    });

    it('should include content type in the signed URL request', async () => {
      const key = 'thumbnails/abc.jpg';
      const contentType = 'image/jpeg';

      await client.getUploadUrl(key, contentType);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: expect.objectContaining({
            ContentType: contentType,
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate a presigned download URL', async () => {
      const key = 'clips/xyz789.mp4';

      const url = await client.getDownloadUrl(key);

      expect(url).toContain('test-bucket');
      expect(url).toContain(key);
      expect(url).toContain('operation=download');
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('should use default expiration when not specified', async () => {
      const key = 'clips/xyz789.mp4';

      const url = await client.getDownloadUrl(key);

      expect(url).toContain('X-Amz-Expires=3600');
    });

    it('should use custom expiration when specified', async () => {
      const key = 'clips/xyz789.mp4';
      const expiresIn = 900;

      const url = await client.getDownloadUrl(key, expiresIn);

      expect(url).toContain(`X-Amz-Expires=${expiresIn}`);
    });
  });

  describe('deleteObject', () => {
    it('should delete a single object', async () => {
      const key = 'clips/xyz789.mp4';

      await client.deleteObject(key);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockCommands).toHaveLength(1);
      expect(mockCommands[0].type).toBe('DeleteObjectCommand');
      expect(mockCommands[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: key,
      });
    });
  });

  describe('deleteObjects', () => {
    it('should delete multiple objects in a single request', async () => {
      const keys = ['clips/abc.mp4', 'thumbnails/abc.jpg', 'clips/xyz.mp4'];

      const results = await client.deleteObjects(keys);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.key).toBe(keys[index]);
      });
    });

    it('should return empty array for empty keys', async () => {
      const results = await client.deleteObjects([]);

      expect(results).toEqual([]);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const keys = ['clips/forbidden.mp4'];
      mockDeleteError('Access Denied');

      const results = await client.deleteObjects(keys);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].key).toBe('clips/forbidden.mp4');
      expect(results[0].error).toBe('Access Denied');
    });

    it('should handle batch operation failure', async () => {
      const keys = ['clips/abc.mp4', 'clips/xyz.mp4'];
      mockBatchFailure('Network error');

      const results = await client.deleteObjects(keys);

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });
    });
  });

  describe('getPublicUrl', () => {
    it('should generate a public URL when configured', () => {
      const key = 'thumbnails/abc.jpg';

      const url = client.getPublicUrl(key);

      expect(url).toBe('https://cdn.example.com/thumbnails/abc.jpg');
    });

    it('should handle trailing slash in public URL', () => {
      const configWithTrailingSlash: R2Config = {
        ...testConfig,
        publicUrl: 'https://cdn.example.com/',
      };
      const clientWithSlash = new R2Client(configWithTrailingSlash);

      const url = clientWithSlash.getPublicUrl('thumbnails/abc.jpg');

      expect(url).toBe('https://cdn.example.com/thumbnails/abc.jpg');
    });

    it('should handle leading slash in key', () => {
      const url = client.getPublicUrl('/thumbnails/abc.jpg');

      expect(url).toBe('https://cdn.example.com/thumbnails/abc.jpg');
    });

    it('should throw error when public URL is not configured', () => {
      const configWithoutPublicUrl: R2Config = {
        accountId: 'test-account-id',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        bucketName: 'test-bucket',
      };
      const clientWithoutPublicUrl = new R2Client(configWithoutPublicUrl);

      expect(() => clientWithoutPublicUrl.getPublicUrl('test.jpg')).toThrow(
        'Public URL is not configured'
      );
    });
  });

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      const key = 'clips/xyz789.mp4';

      const exists = await client.objectExists(key);

      expect(exists).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return false when object does not exist', async () => {
      const key = 'clips/nonexistent.mp4';
      mockObjectNotFound();

      const exists = await client.objectExists(key);

      expect(exists).toBe(false);
    });

    it('should throw on other errors', async () => {
      const key = 'clips/error.mp4';
      mockSend.mockRejectedValueOnce(new Error('Internal Server Error'));

      await expect(client.objectExists(key)).rejects.toThrow(
        'Internal Server Error'
      );
    });
  });

  describe('getS3Client', () => {
    it('should return the underlying S3 client', () => {
      const s3Client = client.getS3Client();

      expect(s3Client).toBeDefined();
      expect(s3Client.send).toBeDefined();
    });
  });
});

describe('createR2ClientFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create client from environment variables', () => {
    process.env.R2_ACCOUNT_ID = 'env-account-id';
    process.env.R2_ACCESS_KEY_ID = 'env-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'env-secret-key';
    process.env.R2_BUCKET_NAME = 'env-bucket';
    process.env.R2_PUBLIC_URL = 'https://env-cdn.example.com';

    const client = createR2ClientFromEnv();

    expect(client).toBeInstanceOf(R2Client);
    expect(client.getBucketName()).toBe('env-bucket');
    expect(client.getPublicUrl('test.jpg')).toBe(
      'https://env-cdn.example.com/test.jpg'
    );
  });

  it('should throw when R2_ACCOUNT_ID is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'test';
    process.env.R2_SECRET_ACCESS_KEY = 'test';
    process.env.R2_BUCKET_NAME = 'test';

    expect(() => createR2ClientFromEnv()).toThrow(
      'R2_ACCOUNT_ID environment variable is required'
    );
  });

  it('should throw when R2_ACCESS_KEY_ID is missing', () => {
    process.env.R2_ACCOUNT_ID = 'test';
    process.env.R2_SECRET_ACCESS_KEY = 'test';
    process.env.R2_BUCKET_NAME = 'test';

    expect(() => createR2ClientFromEnv()).toThrow(
      'R2_ACCESS_KEY_ID environment variable is required'
    );
  });

  it('should throw when R2_SECRET_ACCESS_KEY is missing', () => {
    process.env.R2_ACCOUNT_ID = 'test';
    process.env.R2_ACCESS_KEY_ID = 'test';
    process.env.R2_BUCKET_NAME = 'test';

    expect(() => createR2ClientFromEnv()).toThrow(
      'R2_SECRET_ACCESS_KEY environment variable is required'
    );
  });

  it('should throw when R2_BUCKET_NAME is missing', () => {
    process.env.R2_ACCOUNT_ID = 'test';
    process.env.R2_ACCESS_KEY_ID = 'test';
    process.env.R2_SECRET_ACCESS_KEY = 'test';

    expect(() => createR2ClientFromEnv()).toThrow(
      'R2_BUCKET_NAME environment variable is required'
    );
  });

  it('should work without R2_PUBLIC_URL', () => {
    process.env.R2_ACCOUNT_ID = 'test';
    process.env.R2_ACCESS_KEY_ID = 'test';
    process.env.R2_SECRET_ACCESS_KEY = 'test';
    process.env.R2_BUCKET_NAME = 'test';

    const client = createR2ClientFromEnv();

    expect(client).toBeInstanceOf(R2Client);
    expect(() => client.getPublicUrl('test.jpg')).toThrow(
      'Public URL is not configured'
    );
  });
});
