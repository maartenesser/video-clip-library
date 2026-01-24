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
  private async waitForContainerReady(port: { fetch: (input: Request | string, init?: RequestInit) => Promise<Response> }): Promise<boolean> {
    const maxChecks = 20;  // More checks but faster intervals
    const delayMs = 1000;  // 1 second between checks (faster startup)

    for (let attempt = 1; attempt <= maxChecks; attempt++) {
      try {
        const response = await port.fetch('http://container/ready');
        if (response.ok) {
          console.log(`Container ready after ${attempt} checks (~${attempt}s)`);
          return true;
        }
        console.log(`Container readiness check ${attempt}/${maxChecks}: not ready yet (status ${response.status})`);
      } catch (error) {
        console.log(`Container readiness check ${attempt}/${maxChecks} failed:`, error instanceof Error ? error.message : error);
      }

      if (attempt < maxChecks) {
        await sleep(delayMs);
      }
    }

    console.error('Container failed to become ready after all checks');
    return false;
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

        // Give container time to initialize (Python/FastAPI startup)
        await sleep(2000);  // Reduced from 5s to 2s for faster startup
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

    const isReady = await this.waitForContainerReady(port);
    if (!isReady) {
      return new Response(JSON.stringify({
        error: 'Container failed to become ready',
        details: 'Container did not respond to readiness checks after multiple attempts'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
  audio_base64?: string;  // Audio for transcription
  error?: string;
}

// Interface for transcript segment from OpenAI Whisper
interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

// Interface for transcription result
interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  duration: number;
}

// Interface for clip embedding
interface ClipEmbedding {
  clip_id: string;
  embedding: number[];
}

// Interface for similarity pair
interface SimilarityPair {
  clip_id_1: string;
  clip_id_2: string;
  similarity: number;
}

// Similarity thresholds
const DUPLICATE_THRESHOLD = 0.95;
const MULTIPLE_TAKES_THRESHOLD = 0.85;
const SAME_TOPIC_THRESHOLD = 0.75;

// Group types
type GroupType = 'duplicate' | 'multiple_takes' | 'same_topic';

// Interface for clip group
interface ClipGroup {
  group_id: string;
  group_type: GroupType;
  clip_ids: string[];
  representative_clip_id: string;
  similarity_scores: Record<string, number>;
}

/**
 * Transcribe audio using OpenAI Whisper API.
 */
async function transcribeAudio(
  audioBase64: string,
  apiKey: string
): Promise<TranscriptResult | null> {
  try {
    console.log('Starting transcription with OpenAI Whisper');

    // Decode base64 to binary
    const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    console.log('Audio size for transcription:', audioData.byteLength);

    // Create form data
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI transcription failed:', response.status, errorText);
      return null;
    }

    const result = await response.json() as {
      text: string;
      segments?: Array<{ text: string; start: number; end: number }>;
      duration?: number;
    };

    console.log('Transcription completed, segments:', result.segments?.length || 0);

    return {
      text: result.text,
      segments: result.segments || [],
      duration: result.duration || 0,
    };
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

/**
 * Generate embeddings for clip transcripts using OpenAI API.
 * Uses text-embedding-3-small with 384 dimensions to match database schema.
 */
async function generateEmbeddings(
  clips: Array<{ clip_id: string; transcript: string | null }>,
  apiKey: string
): Promise<ClipEmbedding[]> {
  // Filter clips with transcripts
  const clipsWithTranscripts = clips.filter(c => c.transcript && c.transcript.trim().length > 0);

  if (clipsWithTranscripts.length === 0) {
    console.log('No transcripts available for embedding generation');
    return [];
  }

  console.log(`Generating embeddings for ${clipsWithTranscripts.length} clips`);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: clipsWithTranscripts.map(c => c.transcript),
        dimensions: 384,  // Match database schema (384 dimensions)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI embedding API error:', response.status, errorText);
      return [];
    }

    const result = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Map embeddings back to clip IDs
    const embeddings: ClipEmbedding[] = result.data.map(item => ({
      clip_id: clipsWithTranscripts[item.index].clip_id,
      embedding: item.embedding,
    }));

    console.log(`Generated ${embeddings.length} embeddings`);
    return embeddings;
  } catch (error) {
    console.error('Embedding generation error:', error);
    return [];
  }
}

/**
 * Compute cosine similarity between two embeddings.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Find similar clip pairs based on embeddings.
 */
function findSimilarPairs(
  embeddings: ClipEmbedding[],
  minSimilarity: number = SAME_TOPIC_THRESHOLD
): SimilarityPair[] {
  const pairs: SimilarityPair[] = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(
        embeddings[i].embedding,
        embeddings[j].embedding
      );

      if (similarity >= minSimilarity) {
        pairs.push({
          clip_id_1: embeddings[i].clip_id,
          clip_id_2: embeddings[j].clip_id,
          similarity,
        });
      }
    }
  }

  return pairs;
}

/**
 * Classify a similarity pair into a group type.
 */
function classifyPair(similarity: number): GroupType | null {
  if (similarity >= DUPLICATE_THRESHOLD) return 'duplicate';
  if (similarity >= MULTIPLE_TAKES_THRESHOLD) return 'multiple_takes';
  if (similarity >= SAME_TOPIC_THRESHOLD) return 'same_topic';
  return null;
}

/**
 * Build groups from similar pairs using union-find algorithm.
 */
function buildGroups(pairs: SimilarityPair[]): ClipGroup[] {
  // Group pairs by type
  const typePairs: Record<GroupType, SimilarityPair[]> = {
    duplicate: [],
    multiple_takes: [],
    same_topic: [],
  };

  for (const pair of pairs) {
    const groupType = classifyPair(pair.similarity);
    if (groupType) {
      typePairs[groupType].push(pair);
    }
  }

  const groups: ClipGroup[] = [];

  for (const [groupType, typedPairs] of Object.entries(typePairs) as [GroupType, SimilarityPair[]][]) {
    if (typedPairs.length === 0) continue;

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    const similarities = new Map<string, number>();

    for (const pair of typedPairs) {
      if (!adjacency.has(pair.clip_id_1)) adjacency.set(pair.clip_id_1, new Set());
      if (!adjacency.has(pair.clip_id_2)) adjacency.set(pair.clip_id_2, new Set());

      adjacency.get(pair.clip_id_1)!.add(pair.clip_id_2);
      adjacency.get(pair.clip_id_2)!.add(pair.clip_id_1);

      const key = [pair.clip_id_1, pair.clip_id_2].sort().join('|');
      similarities.set(key, pair.similarity);
    }

    // Find connected components using DFS
    const visited = new Set<string>();
    const components: string[][] = [];

    function dfs(node: string, component: string[]) {
      visited.add(node);
      component.push(node);
      for (const neighbor of adjacency.get(node) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, component);
        }
      }
    }

    for (const clipId of adjacency.keys()) {
      if (!visited.has(clipId)) {
        const component: string[] = [];
        dfs(clipId, component);
        if (component.length > 1) {
          components.push(component);
        }
      }
    }

    // Create ClipGroup objects
    for (const component of components) {
      const representative = component[0];
      const scores: Record<string, number> = {};

      for (const clipId of component) {
        if (clipId !== representative) {
          const key = [representative, clipId].sort().join('|');
          scores[clipId] = similarities.get(key) || 0;
        }
      }

      groups.push({
        group_id: crypto.randomUUID(),
        group_type: groupType,
        clip_ids: component,
        representative_clip_id: representative,
        similarity_scores: scores,
      });
    }
  }

  console.log(`Built ${groups.length} groups: ${
    groups.filter(g => g.group_type === 'duplicate').length} duplicates, ${
    groups.filter(g => g.group_type === 'multiple_takes').length} multiple takes, ${
    groups.filter(g => g.group_type === 'same_topic').length} same topic`);

  return groups;
}

/**
 * Detect duplicates and similar clips.
 */
async function detectDuplicates(
  clips: Array<{ clip_id: string; transcript: string | null }>,
  apiKey: string
): Promise<{ embeddings: ClipEmbedding[]; groups: ClipGroup[] }> {
  console.log('Starting duplicate detection');

  // Generate embeddings
  const embeddings = await generateEmbeddings(clips, apiKey);

  if (embeddings.length < 2) {
    console.log('Not enough embeddings for duplicate detection');
    return { embeddings, groups: [] };
  }

  // Find similar pairs
  const pairs = findSimilarPairs(embeddings);
  console.log(`Found ${pairs.length} similar pairs`);

  // Build groups
  const groups = buildGroups(pairs);

  return { embeddings, groups };
}

/**
 * Get transcript text for a specific time range.
 */
function getTranscriptForClip(
  segments: TranscriptSegment[],
  startTime: number,
  endTime: number
): string | null {
  // Find segments that overlap with the clip time range
  const overlappingSegments = segments.filter(seg =>
    seg.end > startTime && seg.start < endTime
  );

  if (overlappingSegments.length === 0) return null;

  return overlappingSegments
    .map(seg => seg.text.trim())
    .join(' ')
    .trim() || null;
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

        // Extract base URL from webhook URL to construct media URLs
        const webhookParsed = new URL(webhook_url);
        const appBaseUrl = `${webhookParsed.protocol}//${webhookParsed.host}`;

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
        const instanceId = 'default-v8';
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

        // Step 2.5: Transcribe audio if available
        let transcriptSegments: TranscriptSegment[] = [];
        if (containerResult.audio_base64 && env.OPENAI_API_KEY) {
          console.log('Step 2.5: Transcribing audio with OpenAI Whisper');
          const transcript = await transcribeAudio(containerResult.audio_base64, env.OPENAI_API_KEY);
          if (transcript) {
            transcriptSegments = transcript.segments;
            console.log('Transcription completed, segments:', transcriptSegments.length);
          } else {
            console.warn('Transcription failed or returned no results');
          }
        } else if (!containerResult.audio_base64) {
          console.warn('No audio data from container for transcription');
        } else if (!env.OPENAI_API_KEY) {
          console.warn('OPENAI_API_KEY not configured, skipping transcription');
        }

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
            // Construct thumbnail URL using app's media proxy
            thumbnailUrl = `${appBaseUrl}/api/media/${thumbnailKey}`;
          }

          // Get transcript for this clip's time range
          const clipTranscript = getTranscriptForClip(
            transcriptSegments,
            clip.start_time,
            clip.end_time
          );

          uploadedClips.push({
            start_time_seconds: clip.start_time,
            end_time_seconds: clip.end_time,
            // Use app's media proxy for serving videos
            file_url: `${appBaseUrl}/api/media/${videoKey}`,
            file_key: videoKey,
            thumbnail_url: thumbnailUrl,
            transcript_segment: clipTranscript,
            detection_method: transcriptSegments.length > 0 ? 'hybrid' : 'scene',
            tags: [], // Tagging not done in container
          });
        }

        console.log('Uploaded clips to R2:', uploadedClips.length);

        // Step 3.5: Generate source thumbnail from first clip's thumbnail
        let sourceThumbnailUrl = null;
        if (containerResult.clips.length > 0 && containerResult.clips[0].thumbnail_base64) {
          const sourceThumbnailKey = video_url.replace(/\.[^.]+$/, '_thumb.jpg');
          const thumbnailData = Uint8Array.from(atob(containerResult.clips[0].thumbnail_base64), c => c.charCodeAt(0));
          await env.VIDEO_BUCKET.put(sourceThumbnailKey, thumbnailData, {
            httpMetadata: { contentType: 'image/jpeg' },
          });
          sourceThumbnailUrl = `${appBaseUrl}/api/media/${sourceThumbnailKey}`;
          console.log('Uploaded source thumbnail:', sourceThumbnailKey);
        }

        // Step 3.6: Detect duplicates and similar clips
        let embeddings: ClipEmbedding[] = [];
        let groups: ClipGroup[] = [];

        if (env.OPENAI_API_KEY && uploadedClips.length >= 2) {
          console.log('Step 3.6: Detecting duplicates and similar clips');
          const clipsForEmbedding = uploadedClips.map(clip => ({
            clip_id: clip.file_key.split('/').pop()?.replace('.mp4', '') || '',
            transcript: clip.transcript_segment,
          }));

          const duplicateResult = await detectDuplicates(clipsForEmbedding, env.OPENAI_API_KEY);
          embeddings = duplicateResult.embeddings;
          groups = duplicateResult.groups;
        } else if (!env.OPENAI_API_KEY) {
          console.warn('OPENAI_API_KEY not configured, skipping duplicate detection');
        } else {
          console.log('Not enough clips for duplicate detection');
        }

        // Step 4: Call webhook with results
        console.log('Step 4: Calling webhook');
        const webhookPayload = {
          source_id,
          status: 'completed',
          clips: uploadedClips,
          duration_seconds: containerResult.total_duration,
          source_thumbnail_url: sourceThumbnailUrl,
          embeddings: embeddings.map(e => ({
            clip_id: e.clip_id,
            embedding: e.embedding,
          })),
          groups: groups.map(g => ({
            group_id: g.group_id,
            group_type: g.group_type,
            clip_ids: g.clip_ids,
            representative_clip_id: g.representative_clip_id,
            similarity_scores: g.similarity_scores,
          })),
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
      const instanceId = 'default-v8';
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

    console.log('Calling webhook:', webhookUrl);
    console.log('Secret configured:', !!secret, 'length:', secret?.length || 0);

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
      console.log('Signature added, first 10 chars:', signatureHex.substring(0, 10));
    } else {
      console.warn('No webhook secret configured - sending without signature');
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
    });

    console.log('Webhook response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Webhook error response:', errorText);
    }
    return response.ok;
  } catch (error) {
    console.error('Webhook call failed:', error);
    return false;
  }
}
