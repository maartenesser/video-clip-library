#!/usr/bin/env python3
"""
Local video processing runner.

This script processes pending videos locally using the same pipeline
that would run on Cloudflare Containers.

Usage:
    python run_local.py                    # Process all pending videos
    python run_local.py --source-id UUID   # Process a specific video
    python run_local.py --list             # List pending videos
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import httpx
from supabase import create_client

# Configuration from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "video-clips")


def get_supabase_client():
    """Create Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def list_pending_videos():
    """List all pending videos in the database."""
    client = get_supabase_client()

    response = client.table("sources").select("*").eq("status", "pending").execute()

    if not response.data:
        print("No pending videos found.")
        return []

    print(f"\nFound {len(response.data)} pending video(s):\n")
    for source in response.data:
        print(f"  ID: {source['id']}")
        print(f"  Title: {source['title']}")
        print(f"  File: {source['original_file_key']}")
        print(f"  Created: {source['created_at']}")
        print()

    return response.data


async def process_video_local(source_id: str, source_data: dict = None):
    """Process a single video locally."""
    from src.pipeline import VideoPipeline
    from src.models import ProcessingStatus

    client = get_supabase_client()

    # Get source data if not provided
    if not source_data:
        response = client.table("sources").select("*").eq("id", source_id).single().execute()
        source_data = response.data

    if not source_data:
        print(f"Error: Source {source_id} not found")
        return False

    print(f"\n{'='*60}")
    print(f"Processing: {source_data['title']}")
    print(f"Source ID: {source_id}")
    print(f"File: {source_data['original_file_key']}")
    print(f"{'='*60}\n")

    # Update status to processing
    client.table("sources").update({"status": "processing"}).eq("id", source_id).execute()

    try:
        # Initialize pipeline
        pipeline = VideoPipeline(output_bucket=R2_BUCKET_NAME)

        # Process video - we'll handle the webhook callback manually
        # Instead of using webhook, we'll directly update the database

        import tempfile
        import time
        from src.scene_detect import SceneDetector
        from src.split_video import VideoSplitter, create_clip_definitions
        from src.tagger import ClipTagger, create_clip_contexts
        from src.transcribe import Transcriber

        start_time = time.time()

        with tempfile.TemporaryDirectory() as temp_dir:
            # Step 1: Download video
            print("Step 1/7: Downloading video from R2...")
            # Use the file key directly instead of URL to avoid path parsing issues
            video_key = source_data['original_file_key']
            video_path = await pipeline.download_video(video_key, temp_dir)
            print(f"  Downloaded to: {video_path}")

            # Step 2: Transcribe
            print("\nStep 2/7: Transcribing video with Whisper...")
            transcriber = Transcriber()
            transcript = await transcriber.transcribe_video(video_path)
            print(f"  Duration: {transcript.duration:.1f}s")
            print(f"  Segments: {len(transcript.segments)}")

            # Step 3: Detect scenes
            print("\nStep 3/7: Detecting scenes...")
            scene_detector = SceneDetector(min_scene_len=1.5)
            scene_result = scene_detector.detect_scenes(video_path)
            print(f"  Scenes found: {len(scene_result.scenes)}")

            # Step 4: Create clip definitions
            print("\nStep 4/7: Creating clip definitions...")
            clip_definitions = create_clip_definitions(
                scenes=scene_result.scenes,
                transcript_segments=transcript.segments,
                min_duration=3.0,
                max_duration=20.0,
                source_id=source_id,
            )
            print(f"  Clips to create: {len(clip_definitions)}")

            if not clip_definitions:
                raise Exception("No valid clips could be created from video")

            # Step 5: Split video
            print("\nStep 5/7: Splitting video into clips...")
            video_splitter = VideoSplitter()
            output_dir = str(Path(temp_dir) / "clips")
            clip_results = await video_splitter.split_video(
                video_path,
                clip_definitions,
                output_dir,
            )
            print(f"  Clips created: {len(clip_results)}")

            # Step 6: Tag clips
            print("\nStep 6/7: Tagging clips with AI...")
            tagger = ClipTagger()
            clip_contexts = create_clip_contexts(clip_results, transcript.duration)
            tag_results = await tagger.tag_clips(clip_contexts)
            tag_map = {t.clip_id: t for t in tag_results}
            print(f"  Clips tagged: {len(tag_results)}")

            # Step 7: Upload clips
            print("\nStep 7/7: Uploading clips to R2...")
            upload_urls = await pipeline.upload_clips(clip_results, source_id)
            print(f"  Clips uploaded: {len(upload_urls)}")

            processing_time = time.time() - start_time
            print(f"\nProcessing completed in {processing_time:.1f}s")

            # Get all tags for mapping
            tags_response = client.table("tags").select("*").execute()
            tag_lookup = {t['name'].lower(): t['id'] for t in tags_response.data}

            # Insert clips into database
            print("\nSaving clips to database...")
            for i, clip in enumerate(clip_results):
                tag_result = tag_map.get(clip.clip_id)
                video_url, thumbnail_url = upload_urls[i] if i < len(upload_urls) else ("", "")

                # Create clip record
                clip_data = {
                    "source_id": source_id,
                    "start_time_seconds": clip.start_time,
                    "end_time_seconds": clip.end_time,
                    "file_url": video_url,
                    "file_key": f"clips/{source_id}/{clip.clip_id}.mp4",
                    "thumbnail_url": thumbnail_url,
                    "transcript_segment": clip.transcript,
                    "detection_method": "hybrid",
                }

                clip_response = client.table("clips").insert(clip_data).execute()
                clip_id = clip_response.data[0]['id']

                # Add tags
                if tag_result:
                    for tag_score in tag_result.all_tags:
                        tag_id = tag_lookup.get(tag_score.tag.value.lower())
                        if tag_id:
                            client.table("clip_tags").insert({
                                "clip_id": clip_id,
                                "tag_id": tag_id,
                                "confidence_score": tag_score.confidence,
                                "assigned_by": "ai",
                            }).execute()

            # Update source status
            client.table("sources").update({
                "status": "completed",
                "duration_seconds": transcript.duration,
            }).eq("id", source_id).execute()

            # Update processing job
            jobs_response = client.table("processing_jobs").select("*").eq("source_id", source_id).execute()
            for job in jobs_response.data:
                client.table("processing_jobs").update({
                    "status": "completed",
                    "progress_percent": 100,
                }).eq("id", job['id']).execute()

            print(f"\n{'='*60}")
            print(f"SUCCESS! Created {len(clip_results)} clips")
            print(f"{'='*60}\n")

            return True

    except Exception as e:
        print(f"\nERROR: {str(e)}")

        # Update source status to failed
        client.table("sources").update({
            "status": "failed",
            "error_message": str(e),
        }).eq("id", source_id).execute()

        # Update processing job
        jobs_response = client.table("processing_jobs").select("*").eq("source_id", source_id).execute()
        for job in jobs_response.data:
            client.table("processing_jobs").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", job['id']).execute()

        return False


async def process_all_pending():
    """Process all pending videos."""
    client = get_supabase_client()

    response = client.table("sources").select("*").eq("status", "pending").execute()

    if not response.data:
        print("No pending videos to process.")
        return

    print(f"Found {len(response.data)} pending video(s) to process.\n")

    success_count = 0
    for source in response.data:
        result = await process_video_local(source['id'], source)
        if result:
            success_count += 1

    print(f"\nCompleted: {success_count}/{len(response.data)} videos processed successfully.")


def main():
    parser = argparse.ArgumentParser(description="Local video processing runner")
    parser.add_argument("--source-id", "-s", help="Process a specific source by ID")
    parser.add_argument("--list", "-l", action="store_true", help="List pending videos")

    args = parser.parse_args()

    # Check environment
    missing = []
    if not os.getenv("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY")
    if not os.getenv("SUPABASE_URL"):
        missing.append("SUPABASE_URL")
    if not os.getenv("SUPABASE_SERVICE_KEY"):
        missing.append("SUPABASE_SERVICE_KEY")
    if not os.getenv("R2_ACCESS_KEY_ID"):
        missing.append("R2_ACCESS_KEY_ID")

    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        print("Make sure to copy .env.example to .env and fill in the values.")
        sys.exit(1)

    if args.list:
        list_pending_videos()
    elif args.source_id:
        asyncio.run(process_video_local(args.source_id))
    else:
        asyncio.run(process_all_pending())


if __name__ == "__main__":
    main()
