import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createChatSchema } from '@/lib/schemas';
import { handleError, ApiError } from '@/lib/api-utils';
import { getDatabase } from '@/lib/database';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat model to use
const CHAT_MODEL = 'gpt-4o'; // or 'gpt-5.1' when available

// System prompt for the video clip curator
const SYSTEM_PROMPT = `You are a video clip curator assistant. You help users find and assemble video clips from their library.

When a user describes what they want (e.g., "I need clips about product benefits for a YouTube Short"), you should:
1. Search their clip library semantically to find relevant clips
2. Suggest which clips to use and in what order
3. Consider flow, messaging, and total duration for the target format
4. Explain your reasoning briefly

You have access to the user's clip library through semantic search. When suggesting clips, reference them by their transcript content so users can identify them.

Keep responses concise and actionable. Focus on helping users quickly assemble effective videos.`;

// Helper to convert clips to use proxy URLs
function addProxyUrls(clips: any[]) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return clips.map((clip) => {
    let proxyFileUrl = clip.file_url;
    let proxyThumbnailUrl = clip.thumbnail_url;

    if (clip.file_key) {
      proxyFileUrl = `${baseUrl}/api/media/${clip.file_key}`;
      const thumbnailKey = clip.file_key.replace('.mp4', '_thumb.jpg');
      proxyThumbnailUrl = `${baseUrl}/api/media/${thumbnailKey}`;
    }

    return {
      ...clip,
      file_url: proxyFileUrl,
      thumbnail_url: proxyThumbnailUrl,
    };
  });
}

/**
 * Search for relevant clips based on the user's message
 */
async function searchRelevantClips(query: string, limit: number = 10) {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
      dimensions: 384,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const db = getDatabase();

    return await db.searchClipsBySimilarity(
      queryEmbedding,
      0.4, // Lower threshold to get more results
      limit
    );
  } catch (error) {
    console.error('Error searching clips:', error);
    return [];
  }
}

/**
 * POST /api/chat
 *
 * Chat with AI assistant to find and curate video clips.
 * Creates or continues a conversation, searches for relevant clips,
 * and provides suggestions using GPT-4.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createChatSchema.parse(body);

    const db = getDatabase();

    // Get or create conversation
    let conversationId = validated.conversation_id;
    let previousMessages: { role: 'user' | 'assistant'; content: string }[] = [];

    if (conversationId) {
      // Get existing conversation and messages
      const conversation = await db.getChatConversationById(conversationId);
      if (!conversation) {
        throw new ApiError(404, 'Conversation not found');
      }

      const messages = await db.getChatMessages(conversationId);
      previousMessages = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    } else {
      // Create new conversation
      const title = validated.message.slice(0, 100);
      const conversation = await db.createChatConversation({ title });
      conversationId = conversation.id;
    }

    // Search for relevant clips based on user message
    const relevantClips = await searchRelevantClips(validated.message, 15);
    const clipsWithUrls = addProxyUrls(relevantClips);

    // Build context about available clips
    let clipsContext = '';
    if (relevantClips.length > 0) {
      clipsContext = '\n\nHere are relevant clips from the user\'s library:\n\n';
      relevantClips.forEach((clip, index) => {
        const duration = clip.duration_seconds?.toFixed(1) || '?';
        const transcript = clip.transcript_segment?.slice(0, 200) || 'No transcript';
        clipsContext += `Clip ${index + 1} (${duration}s): "${transcript}"\n`;
      });
    } else {
      clipsContext = '\n\nNo clips found matching the query. The user may need to upload more videos or try a different search.';
    }

    // Save user message
    await db.createChatMessage({
      conversation_id: conversationId,
      role: 'user',
      content: validated.message,
      clip_ids: [],
    });

    // Build messages for OpenAI
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT + clipsContext },
      ...previousMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: validated.message },
    ];

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    // Extract clip IDs that were suggested (clips mentioned in the response)
    const suggestedClipIds: string[] = [];
    relevantClips.forEach((clip, index) => {
      if (assistantMessage.includes(`Clip ${index + 1}`) ||
          (clip.transcript_segment && assistantMessage.toLowerCase().includes(clip.transcript_segment.slice(0, 30).toLowerCase()))) {
        suggestedClipIds.push(clip.id);
      }
    });

    // Save assistant message
    const savedMessage = await db.createChatMessage({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantMessage,
      clip_ids: suggestedClipIds,
    });

    return NextResponse.json({
      conversation_id: conversationId,
      message: {
        id: savedMessage.id,
        role: 'assistant',
        content: assistantMessage,
        clip_ids: suggestedClipIds,
        created_at: savedMessage.created_at,
      },
      suggested_clips: clipsWithUrls.filter((c) => suggestedClipIds.includes(c.id)),
      all_relevant_clips: clipsWithUrls,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/chat
 *
 * List all chat conversations.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const result = await db.getChatConversations();

    return NextResponse.json({
      data: result.data,
      count: result.count,
    });
  } catch (error) {
    return handleError(error);
  }
}
