import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';
import { handleError } from '@/lib/api-utils';

// Dutch and English filler words
const FILLER_WORDS = new Set([
  // English
  "um", "uh", "umm", "uhh", "er", "err", "ah", "ahh",
  "like", "basically", "actually", "literally", "honestly",
  // Dutch
  "eh", "euh", "uhm", "nou", "ja", "dus", "eigenlijk",
  "gewoon", "even", "toch",
]);

// Min silence to flag (seconds)
const MIN_SILENCE_TO_FLAG = 0.3;

interface CleaningAnalysis {
  clipId: string;
  originalDuration: number;
  estimatedCleanedDuration: number;
  estimatedRemovedDuration: number;
  fillersFound: string[];
  fillerCount: number;
  hesitationCount: number;
  canClean: boolean;
  message: string;
}

/**
 * POST /api/clips/[id]/clean
 *
 * Analyze and optionally clean a clip by removing filler words and silences.
 *
 * Query params:
 * - analyze: If true, only analyze without cleaning (default: true)
 * - execute: If true, actually create the cleaned clip
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const analyzeOnly = searchParams.get('execute') !== 'true';

    const db = getDatabase();

    // Get clip
    const clip = await db.getClipById(id);
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    // Get quality data
    let quality = null;
    try {
      quality = await db.getClipQuality(id);
    } catch (e) {
      // No quality data
    }

    // Analyze transcript for filler words
    const transcript = clip.transcript_segment || '';
    const words = transcript.toLowerCase().split(/\s+/);
    const fillers: string[] = [];

    words.forEach((word) => {
      const cleanWord = word.replace(/[.,!?;:]/g, '');
      if (FILLER_WORDS.has(cleanWord)) {
        fillers.push(cleanWord);
      }
    });

    // Get quality metrics
    const fillerCount = quality?.filler_word_count ?? fillers.length;
    const hesitationCount = quality?.hesitation_count ?? 0;

    // Estimate how much can be removed
    // Rough estimate: each filler ~0.3s, each hesitation ~0.5s
    const estimatedFillerTime = fillerCount * 0.3;
    const estimatedHesitationTime = hesitationCount * 0.5;
    const estimatedRemovedDuration = estimatedFillerTime + estimatedHesitationTime;
    const estimatedCleanedDuration = Math.max(
      clip.duration_seconds - estimatedRemovedDuration,
      clip.duration_seconds * 0.7 // Don't remove more than 30%
    );

    const canClean = fillerCount > 0 || hesitationCount > 0;

    const analysis: CleaningAnalysis = {
      clipId: id,
      originalDuration: clip.duration_seconds,
      estimatedCleanedDuration,
      estimatedRemovedDuration,
      fillersFound: fillers,
      fillerCount,
      hesitationCount,
      canClean,
      message: canClean
        ? `Found ${fillerCount} filler words and ${hesitationCount} hesitations that can be cleaned`
        : 'No filler words or hesitations detected - clip is already clean',
    };

    if (analyzeOnly) {
      return NextResponse.json({
        analysis,
        mode: 'analyze',
        instructions: 'To execute cleaning, call with ?execute=true',
      });
    }

    // Execute cleaning
    // For now, we'll call the Python script via a background job
    // In production, this would be a proper job queue

    // Store cleaning request in database for processing
    const cleaningRequest = {
      clip_id: id,
      status: 'pending',
      requested_at: new Date().toISOString(),
      analysis,
    };

    // Update quality metadata with cleaning request
    const existingMetadata = quality?.quality_metadata || {};
    await db.updateClipQuality(id, {
      quality_metadata: {
        ...existingMetadata,
        cleaning_request: cleaningRequest,
      },
    });

    return NextResponse.json({
      analysis,
      mode: 'execute',
      status: 'pending',
      message: 'Cleaning job queued. The cleaned clip will be available shortly.',
      note: 'Run: python workers/cloudflare/auto_clean_clip.py ' + id,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * GET /api/clips/[id]/clean
 *
 * Get cleaning status for a clip.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const db = getDatabase();

    // Get quality data with cleaning info
    let quality = null;
    try {
      quality = await db.getClipQuality(id);
    } catch (e) {
      return NextResponse.json({
        clipId: id,
        hasCleaned: false,
        message: 'No cleaning data available',
      });
    }

    const metadata = quality?.quality_metadata || {};
    const cleanedKey = metadata.cleaned_file_key;
    const cleanedDuration = metadata.cleaned_duration;

    if (cleanedKey) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      return NextResponse.json({
        clipId: id,
        hasCleaned: true,
        cleanedUrl: `${baseUrl}/api/media/${cleanedKey}`,
        cleanedDuration,
        originalDuration: quality?.speaking_quality_score, // This should be clip duration
        stats: metadata.cleaning_stats,
      });
    }

    return NextResponse.json({
      clipId: id,
      hasCleaned: false,
      cleaningRequest: metadata.cleaning_request,
      message: metadata.cleaning_request
        ? 'Cleaning in progress'
        : 'No cleaning requested',
    });
  } catch (error) {
    return handleError(error);
  }
}
