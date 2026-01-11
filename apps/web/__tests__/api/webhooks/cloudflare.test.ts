import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/webhooks/cloudflare/route';
import { mockDb, parseResponse } from '../../setup';
import { mockProcessingJob, mockSource } from '../../mocks/database';
import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

// Helper to create a valid webhook signature
function createSignature(payload: string, secret: string = 'test-webhook-secret'): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('POST /api/webhooks/cloudflare', () => {
  const jobId = 'c47ac10b-58cc-4372-a567-0e02b2c3d482';
  const sourceId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  const validPayload = {
    job_id: jobId,
    source_id: sourceId,
    job_type: 'transcription',
    status: 'completed',
    result: {
      transcript: 'This is the transcript',
    },
  };

  beforeEach(() => {
    mockDb.getProcessingJobById.mockResolvedValue(mockProcessingJob);
    mockDb.completeProcessingJob.mockResolvedValue({ ...mockProcessingJob, status: 'completed' });
    mockDb.getProcessingJobsBySourceId.mockResolvedValue([{ ...mockProcessingJob, status: 'completed' }]);
    mockDb.updateSource.mockResolvedValue({ ...mockSource, status: 'completed' });
  });

  it('should process a completed job webhook', async () => {
    const body = JSON.stringify(validPayload);
    const signature = createSignature(body);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ success: boolean; message: string }>(response);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Webhook processed');
    expect(mockDb.completeProcessingJob).toHaveBeenCalledWith(jobId);
  });

  it('should process a failed job webhook', async () => {
    const payload = {
      ...validPayload,
      status: 'failed',
      error_message: 'Transcription failed',
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    mockDb.failProcessingJob.mockResolvedValue({ ...mockProcessingJob, status: 'failed' });

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockDb.failProcessingJob).toHaveBeenCalledWith(jobId, 'Transcription failed');
  });

  it('should create clips when clip_detection job completes', async () => {
    const clipData = {
      start_time_seconds: 10,
      end_time_seconds: 30,
      file_key: 'clips/clip1.mp4',
      file_url: 'https://storage.example.com/clips/clip1.mp4',
      thumbnail_url: 'https://storage.example.com/thumbnails/clip1.jpg',
      transcript_segment: 'Clip transcript',
      detection_method: 'ai',
    };

    const payload = {
      ...validPayload,
      job_type: 'clip_detection',
      result: {
        clips: [clipData],
      },
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    mockDb.createClip.mockResolvedValue({
      id: 'new-clip-id',
      source_id: sourceId,
      ...clipData,
      duration_seconds: 20,
      created_at: '2024-01-01T00:00:00Z',
    });

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockDb.createClip).toHaveBeenCalledWith({
      source_id: sourceId,
      start_time_seconds: 10,
      end_time_seconds: 30,
      file_key: 'clips/clip1.mp4',
      file_url: 'https://storage.example.com/clips/clip1.mp4',
      thumbnail_url: 'https://storage.example.com/thumbnails/clip1.jpg',
      transcript_segment: 'Clip transcript',
      detection_method: 'ai',
    });
  });

  it('should return 401 for invalid signature', async () => {
    const body = JSON.stringify(validPayload);
    const invalidSignature = 'invalid-signature';

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': invalidSignature,
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid webhook signature');
  });

  it('should return 401 for missing signature', async () => {
    const body = JSON.stringify(validPayload);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should return 404 for non-existent job', async () => {
    mockDb.getProcessingJobById.mockResolvedValue(null);

    const body = JSON.stringify(validPayload);
    const signature = createSignature(body);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);
    const data = await parseResponse<{ error: string }>(response);

    expect(response.status).toBe(404);
    expect(data.error).toBe('Processing job not found');
  });

  it('should return 400 for invalid job_type', async () => {
    const payload = {
      ...validPayload,
      job_type: 'invalid_type',
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid status', async () => {
    const payload = {
      ...validPayload,
      status: 'invalid_status',
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid UUID in job_id', async () => {
    const payload = {
      ...validPayload,
      job_id: 'invalid-uuid',
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should update source status to completed when all jobs complete', async () => {
    const body = JSON.stringify(validPayload);
    const signature = createSignature(body);

    mockDb.getProcessingJobsBySourceId.mockResolvedValue([
      { ...mockProcessingJob, status: 'completed' },
    ]);

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    await POST(request);

    expect(mockDb.updateSource).toHaveBeenCalledWith(sourceId, { status: 'completed' });
  });

  it('should update source status to failed when a job fails', async () => {
    const payload = {
      ...validPayload,
      status: 'failed',
      error_message: 'Job failed',
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    mockDb.failProcessingJob.mockResolvedValue({ ...mockProcessingJob, status: 'failed' });

    const request = new NextRequest('http://localhost:3000/api/webhooks/cloudflare', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature,
      },
    });

    await POST(request);

    expect(mockDb.updateSource).toHaveBeenCalledWith(sourceId, {
      status: 'failed',
      error_message: 'Job failed',
    });
  });
});
