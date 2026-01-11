import { vi } from 'vitest';

// Create mock storage client
export function createMockStorageClient() {
  return {
    getUploadUrl: vi.fn().mockResolvedValue('https://storage.example.com/upload?signature=abc123'),
    getDownloadUrl: vi.fn().mockResolvedValue('https://storage.example.com/download?signature=abc123'),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    deleteObjects: vi.fn().mockResolvedValue([{ success: true, key: 'test-key' }]),
    getPublicUrl: vi.fn().mockReturnValue('https://storage.example.com/public/test-key'),
    objectExists: vi.fn().mockResolvedValue(true),
    getS3Client: vi.fn().mockReturnValue({}),
    getBucketName: vi.fn().mockReturnValue('test-bucket'),
  };
}

export type MockStorageClient = ReturnType<typeof createMockStorageClient>;
