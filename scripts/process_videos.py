#!/usr/bin/env python3
"""
Local video processing script for the video-clip-library.

This script processes pending source videos locally when Cloudflare Containers
is not available. It:
1. Fetches pending sources from Supabase
2. Downloads videos from R2
3. Transcribes with OpenAI Whisper
4. Detects scenes with PySceneDetect
5. Splits videos into clips
6. Tags clips with GPT-4o-mini
7. Uploads clips to R2
8. Saves clip data to Supabase

Usage:
    python scripts/process_videos.py [source_id]

If source_id is provided, only that source will be processed.
Otherwise, all pending sources will be processed.

Requirements:
    - FFmpeg installed and in PATH
    - OpenAI API key in environment
    - R2 and Supabase credentials in .env.local
"""

import asyncio
import os
import sys
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add the workers/cloudflare/src to Python path
script_dir = Path(__file__).parent
project_root = script_dir.parent
workers_src = project_root / "workers" / "cloudflare" / "src"
sys.path.insert(0, str(workers_src))

# Load environment variables from .env.local
from dotenv import load_dotenv

env_file = project_root / "apps" / "web" / ".env.local"
if env_file.exists():
    load_dotenv(env_file)
else:
    print(f"Warning: {env_file} not found")

# Now import the processing modules
import structlog
from supabase import create_client, Client

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer(colors=True),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)


class LocalVideoProcessor:
    """Process videos locally using the existing pipeline modules."""

    def __init__(self):
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY are required")

        self.supabase: Client = create_client(supabase_url, supabase_key)

        # R2 configuration
        self.r2_endpoint = f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com"
        self.r2_bucket = os.getenv("R2_BUCKET_NAME", "video-clips")
        self.r2_access_key = os.getenv("R2_ACCESS_KEY_ID")
        self.r2_secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

        # Check OpenAI API key
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            logger.warning("OPENAI_API_KEY not set - transcription and tagging will fail")

        # Initialize R2 client
        self._init_r2_client()

    def _init_r2_client(self):
        """Initialize the R2 client."""
        import aioboto3
        from botocore.config import Config

        self.r2_session = aioboto3.Session()
        self.r2_config = Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
            connect_timeout=30,
            read_timeout=300,
        )

    def _get_r2_client_context(self):
        """Get async context manager for R2 client."""
        return self.r2_session.client(
            "s3",
            endpoint_url=self.r2_endpoint,
            aws_access_key_id=self.r2_access_key,
            aws_secret_access_key=self.r2_secret_key,
            config=self.r2_config,
        )

    async def download_from_r2(self, key: str, local_path: str) -> str:
        """Download a file from R2."""
        logger.info("Downloading from R2", key=key, local_path=local_path)

        Path(local_path).parent.mkdir(parents=True, exist_ok=True)

        async with self._get_r2_client_context() as client:
            await client.download_file(self.r2_bucket, key, local_path)

        logger.info("Downloaded successfully", size=Path(local_path).stat().st_size)
        return local_path

    async def upload_to_r2(self, local_path: str, key: str, content_type: Optional[str] = None) -> str:
        """Upload a file to R2."""
        logger.info("Uploading to R2", key=key, local_path=local_path)

        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        else:
            suffix = Path(local_path).suffix.lower()
            content_types = {
                ".mp4": "video/mp4",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
            }
            if suffix in content_types:
                extra_args["ContentType"] = content_types[suffix]

        async with self._get_r2_client_context() as client:
            await client.upload_file(
                local_path,
                self.r2_bucket,
                key,
                ExtraArgs=extra_args if extra_args else None,
            )

        url = f"{self.r2_endpoint}/{self.r2_bucket}/{key}"
        logger.info("Uploaded successfully", key=key)
        return url

    def get_pending_sources(self) -> list[dict]:
        """Get all sources with 'pending' status."""
        result = self.supabase.table("sources").select("*").eq("status", "pending").execute()
        return result.data or []

    def get_source_by_id(self, source_id: str) -> Optional[dict]:
        """Get a specific source by ID."""
        result = self.supabase.table("sources").select("*").eq("id", source_id).single().execute()
        return result.data

    def update_source_status(self, source_id: str, status: str, error_message: Optional[str] = None):
        """Update source status."""
        data = {"status": status, "updated_at": datetime.utcnow().isoformat()}
        if error_message:
            data["error_message"] = error_message

        self.supabase.table("sources").update(data).eq("id", source_id).execute()
        logger.info("Updated source status", source_id=source_id, status=status)

    def get_tags(self) -> list[dict]:
        """Get all tags from the database."""
        result = self.supabase.table("tags").select("*").execute()
        return result.data or []

    def get_tag_by_name(self, name: str) -> Optional[dict]:
        """Get a tag by name."""
        result = self.supabase.table("tags").select("*").eq("name", name).execute()
        return result.data[0] if result.data else None

    def create_clip(self, clip_data: dict) -> dict:
        """Create a clip in the database."""
        result = self.supabase.table("clips").insert(clip_data).execute()
        return result.data[0] if result.data else {}

    def add_clip_tag(self, clip_id: str, tag_id: str, confidence_score: float):
        """Add a tag to a clip."""
        self.supabase.table("clip_tags").insert({
            "clip_id": clip_id,
            "tag_id": tag_id,
            "confidence_score": confidence_score,
            "assigned_by": "ai",
        }).execute()

    async def process_source(self, source: dict) -> bool:
        """Process a single source video."""
        source_id = source["id"]
        title = source.get("title", "Unknown")
        file_key = source.get("original_file_key")

        logger.info("Processing source", source_id=source_id, title=title)

        if not file_key:
            logger.error("Source has no file key", source_id=source_id)
            self.update_source_status(source_id, "failed", "No file key found")
            return False

        # Update status to processing
        self.update_source_status(source_id, "processing")

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Step 1: Download video
                logger.info("Step 1: Downloading video")
                video_path = str(Path(temp_dir) / "source.mp4")
                await self.download_from_r2(file_key, video_path)

                # Step 2: Transcribe
                logger.info("Step 2: Transcribing video")
                from transcribe import Transcriber
                transcriber = Transcriber(api_key=self.openai_api_key)
                transcript = await transcriber.transcribe_video(video_path)
                logger.info("Transcription complete", duration=transcript.duration, segments=len(transcript.segments))

                # Step 3: Detect scenes
                logger.info("Step 3: Detecting scenes")
                from scene_detect import SceneDetector
                scene_detector = SceneDetector(min_scene_len=1.5)
                scene_result = scene_detector.detect_scenes(video_path)
                logger.info("Scene detection complete", scenes=scene_result.total_scenes)

                # Step 4: Create clip definitions
                logger.info("Step 4: Creating clip definitions")
                from split_video import create_clip_definitions
                clip_definitions = create_clip_definitions(
                    scenes=scene_result.scenes,
                    transcript_segments=transcript.segments,
                    min_duration=3.0,
                    max_duration=20.0,
                    source_id=source_id,
                )
                logger.info("Clip definitions created", total=len(clip_definitions))

                if not clip_definitions:
                    logger.warning("No clips created - video may be too short")
                    self.update_source_status(source_id, "completed")
                    return True

                # Step 5: Split video into clips
                logger.info("Step 5: Splitting video into clips")
                from split_video import VideoSplitter
                splitter = VideoSplitter()
                output_dir = str(Path(temp_dir) / "clips")
                clip_results = await splitter.split_video(video_path, clip_definitions, output_dir)
                logger.info("Video split complete", clips=len(clip_results))

                # Step 6: Tag clips
                logger.info("Step 6: Tagging clips")
                from tagger import ClipTagger, create_clip_contexts
                tagger = ClipTagger(api_key=self.openai_api_key)
                clip_contexts = create_clip_contexts(clip_results, transcript.duration)
                tag_results = await tagger.tag_clips(clip_contexts)
                tag_map = {t.clip_id: t for t in tag_results}
                logger.info("Tagging complete")

                # Get tag mapping from database
                db_tags = self.get_tags()
                tag_name_to_id = {t["name"]: t["id"] for t in db_tags}

                # Step 7: Upload clips and save to database
                logger.info("Step 7: Uploading clips and saving to database")
                for clip in clip_results:
                    # Upload video clip
                    clip_key = f"clips/{source_id}/{clip.clip_id}.mp4"
                    await self.upload_to_r2(clip.video_path, clip_key, "video/mp4")

                    # Upload thumbnail
                    thumb_key = f"clips/{source_id}/{clip.clip_id}_thumb.jpg"
                    await self.upload_to_r2(clip.thumbnail_path, thumb_key, "image/jpeg")

                    # Create clip record
                    clip_record = self.create_clip({
                        "source_id": source_id,
                        "start_time_seconds": clip.start_time,
                        "end_time_seconds": clip.end_time,
                        "file_url": f"{self.r2_endpoint}/{self.r2_bucket}/{clip_key}",
                        "file_key": clip_key,
                        "thumbnail_url": f"{self.r2_endpoint}/{self.r2_bucket}/{thumb_key}",
                        "transcript_segment": clip.transcript,
                        "detection_method": "hybrid",
                    })

                    if clip_record:
                        # Add tags
                        tag_result = tag_map.get(clip.clip_id)
                        if tag_result:
                            for tag_score in tag_result.all_tags:
                                tag_name = tag_score.tag.value
                                if tag_name in tag_name_to_id:
                                    self.add_clip_tag(
                                        clip_record["id"],
                                        tag_name_to_id[tag_name],
                                        tag_score.confidence,
                                    )

                logger.info("All clips uploaded and saved", total=len(clip_results))

                # Update source status to completed
                self.update_source_status(source_id, "completed")

                # Update source duration if not set
                if not source.get("duration_seconds"):
                    self.supabase.table("sources").update({
                        "duration_seconds": transcript.duration
                    }).eq("id", source_id).execute()

                return True

        except Exception as e:
            logger.error("Processing failed", source_id=source_id, error=str(e))
            self.update_source_status(source_id, "failed", str(e))
            import traceback
            traceback.print_exc()
            return False

    async def process_all_pending(self) -> tuple[int, int]:
        """Process all pending sources. Returns (success_count, fail_count)."""
        sources = self.get_pending_sources()

        if not sources:
            logger.info("No pending sources to process")
            return 0, 0

        logger.info("Found pending sources", count=len(sources))

        success = 0
        failed = 0

        for source in sources:
            try:
                if await self.process_source(source):
                    success += 1
                else:
                    failed += 1
            except Exception as e:
                logger.error("Unexpected error processing source", error=str(e))
                failed += 1

        return success, failed


async def main():
    """Main entry point."""
    # Check for OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        print("\n" + "=" * 60)
        print("ERROR: OPENAI_API_KEY environment variable is required!")
        print("=" * 60)
        print("\nTo set up:")
        print("1. Get an API key from https://platform.openai.com/api-keys")
        print("2. Add to your .env.local file:")
        print("   OPENAI_API_KEY=sk-your-key-here")
        print("\nOr export it temporarily:")
        print("   export OPENAI_API_KEY=sk-your-key-here")
        print("=" * 60 + "\n")
        sys.exit(1)

    # Check for FFmpeg
    import shutil
    if not shutil.which("ffmpeg"):
        print("\n" + "=" * 60)
        print("ERROR: FFmpeg is required but not found in PATH!")
        print("=" * 60)
        print("\nTo install FFmpeg:")
        print("  macOS:   brew install ffmpeg")
        print("  Ubuntu:  sudo apt install ffmpeg")
        print("  Windows: Download from https://ffmpeg.org/download.html")
        print("=" * 60 + "\n")
        sys.exit(1)

    processor = LocalVideoProcessor()

    # Check if a specific source ID was provided
    if len(sys.argv) > 1:
        source_id = sys.argv[1]
        source = processor.get_source_by_id(source_id)

        if not source:
            logger.error("Source not found", source_id=source_id)
            sys.exit(1)

        logger.info("Processing specific source", source_id=source_id, title=source.get("title"))
        success = await processor.process_source(source)
        sys.exit(0 if success else 1)
    else:
        # Process all pending
        success, failed = await processor.process_all_pending()
        logger.info("Processing complete", success=success, failed=failed)
        sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
