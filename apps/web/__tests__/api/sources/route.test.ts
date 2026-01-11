import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/sources/route';
import { mockDb, parseResponse } from '../../setup';
import { mockSource } from '../../mocks/database';
import { NextRequest } from 'next/server';

describe('GET /api/sources', () => {
  beforeEach(() => {
    mockDb.getSources.mockResolvedValue({
      data: [mockSource],
      count: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('should list sources with default pagination', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources');

    const response = await GET(request);
    const data = await parseResponse<{ data: object[]; count: number }>(response);

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.count).toBe(1);
    expect(mockDb.getSources).toHaveBeenCalledWith(
      expect.objectContaining({}),
      expect.objectContaining({
        page: 1,
        limit: 20,
        orderBy: 'created_at',
        orderDirection: 'desc',
      })
    );
  });

  it('should apply pagination parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources?page=2&limit=10');

    await GET(request);

    expect(mockDb.getSources).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        page: 2,
        limit: 10,
      })
    );
  });

  it('should filter by status', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources?status=completed');

    await GET(request);

    expect(mockDb.getSources).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
      expect.anything()
    );
  });

  it('should filter by source_type', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources?source_type=youtube');

    await GET(request);

    expect(mockDb.getSources).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'youtube' }),
      expect.anything()
    );
  });

  it('should apply search filter', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources?search=test');

    await GET(request);

    expect(mockDb.getSources).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'test' }),
      expect.anything()
    );
  });

  it('should return 400 for invalid page number', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources?page=-1');

    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for limit exceeding maximum', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources?limit=200');

    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});

describe('POST /api/sources', () => {
  const validPayload = {
    title: 'New Video',
    description: 'A new video description',
    source_type: 'upload',
    creator_name: 'Creator',
    original_file_url: 'https://storage.example.com/sources/abc/original.mp4',
    original_file_key: 'sources/abc/original.mp4',
  };

  beforeEach(() => {
    mockDb.createSource.mockResolvedValue({
      ...mockSource,
      ...validPayload,
      status: 'pending',
    });
    mockDb.createProcessingJob.mockResolvedValue({
      id: 'job-123',
      source_id: mockSource.id,
      job_type: 'transcription',
      status: 'pending',
      progress_percent: 0,
      error_message: null,
      created_at: '2024-01-01T00:00:00Z',
    });
  });

  it('should create a source successfully', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources', {
      method: 'POST',
      body: JSON.stringify(validPayload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const data = await parseResponse<{ id: string; title: string }>(response);

    expect(response.status).toBe(201);
    expect(data.title).toBe('New Video');
    expect(mockDb.createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        ...validPayload,
        status: 'pending',
      })
    );
    expect(mockDb.createProcessingJob).toHaveBeenCalled();
  });

  it('should return 400 for missing title', async () => {
    const payload = { ...validPayload };
    delete (payload as Record<string, unknown>).title;

    const request = new NextRequest('http://localhost:3000/api/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for missing original_file_url', async () => {
    const payload = { ...validPayload };
    delete (payload as Record<string, unknown>).original_file_url;

    const request = new NextRequest('http://localhost:3000/api/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid source_type', async () => {
    const payload = { ...validPayload, source_type: 'invalid' };

    const request = new NextRequest('http://localhost:3000/api/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid URL format', async () => {
    const payload = { ...validPayload, original_file_url: 'not-a-url' };

    const request = new NextRequest('http://localhost:3000/api/sources', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});
