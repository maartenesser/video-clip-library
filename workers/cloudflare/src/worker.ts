/**
 * Cloudflare Worker that proxies requests to the Video Processing Container.
 * Uses Durable Objects to manage container instances.
 */

import { DurableObject } from "cloudflare:workers";

// Extend the Env interface to include secrets (accessed at runtime)
interface ExtendedEnv extends Env {
  OPENAI_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

/**
 * VideoProcessor Durable Object that wraps the Python container.
 * Each instance manages a single container.
 */
export class VideoProcessor extends DurableObject<ExtendedEnv> {
  private container: any | null = null;

  async fetch(request: Request): Promise<Response> {
    // Get or start the container
    if (!this.container) {
      try {
        // @ts-ignore - Container API is provided by Cloudflare runtime
        this.container = await this.ctx.container.start({
          env: {
            OPENAI_API_KEY: this.env.OPENAI_API_KEY || '',
            R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID || '',
            R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY || '',
            R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID || '',
            R2_BUCKET_NAME: 'video-clips',
            R2_ENDPOINT_URL: `https://${this.env.R2_ACCOUNT_ID || 'unknown'}.r2.cloudflarestorage.com`,
            WEBHOOK_SECRET: this.env.WEBHOOK_SECRET || '',
            SUPABASE_URL: this.env.SUPABASE_URL || '',
            SUPABASE_SERVICE_KEY: this.env.SUPABASE_SERVICE_KEY || '',
          },
        });
      } catch (error) {
        console.error('Failed to start container:', error);
        return new Response(JSON.stringify({
          error: 'Failed to start container',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Forward the request to the container
    const url = new URL(request.url);
    const containerUrl = `http://localhost:8080${url.pathname}${url.search}`;

    const containerRequest = new Request(containerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    try {
      const response = await this.container.fetch(containerRequest);
      return response;
    } catch (error) {
      console.error('Container request failed:', error);
      return new Response(JSON.stringify({
        error: 'Container request failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

/**
 * Main Worker fetch handler.
 * Routes requests to appropriate Durable Object instances.
 */
export default {
  async fetch(request: Request, env: ExtendedEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check at worker level
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        service: 'video-processing-pipeline',
        status: 'healthy',
        timestamp: new Date().toISOString(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Route to container for processing endpoints
    if (url.pathname.startsWith('/process') ||
        url.pathname.startsWith('/health') ||
        url.pathname.startsWith('/ready') ||
        url.pathname.startsWith('/jobs')) {

      // For /process, use source_id from body as instance key for load balancing
      let instanceId = 'default';

      if (url.pathname === '/process' && request.method === 'POST') {
        // Clone request to read body while preserving original
        const clonedRequest = request.clone();
        try {
          const body = await clonedRequest.json() as { source_id?: string };
          if (body.source_id) {
            instanceId = body.source_id;
          }
        } catch (e) {
          // If body parsing fails, use default instance
          console.error('Failed to parse request body:', e);
        }
      }

      // Get the Durable Object stub
      const id = env.VIDEO_PROCESSOR.idFromName(instanceId);
      const stub = env.VIDEO_PROCESSOR.get(id);

      // Forward to the Durable Object
      const response = await stub.fetch(request);

      // Add CORS headers to response
      const newResponse = new Response(response.body, response);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
      });

      return newResponse;
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  },
};
