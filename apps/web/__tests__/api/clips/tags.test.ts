import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/clips/[id]/tags/route';
import { DELETE } from '@/app/api/clips/[id]/tags/[tagId]/route';
import { mockDb, parseResponse } from '../../setup';
import { mockClip, mockTag, mockClipTag } from '../../mocks/database';
import { NextRequest } from 'next/server';

describe('GET /api/clips/[id]/tags', () => {
  const clipId = 'e47ac10b-58cc-4372-a567-0e02b2c3d480';

  beforeEach(() => {
    mockDb.getClipById.mockResolvedValue(mockClip);
    mockDb.getClipTags.mockResolvedValue([{ ...mockClipTag, tag: mockTag }]);
  });

  it('should get tags for a clip', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`);

    const response = await GET(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<object[]>(response);

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(mockDb.getClipTags).toHaveBeenCalledWith(clipId);
  });

  it('should return 404 for non-existent clip', async () => {
    mockDb.getClipById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`);

    const response = await GET(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(404);
  });

  it('should return 400 for invalid UUID', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips/invalid-id/tags');

    const response = await GET(request, { params: Promise.resolve({ id: 'invalid-id' }) });

    expect(response.status).toBe(400);
  });
});

describe('POST /api/clips/[id]/tags', () => {
  const clipId = 'e47ac10b-58cc-4372-a567-0e02b2c3d480';
  const tagId = 'd47ac10b-58cc-4372-a567-0e02b2c3d481';

  beforeEach(() => {
    mockDb.getClipById.mockResolvedValue(mockClip);
    mockDb.getTagById.mockResolvedValue(mockTag);
    mockDb.addTagsToClip.mockResolvedValue([mockClipTag]);
  });

  it('should add tags to a clip', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [tagId] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<object[]>(response);

    expect(response.status).toBe(201);
    expect(data).toHaveLength(1);
    expect(mockDb.addTagsToClip).toHaveBeenCalledWith(clipId, [tagId], 'user');
  });

  it('should add tags with custom assigned_by', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [tagId], assigned_by: 'ai' }),
      headers: { 'content-type': 'application/json' },
    });

    await POST(request, { params: Promise.resolve({ id: clipId }) });

    expect(mockDb.addTagsToClip).toHaveBeenCalledWith(clipId, [tagId], 'ai');
  });

  it('should add multiple tags', async () => {
    const tagId2 = 'a47ac10b-58cc-4372-a567-0e02b2c3d482';

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [tagId, tagId2] }),
      headers: { 'content-type': 'application/json' },
    });

    await POST(request, { params: Promise.resolve({ id: clipId }) });

    expect(mockDb.addTagsToClip).toHaveBeenCalledWith(clipId, [tagId, tagId2], 'user');
  });

  it('should return 404 for non-existent clip', async () => {
    mockDb.getClipById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [tagId] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(404);
  });

  it('should return 400 for non-existent tag', async () => {
    mockDb.getTagById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [tagId] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: clipId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain('Tag not found');
  });

  it('should return 400 for empty tag_ids', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid tag_ids format', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: ['not-a-uuid'] }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid assigned_by', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: [tagId], assigned_by: 'invalid' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ id: clipId }) });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/clips/[id]/tags/[tagId]', () => {
  const clipId = 'e47ac10b-58cc-4372-a567-0e02b2c3d480';
  const tagId = 'd47ac10b-58cc-4372-a567-0e02b2c3d481';

  beforeEach(() => {
    mockDb.getClipById.mockResolvedValue(mockClip);
    mockDb.getTagById.mockResolvedValue(mockTag);
    mockDb.getClipTags.mockResolvedValue([{ ...mockClipTag, tag: mockTag }]);
    mockDb.removeTagFromClip.mockResolvedValue(undefined);
  });

  it('should remove a tag from a clip', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags/${tagId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId, tagId }) });
    const data = await parseResponse<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Tag removed from clip');
    expect(mockDb.removeTagFromClip).toHaveBeenCalledWith(clipId, tagId);
  });

  it('should return 404 for non-existent clip', async () => {
    mockDb.getClipById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags/${tagId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId, tagId }) });

    expect(response.status).toBe(404);
  });

  it('should return 404 for non-existent tag', async () => {
    mockDb.getTagById.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags/${tagId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId, tagId }) });

    expect(response.status).toBe(404);
  });

  it('should return 404 when tag is not associated with clip', async () => {
    mockDb.getClipTags.mockResolvedValue([]);

    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags/${tagId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId, tagId }) });
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tag not associated with this clip');
  });

  it('should return 400 for invalid clip UUID', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/invalid-id/tags/${tagId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'invalid-id', tagId }) });

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid tag UUID', async () => {
    const request = new NextRequest(`http://localhost:3000/api/clips/${clipId}/tags/invalid-id`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: clipId, tagId: 'invalid-id' }) });

    expect(response.status).toBe(400);
  });
});
