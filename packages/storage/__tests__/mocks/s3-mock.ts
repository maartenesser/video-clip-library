import { vi } from 'vitest';

/**
 * Mock S3 client for testing
 *
 * This mock allows testing R2Client without hitting actual R2 endpoints.
 * It captures commands sent to the client and returns predictable responses.
 */

// Track commands sent to the mock client
export const mockCommands: Array<{
  type: string;
  input: Record<string, unknown>;
}> = [];

// Clear mock state between tests
export function clearMockCommands(): void {
  mockCommands.length = 0;
}

// Mock send function that captures commands
export const mockSend = vi.fn().mockImplementation((command) => {
  const commandName = command.constructor.name;
  const input = command.input || {};

  mockCommands.push({
    type: commandName,
    input: input as Record<string, unknown>,
  });

  // Return appropriate responses based on command type
  switch (commandName) {
    case 'DeleteObjectCommand':
      return Promise.resolve({});

    case 'DeleteObjectsCommand':
      // Return successful deletion for all objects
      const objects = input.Delete?.Objects || [];
      return Promise.resolve({
        Deleted: objects.map((obj: { Key: string }) => ({ Key: obj.Key })),
        Errors: [],
      });

    case 'HeadObjectCommand':
      // Default to object exists
      return Promise.resolve({
        ContentLength: 1024,
        ContentType: 'video/mp4',
      });

    case 'PutObjectCommand':
      return Promise.resolve({
        ETag: '"mock-etag"',
      });

    case 'GetObjectCommand':
      return Promise.resolve({
        Body: 'mock-body',
        ContentType: 'video/mp4',
      });

    default:
      return Promise.resolve({});
  }
});

// Create a mock S3Client class
export const MockS3Client = vi.fn().mockImplementation(() => ({
  send: mockSend,
}));

// Mock getSignedUrl function
export const mockGetSignedUrl = vi.fn().mockImplementation(
  (client, command, options) => {
    const commandName = command.constructor.name;
    const input = command.input || {};
    const bucket = input.Bucket || 'test-bucket';
    const key = input.Key || 'test-key';
    const expiresIn = options?.expiresIn || 3600;

    // Generate a mock presigned URL that includes relevant info for testing
    const operation = commandName === 'PutObjectCommand' ? 'upload' : 'download';
    const expiry = Math.floor(Date.now() / 1000) + expiresIn;

    return Promise.resolve(
      `https://${bucket}.r2.cloudflarestorage.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&operation=${operation}&expiry=${expiry}`
    );
  }
);

// Setup function to apply mocks
export function setupS3Mocks(): void {
  // These mocks will be applied in test files using vi.mock()
  clearMockCommands();
  mockSend.mockClear();
  mockGetSignedUrl.mockClear();
}

/**
 * Configure mock to simulate object not found
 */
export function mockObjectNotFound(): void {
  mockSend.mockImplementationOnce((command) => {
    const commandName = command.constructor.name;
    if (commandName === 'HeadObjectCommand') {
      const error = new Error('Not Found');
      error.name = 'NotFound';
      return Promise.reject(error);
    }
    return mockSend(command);
  });
}

/**
 * Configure mock to simulate deletion error
 */
export function mockDeleteError(errorMessage: string = 'Access Denied'): void {
  mockSend.mockImplementationOnce((command) => {
    const commandName = command.constructor.name;
    if (commandName === 'DeleteObjectsCommand') {
      const input = command.input || {};
      const objects = input.Delete?.Objects || [];
      return Promise.resolve({
        Deleted: [],
        Errors: objects.map((obj: { Key: string }) => ({
          Key: obj.Key,
          Code: 'AccessDenied',
          Message: errorMessage,
        })),
      });
    }
    return mockSend(command);
  });
}

/**
 * Configure mock to simulate batch operation failure
 */
export function mockBatchFailure(errorMessage: string = 'Batch failed'): void {
  mockSend.mockImplementationOnce(() => {
    return Promise.reject(new Error(errorMessage));
  });
}
