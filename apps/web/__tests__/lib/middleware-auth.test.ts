import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { updateSession } from '@/lib/supabase/middleware';
import { config } from '@/middleware';

const matcher = new RegExp(`^${config.matcher[0]}$`);
const request = (path: string) => new NextRequest(new URL(path, 'https://app.example'));

describe('API authentication', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    // jsdom swaps the global Headers; NextResponse.next() checks against it.
    vi.stubGlobal('Headers', request('/').headers.constructor);
    getUser.mockReset();
  });

  it('runs the middleware on API routes but not on the signed webhooks', () => {
    expect(matcher.test('/api/clips')).toBe(true);
    expect(matcher.test('/api/media/a/b.mp4')).toBe(true);
    expect(matcher.test('/api/webhooks/cloudflare')).toBe(false);
    expect(matcher.test('/api/webhooks/processing')).toBe(false);
  });

  it('answers 401 to an anonymous API request', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await updateSession(request('/api/clips'));
    expect(response.status).toBe(401);
  });

  it('lets a signed-in user through to the API', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const response = await updateSession(request('/api/clips'));
    expect(response.status).toBe(200);
  });

  it('still redirects anonymous page requests to the login page', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await updateSession(request('/clips'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
  });
});
