import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/clips/route';
import { mockDb, parseResponse } from '../../setup';
import { mockClip } from '../../mocks/database';
import { NextRequest } from 'next/server';

describe('GET /api/clips', () => {
  beforeEach(() => {
    mockDb.getClips.mockResolvedValue({
      data: [mockClip],
      count: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockDb.getClipsByTagIds.mockResolvedValue([mockClip]);
  });

  it('should list clips with default pagination', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips');

    const response = await GET(request);
    const data = await parseResponse<{ data: object[]; count: number }>(response);

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.count).toBe(1);
  });

  it('should apply pagination parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips?page=2&limit=10');

    await GET(request);

    expect(mockDb.getClips).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        page: 2,
        limit: 10,
      })
    );
  });

  it('should filter by source_id', async () => {
    const sourceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const request = new NextRequest(`http://localhost:3000/api/clips?source_id=${sourceId}`);

    await GET(request);

    expect(mockDb.getClips).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: sourceId }),
      expect.anything()
    );
  });

  it('should filter by min_duration', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips?min_duration=10');

    await GET(request);

    expect(mockDb.getClips).toHaveBeenCalledWith(
      expect.objectContaining({ min_duration: 10 }),
      expect.anything()
    );
  });

  it('should filter by max_duration', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips?max_duration=60');

    await GET(request);

    expect(mockDb.getClips).toHaveBeenCalledWith(
      expect.objectContaining({ max_duration: 60 }),
      expect.anything()
    );
  });

  it('should filter by tag_ids', async () => {
    const tagId = 'd47ac10b-58cc-4372-a567-0e02b2c3d481';
    const request = new NextRequest(`http://localhost:3000/api/clips?tag_ids=${tagId}`);

    const response = await GET(request);
    const data = await parseResponse<{ data: object[] }>(response);

    expect(response.status).toBe(200);
    expect(mockDb.getClipsByTagIds).toHaveBeenCalledWith([tagId]);
    expect(data.data).toHaveLength(1);
  });

  it('should filter by multiple tag_ids', async () => {
    const tagId1 = 'd47ac10b-58cc-4372-a567-0e02b2c3d481';
    const tagId2 = 'a47ac10b-58cc-4372-a567-0e02b2c3d482';
    const request = new NextRequest(`http://localhost:3000/api/clips?tag_ids=${tagId1},${tagId2}`);

    await GET(request);

    expect(mockDb.getClipsByTagIds).toHaveBeenCalledWith([tagId1, tagId2]);
  });

  it('should search by transcript text', async () => {
    mockDb.getClips.mockResolvedValue({
      data: [
        { ...mockClip, transcript_segment: 'This contains the search term' },
        { ...mockClip, id: 'other-id', transcript_segment: 'No match here' },
      ],
      count: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const request = new NextRequest('http://localhost:3000/api/clips?search=search');

    const response = await GET(request);
    const data = await parseResponse<{ data: { transcript_segment: string }[] }>(response);

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].transcript_segment).toContain('search');
  });

  it('should return 400 for invalid source_id UUID', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips?source_id=invalid');

    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for negative min_duration', async () => {
    const request = new NextRequest('http://localhost:3000/api/clips?min_duration=-5');

    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
