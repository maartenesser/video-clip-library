import { describe, it, expect, beforeEach } from 'vitest';
import { GET, DELETE } from '@/app/api/sources/[id]/route';
import { mockDb, parseResponse } from '../../setup';
import { mockSource, mockClip, mockProcessingJob } from '../../mocks/database';
import { NextRequest } from 'next/server';

describe('GET /api/sources/[id]', () => {
  const sourceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  beforeEach(() => {
    mockDb.getSourceById.mockResolvedValue(mockSource);
    mockDb.getClipsBySourceId.mockResolvedValue([mockClip]);
    mockDb.getProcessingJobsBySourceId.mockResolvedValue([mockProcessingJob]);
  });

  it('should get a source with clips and jobs', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sources/${sourceId}`);

    const response = await GET(request, { params: Promise.resolve({ id: sourceId }) });
    const data = await parseResponse<{
      id: string;
      clips: object[];
      processing_jobs: object[];
    }>(response);

    expect(response.status).toBe(200);
    expect(data.id).toBe(sourceId);
    expect(data.clips).toHaveLength(1);
    expect(data.processing_jobs).toHaveLength(1);
  });

  it('should return 404 for non-existent source', async () => {
    mockDb.getSourceById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/sources/${sourceId}`);

    const response = await GET(request, { params: Promise.resolve({ id: sourceId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Source not found');
  });

  it('should return 400 for invalid UUID', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources/invalid-id');

    const response = await GET(request, { params: Promise.resolve({ id: 'invalid-id' }) });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/sources/[id]', () => {
  const sourceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  beforeEach(() => {
    mockDb.getSourceById.mockResolvedValue(mockSource);
    mockDb.deleteSource.mockResolvedValue(undefined);
  });

  it('should delete a source successfully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/sources/${sourceId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: sourceId }) });
    const data = await parseResponse<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Source deleted');
    expect(mockDb.deleteSource).toHaveBeenCalledWith(sourceId);
  });

  it('should return 404 for non-existent source', async () => {
    mockDb.getSourceById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/sources/${sourceId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: sourceId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Source not found');
  });

  it('should return 400 for invalid UUID', async () => {
    const request = new NextRequest('http://localhost:3000/api/sources/invalid-id', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid-id' }) });

    expect(response.status).toBe(400);
  });
});
