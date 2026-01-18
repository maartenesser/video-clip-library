#!/usr/bin/env python3
"""Auto-clean clips by removing filler words, hesitations, and silences."""

import asyncio
import os
import sys
import json
import tempfile
import subprocess
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client
import httpx

# Supabase config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# R2 config
R2_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.getenv("R2_BUCKET_NAME", "video-clips")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")

# Filler words to detect in transcript
FILLER_WORDS = {
    # English
    "um", "uh", "umm", "uhh", "er", "err", "ah", "ahh",
    "like", "basically", "actually", "literally", "honestly",
    # Dutch
    "eh", "euh", "uhm", "nou", "ja", "dus", "eigenlijk",
    "zeg maar", "weet je", "gewoon", "even", "toch",
}

# Minimum gap to consider as a pause to remove (seconds)
MIN_PAUSE_TO_REMOVE = 0.4

# Minimum silence duration to remove (seconds)
MIN_SILENCE_TO_REMOVE = 0.3


@dataclass
class TimeSegment:
    """A segment of time to keep or remove."""
    start: float
    end: float
    keep: bool
    reason: str = ""


def parse_transcript_for_fillers(transcript: str, words_data: list) -> list[dict]:
    """
    Parse transcript to find filler words and their timestamps.

    Args:
        transcript: The transcript text
        words_data: Word-level data with timestamps (if available)

    Returns:
        List of filler word detections with timestamps
    """
    fillers = []

    if not words_data:
        return fillers

    for word_info in words_data:
        word = word_info.get("word", "").lower().strip(".,!?;:")
        if word in FILLER_WORDS:
            fillers.append({
                "word": word,
                "start": word_info.get("start", 0),
                "end": word_info.get("end", 0),
            })

    return fillers


async def detect_silences_ffmpeg(video_path: str, threshold_db: float = -40, min_duration: float = 0.3) -> list[dict]:
    """
    Detect silence regions in video using FFmpeg.

    Args:
        video_path: Path to video file
        threshold_db: Audio level in dB below which is silence
        min_duration: Minimum silence duration to detect

    Returns:
        List of silence regions with start/end times
    """
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-af", f"silencedetect=noise={threshold_db}dB:d={min_duration}",
        "-f", "null",
        "-"
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    _, stderr = await process.communicate()

    stderr_text = stderr.decode("utf-8", errors="ignore")

    silences = []
    silence_start = None

    import re
    for line in stderr_text.split("\n"):
        if "silence_start:" in line:
            match = re.search(r"silence_start:\s*([\d.]+)", line)
            if match:
                silence_start = float(match.group(1))
        elif "silence_end:" in line and silence_start is not None:
            match = re.search(r"silence_end:\s*([\d.]+)", line)
            if match:
                silence_end = float(match.group(1))
                silences.append({
                    "start": silence_start,
                    "end": silence_end,
                    "duration": silence_end - silence_start,
                })
                silence_start = None

    return silences


def build_segments_to_keep(
    duration: float,
    fillers: list[dict],
    silences: list[dict],
    trim_start: float = 0,
    trim_end: float = 0,
) -> list[TimeSegment]:
    """
    Build list of segments to keep (excluding fillers and silences).

    Args:
        duration: Total clip duration
        fillers: Detected filler words
        silences: Detected silence regions
        trim_start: Seconds to trim from start
        trim_end: Seconds to trim from end

    Returns:
        List of TimeSegment objects to keep
    """
    # Collect all regions to remove
    remove_regions = []

    # Add filler words
    for filler in fillers:
        remove_regions.append({
            "start": filler["start"],
            "end": filler["end"],
            "reason": f"filler: {filler['word']}",
        })

    # Add silences that are long enough
    for silence in silences:
        if silence["duration"] >= MIN_SILENCE_TO_REMOVE:
            # Keep a tiny bit of silence for natural feel
            buffer = 0.05
            remove_regions.append({
                "start": silence["start"] + buffer,
                "end": silence["end"] - buffer,
                "reason": "silence",
            })

    # Sort by start time
    remove_regions.sort(key=lambda x: x["start"])

    # Merge overlapping regions
    merged = []
    for region in remove_regions:
        if not merged:
            merged.append(region)
        elif region["start"] <= merged[-1]["end"]:
            # Overlapping, extend the previous region
            merged[-1]["end"] = max(merged[-1]["end"], region["end"])
            merged[-1]["reason"] += f" + {region['reason']}"
        else:
            merged.append(region)

    # Build keep segments
    segments = []
    effective_start = trim_start
    effective_end = duration - trim_end

    current_time = effective_start

    for region in merged:
        # Skip regions outside the effective range
        if region["end"] <= effective_start or region["start"] >= effective_end:
            continue

        # Clamp region to effective range
        region_start = max(region["start"], effective_start)
        region_end = min(region["end"], effective_end)

        # Add keep segment before this remove region
        if current_time < region_start:
            segments.append(TimeSegment(
                start=current_time,
                end=region_start,
                keep=True,
            ))

        current_time = region_end

    # Add final segment
    if current_time < effective_end:
        segments.append(TimeSegment(
            start=current_time,
            end=effective_end,
            keep=True,
        ))

    return segments


async def create_cleaned_clip(
    input_path: str,
    output_path: str,
    segments: list[TimeSegment],
) -> bool:
    """
    Create a cleaned clip using FFmpeg filter_complex.

    Args:
        input_path: Path to input video
        output_path: Path for output video
        segments: List of segments to keep

    Returns:
        True if successful
    """
    if not segments:
        print("No segments to keep!")
        return False

    # Build FFmpeg filter_complex
    # We'll use the trim and concat filters
    filter_parts = []
    concat_inputs = []

    for i, seg in enumerate(segments):
        if seg.keep:
            # Trim video
            filter_parts.append(
                f"[0:v]trim=start={seg.start}:end={seg.end},setpts=PTS-STARTPTS[v{i}]"
            )
            # Trim audio
            filter_parts.append(
                f"[0:a]atrim=start={seg.start}:end={seg.end},asetpts=PTS-STARTPTS[a{i}]"
            )
            concat_inputs.append(f"[v{i}][a{i}]")

    if not concat_inputs:
        print("No segments to concatenate!")
        return False

    # Build concat filter
    n = len(concat_inputs)
    filter_complex = ";".join(filter_parts)
    filter_complex += f";{''.join(concat_inputs)}concat=n={n}:v=1:a=1[outv][outa]"

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        output_path,
    ]

    print(f"Running FFmpeg with {n} segments...")

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    _, stderr = await process.communicate()

    if process.returncode != 0:
        print(f"FFmpeg error: {stderr.decode()}")
        return False

    return True


async def download_clip(url: str, output_path: str) -> bool:
    """Download clip from URL."""
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=True)
        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            return True
    return False


async def upload_to_r2(local_path: str, key: str) -> Optional[str]:
    """Upload file to R2 bucket."""
    try:
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )

        with open(local_path, "rb") as f:
            s3.upload_fileobj(f, R2_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"})

        return f"{R2_PUBLIC_URL}/{key}" if R2_PUBLIC_URL else key
    except Exception as e:
        print(f"Upload error: {e}")
        return None


async def clean_clip(clip_id: str, dry_run: bool = False) -> dict:
    """
    Auto-clean a clip by removing filler words, silences, and hesitations.

    Args:
        clip_id: The clip ID to clean
        dry_run: If True, only analyze without creating cleaned clip

    Returns:
        Result dict with stats and new file URL
    """
    print(f"Processing clip: {clip_id}")

    # Connect to Supabase
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get clip info
    result = supabase.table("clips").select("*").eq("id", clip_id).single().execute()
    clip = result.data

    if not clip:
        return {"error": "Clip not found"}

    print(f"  Duration: {clip['duration_seconds']}s")
    print(f"  Transcript: {clip.get('transcript_segment', '')[:100]}...")

    # Get quality data for trim suggestions
    quality_result = supabase.table("clip_quality").select("*").eq("clip_id", clip_id).execute()
    quality = quality_result.data[0] if quality_result.data else None

    trim_start = quality.get("trimmed_start_seconds", 0) if quality else 0
    trim_end = quality.get("trimmed_end_seconds", 0) if quality else 0

    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = os.path.join(temp_dir, "input.mp4")
        output_path = os.path.join(temp_dir, "cleaned.mp4")

        # Download the clip
        file_url = clip["file_url"]
        print(f"  Downloading from: {file_url}")

        if not await download_clip(file_url, input_path):
            return {"error": "Failed to download clip"}

        # Detect silences
        print("  Detecting silences...")
        silences = await detect_silences_ffmpeg(input_path)
        print(f"    Found {len(silences)} silence regions")

        # Get word-level timestamps from quality metadata if available
        words_data = []
        if quality and quality.get("quality_metadata"):
            metadata = quality["quality_metadata"]
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
            words_data = metadata.get("word_timestamps", [])

        # Find filler words in transcript
        fillers = []
        transcript = clip.get("transcript_segment", "")
        if transcript:
            # Simple word-based filler detection
            words = transcript.lower().split()
            for i, word in enumerate(words):
                clean_word = word.strip(".,!?;:")
                if clean_word in FILLER_WORDS:
                    fillers.append({
                        "word": clean_word,
                        "index": i,
                        # Estimate timestamps based on position
                        "start": (i / len(words)) * clip["duration_seconds"],
                        "end": ((i + 1) / len(words)) * clip["duration_seconds"],
                    })

        print(f"    Found {len(fillers)} filler words")

        # Build segments to keep
        segments = build_segments_to_keep(
            duration=clip["duration_seconds"],
            fillers=fillers,
            silences=silences,
            trim_start=trim_start,
            trim_end=trim_end,
        )

        total_keep = sum(s.end - s.start for s in segments if s.keep)
        total_removed = clip["duration_seconds"] - total_keep

        print(f"  Analysis:")
        print(f"    Original duration: {clip['duration_seconds']:.2f}s")
        print(f"    Cleaned duration: {total_keep:.2f}s")
        print(f"    Removed: {total_removed:.2f}s ({total_removed/clip['duration_seconds']*100:.1f}%)")

        if dry_run:
            return {
                "clip_id": clip_id,
                "original_duration": clip["duration_seconds"],
                "cleaned_duration": total_keep,
                "removed_duration": total_removed,
                "silences_found": len(silences),
                "fillers_found": len(fillers),
                "segments": len(segments),
                "dry_run": True,
            }

        # Create cleaned clip
        print("  Creating cleaned clip...")
        success = await create_cleaned_clip(input_path, output_path, segments)

        if not success:
            return {"error": "Failed to create cleaned clip"}

        # Upload to R2
        cleaned_key = clip["file_key"].replace(".mp4", "_cleaned.mp4")
        print(f"  Uploading to: {cleaned_key}")

        cleaned_url = await upload_to_r2(output_path, cleaned_key)

        if not cleaned_url:
            return {"error": "Failed to upload cleaned clip"}

        # Update database with cleaned version info
        supabase.table("clip_quality").upsert({
            "clip_id": clip_id,
            "quality_metadata": {
                **(quality.get("quality_metadata", {}) if quality else {}),
                "cleaned_file_key": cleaned_key,
                "cleaned_duration": total_keep,
                "removed_duration": total_removed,
                "cleaning_stats": {
                    "silences_removed": len(silences),
                    "fillers_removed": len(fillers),
                }
            }
        }).execute()

        print(f"  Done! Cleaned clip: {cleaned_url}")

        return {
            "clip_id": clip_id,
            "original_duration": clip["duration_seconds"],
            "cleaned_duration": total_keep,
            "removed_duration": total_removed,
            "cleaned_url": cleaned_url,
            "cleaned_key": cleaned_key,
        }


async def main():
    if len(sys.argv) < 2:
        print("Usage: python auto_clean_clip.py <clip_id> [--dry-run]")
        print("       python auto_clean_clip.py --all [--dry-run]  # Clean all clips")
        sys.exit(1)

    clip_id = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    if clip_id == "--all":
        # Clean all clips
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = supabase.table("clips").select("id").execute()

        for clip in result.data:
            try:
                result = await clean_clip(clip["id"], dry_run=dry_run)
                print(f"Result: {result}\n")
            except Exception as e:
                print(f"Error processing {clip['id']}: {e}\n")
    else:
        result = await clean_clip(clip_id, dry_run=dry_run)
        print(f"\nResult: {json.dumps(result, indent=2)}")


if __name__ == "__main__":
    asyncio.run(main())
