import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/sources/upload-url/route';
import { mockStorage, createMockRequest, parseResponse } from '../../setup';
import { NextRequest } from 'next/server';

describe('POST /api/sources/upload-url', () => {
  const validPayload = {
    filename: 'test-video.mp4',
    contentType: 'video/mp4',
    title: 'Test Video',
    description: 'A test video',
    source_type: 'upload',
    creator_name: 'Test Creator',
  };

  beforeEach(() => {
    mockStorage.getUploadUrl.mockResolvedValue('https://storage.example.com/upload?signature=abc123');
    mockStorage.getPublicUrl.mockReturnValue('https://storage.example.com/public/test-key');
  });

  it('should generate an upload URL successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources/upload-url', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await parseResponse<{
      sourceId: string;
      uploadUrl: string;
      fileKey: string;
      fileUrl: string;
      expiresIn: number;
      metadata: object;
    }>(response);

    expect(response.status).toBe(201);
    expect(data.sourceId).toBeDefined();
    expect(data.uploadUrl).toBe('https://storage.example.com/upload?signature=abc123');
    expect(data.fileKey).toContain('sources/');
    expect(data.fileKey).toContain('test-video.mp4');
    expect(data.expiresIn).toBe(3600);
    expect(data.metadata.title).toBe('Test Video');
  });

  it('should use default source_type when not provided', async () => {
    const payload = {
      filename: 'video.mp4',
      contentType: 'video/mp4',
    };

    const request = new NextRequest('http://localhost:3000/api/sources/upload-url', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await parseResponse<{ metadata: { source_type: string } }>(response);

    expect(response.status).toBe(201);
    expect(data.metadata.source_type).toBe('upload');
  });

  it('should return 400 for missing filename', async () => {
    const payload = {
      contentType: 'video/mp4',
    };

    const request = new NextRequest('http://localhost:3000/api/sources/upload-url', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid content type', async () => {
    const payload = {
      filename: 'document.pdf',
      contentType: 'application/pdf',
    };

    const request = new NextRequest('http://localhost:3000/api/sources/upload-url', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('should return 400 for invalid source_type', async () => {
    const payload = {
      ...validPayload,
      source_type: 'invalid_type',
    };

    const request = new NextRequest('http://localhost:3000/api/sources/upload-url', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
