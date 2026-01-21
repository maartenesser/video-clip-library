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

// Helper to delay for a given number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * VideoProcessor Durable Object that wraps the Python container.
 * Each instance manages a single container.
 */
export class VideoProcessor extends DurableObject<ExtendedEnv> {
  private async waitForContainerReady(port: { fetch: (input: Request | string, init?: RequestInit) => Promise<Response> }): Promise<void> {
    const maxChecks = 10;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxChecks; attempt++) {
      try {
        const response = await port.fetch('http://container/ready');
        if (response.ok) {
          return;
        }
      } catch (error) {
        console.error(`Container readiness check ${attempt}/${maxChecks} failed:`, error);
      }

      await sleep(delayMs);
    }
  }

  async fetch(request: Request): Promise<Response> {
    try {
      // @ts-ignore - Container API is provided by Cloudflare runtime
      const container = this.ctx.container;
      if (!container) {
        console.error('Container API not available on context');
        return new Response(JSON.stringify({
          error: 'Container API not available',
          details: 'this.ctx.container is undefined'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const isRunning = container.running;
      console.log('Container running state:', isRunning);

      // Start the container if not already running
      if (!isRunning) {
        console.log('Starting container...');
        await container.start({
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
        console.log('Container start() completed, running:', container.running);

        // Give container time to initialize
        await sleep(3000);
      }
    } catch (error) {
      console.error('Container initialization error:', error);
      return new Response(JSON.stringify({
        error: 'Failed to initialize container',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward the request to the container using getTcpPort
    const url = new URL(request.url);
    const containerUrl = `http://container${url.pathname}${url.search}`;

    // @ts-ignore - Container API is provided by Cloudflare runtime
    const container = this.ctx.container;
    const port = container.getTcpPort(8080);

    await this.waitForContainerReady(port);

    const requestBody = request.body ? await request.arrayBuffer() : null;

    // Retry logic - container may take time to be ready after start()
    const maxRetries = 5;
    const retryDelayMs = 2000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const containerRequest = new Request(containerUrl, {
          method: request.method,
          headers: request.headers,
          body: requestBody ? requestBody.slice(0) : null,
        });

        const response = await port.fetch(containerRequest);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Container request attempt ${attempt}/${maxRetries} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Wait before retrying
          await sleep(retryDelayMs);
        }
      }
    }

    // All retries exhausted
    return new Response(JSON.stringify({
      error: 'Container request failed after retries',
      details: lastError?.message || 'Unknown error',
      retries: maxRetries
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Interface for process request
interface ProcessRequest {
  source_id: string;
  video_url: string;  // This is actually the R2 key
  webhook_url: string;
  min_clip_duration?: number;
  max_clip_duration?: number;
  min_scene_length?: number;
}

// Interface for clip result from container
interface ContainerClip {
  clip_id: string;
  start_time: number;
  end_time: number;
  duration: number;
  video_base64: string;
  thumbnail_base64: string | null;
}

// Interface for container response
interface ContainerResponse {
  job_id: string;
  total_duration: number;
  processing_time_seconds: number;
  total_clips: number;
  clips: ContainerClip[];
  error?: string;
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

    // NEW: Full orchestration endpoint - Worker handles R2 + container + webhook
    if (url.pathname === '/process' && request.method === 'POST') {
      try {
        const body = await request.json() as ProcessRequest;
        console.log('Received process request:', JSON.stringify(body));

        const { source_id, video_url, webhook_url } = body;
        const min_clip_duration = body.min_clip_duration ?? 3.0;
        const max_clip_duration = body.max_clip_duration ?? 20.0;
        const min_scene_length = body.min_scene_length ?? 1.5;

        // Step 1: Download video from R2 using binding
        console.log('Step 1: Downloading video from R2:', video_url);
        const r2Object = await env.VIDEO_BUCKET.get(video_url);

        if (!r2Object) {
          console.error('Video not found in R2:', video_url);
          return new Response(JSON.stringify({
            error: 'Video not found in R2',
            key: video_url,
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const videoBytes = await r2Object.arrayBuffer();
        console.log('Downloaded video, size:', videoBytes.byteLength);

        // Step 2: Send video to container for processing
        console.log('Step 2: Sending video to container for local processing');
        const instanceId = 'default-v7';
        const id = env.VIDEO_PROCESSOR.idFromName(instanceId);
        const stub = env.VIDEO_PROCESSOR.get(id);

        const containerUrl = new URL(request.url);
        containerUrl.pathname = '/process-local';
        containerUrl.search = `?source_id=${encodeURIComponent(source_id)}&min_clip_duration=${min_clip_duration}&max_clip_duration=${max_clip_duration}&min_scene_length=${min_scene_length}`;

        const containerRequest = new Request(containerUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: videoBytes,
        });

        const containerResponse = await stub.fetch(containerRequest);

        if (!containerResponse.ok) {
          const errorText = await containerResponse.text();
          console.error('Container processing failed:', errorText);

          // Call webhook with error
          await callWebhook(webhook_url, {
            source_id,
            status: 'failed',
            error_message: `Container processing failed: ${errorText}`,
          }, env.WEBHOOK_SECRET);

          return new Response(JSON.stringify({
            error: 'Container processing failed',
            details: errorText,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const containerResult = await containerResponse.json() as ContainerResponse;
        console.log('Container processing complete, clips:', containerResult.total_clips);

        // Step 3: Upload clips to R2
        console.log('Step 3: Uploading clips to R2');
        const uploadedClips = [];

        for (const clip of containerResult.clips) {
          const videoKey = `clips/${source_id}/${clip.clip_id}.mp4`;
          const thumbnailKey = `clips/${source_id}/${clip.clip_id}_thumb.jpg`;

          // Decode base64 and upload video
          const videoData = Uint8Array.from(atob(clip.video_base64), c => c.charCodeAt(0));
          await env.VIDEO_BUCKET.put(videoKey, videoData, {
            httpMetadata: { contentType: 'video/mp4' },
          });

          // Upload thumbnail if exists
          let thumbnailUrl = null;
          if (clip.thumbnail_base64) {
            const thumbnailData = Uint8Array.from(atob(clip.thumbnail_base64), c => c.charCodeAt(0));
            await env.VIDEO_BUCKET.put(thumbnailKey, thumbnailData, {
              httpMetadata: { contentType: 'image/jpeg' },
            });
            thumbnailUrl = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/video-clips/${thumbnailKey}`;
          }

          uploadedClips.push({
            start_time_seconds: clip.start_time,
            end_time_seconds: clip.end_time,
            file_url: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/video-clips/${videoKey}`,
            file_key: videoKey,
            thumbnail_url: thumbnailUrl,
            transcript_segment: null, // Transcription not done in container
            detection_method: 'scene-detection',
            tags: [], // Tagging not done in container
          });
        }

        console.log('Uploaded clips to R2:', uploadedClips.length);

        // Step 4: Call webhook with results
        console.log('Step 4: Calling webhook');
        const webhookPayload = {
          source_id,
          status: 'completed',
          clips: uploadedClips,
          duration_seconds: containerResult.total_duration,
        };

        const webhookSuccess = await callWebhook(webhook_url, webhookPayload, env.WEBHOOK_SECRET);
        console.log('Webhook called, success:', webhookSuccess);

        return new Response(JSON.stringify({
          job_id: containerResult.job_id,
          source_id,
          status: 'completed',
          message: 'Video processing completed',
          total_clips: uploadedClips.length,
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

      } catch (error) {
        console.error('Process endpoint error:', error);
        return new Response(JSON.stringify({
          error: 'Processing failed',
          details: error instanceof Error ? error.message : String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Route to container for other endpoints
    if (url.pathname.startsWith('/health') ||
        url.pathname.startsWith('/ready') ||
        url.pathname.startsWith('/jobs') ||
        url.pathname.startsWith('/debug') ||
        url.pathname.startsWith('/process-local')) {

      // Use a single instance for now to simplify debugging
      const instanceId = 'default-v7';
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body;
      const requestBody = hasBody ? await request.arrayBuffer() : null;

      // Get the Durable Object stub
      const id = env.VIDEO_PROCESSOR.idFromName(instanceId);
      const stub = env.VIDEO_PROCESSOR.get(id);

      // Forward to the Durable Object with a reusable body
      const forwardRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: requestBody ? requestBody.slice(0) : null,
      });
      const response = await stub.fetch(forwardRequest);

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

/**
 * Call webhook with payload and HMAC signature.
 */
async function callWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  secret: string
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      // Create HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(body)
      );
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      headers['x-webhook-signature'] = signatureHex;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
    });

    console.log('Webhook response status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('Webhook call failed:', error);
    return false;
  }
}
