import { describe, it, expect, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '@/app/api/clips/[id]/route';
import { mockDb, parseResponse } from '../../setup';
import { mockClip, mockClipWithTags } from '../../mocks/database';
import { NextRequest } from 'next/server';

describe('GET /api/clips/[id]', () => {
  const clipId = 'e47ac10b-58cc-4372-a567-0e02b2c3d480';

  beforeEach(() => {
    mockDb.getClipWithTags.mockResolvedValue(mockClipWithTags);
  });

  it('should get a clip with tags', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`);

    const response = await GET(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ id: string; tags: object[] }>(response);

    expect(response.status).toBe(200);
    expect(data.id).toBe(clipId);
    expect(data.tags).toHaveLength(1);
  });

  it('should return 404 for non-existent clip', async () => {
    mockDb.getClipWithTags.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`);

    const response = await GET(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Clip not found');
  });

  it('should return 400 for invalid UUID', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips/invalid-id');

    const response = await GET(request, { params: Promise.resolve({ id: 'invalid-id' }) });

    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/clips/[id]', () => {
  const clipId = 'e47ac10b-58cc-4372-a567-0e02b2c3d480';

  beforeEach(() => {
    mockDb.getClipById.mockResolvedValue(mockClip);
    mockDb.updateClip.mockResolvedValue({ ...mockClip, transcript_segment: 'Updated transcript' });
  });

  it('should update a clip transcript', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ transcript_segment: 'Updated transcript' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ transcript_segment: string }>(response);

    expect(response.status).toBe(200);
    expect(data.transcript_segment).toBe('Updated transcript');
    expect(mockDb.updateClip).toHaveBeenCalledWith(clipId, { transcript_segment: 'Updated transcript' });
  });

  it('should update clip times', async () => {
    mockDb.updateClip.mockResolvedValue({
      ...mockClip,
      start_time_seconds: 15,
      end_time_seconds: 45,
    });

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ start_time_seconds: 15, end_time_seconds: 45 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(200);
    expect(mockDb.updateClip).toHaveBeenCalledWith(clipId, {
      start_time_seconds: 15,
      end_time_seconds: 45,
    });
  });

  it('should return 400 when end_time is not greater than start_time', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ start_time_seconds: 50, end_time_seconds: 30 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe('End time must be greater than start time');
  });

  it('should return 400 for empty update', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toBe('No fields to update');
  });

  it('should return 404 for non-existent clip', async () => {
    mockDb.getClipById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ transcript_segment: 'Updated' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid detection_method', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ detection_method: 'invalid' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/clips/[id]', () => {
  const clipId = 'e47ac10b-58cc-4372-a567-0e02b2c3d480';

  beforeEach(() => {
    mockDb.getClipById.mockResolvedValue(mockClip);
    mockDb.deleteClip.mockResolvedValue(undefined);
  });

  it('should delete a clip successfully', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Clip deleted');
    expect(mockDb.deleteClip).toHaveBeenCalledWith(clipId);
  });

  it('should return 404 for non-existent clip', async () => {
    mockDb.getClipById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(404);
  });
});
