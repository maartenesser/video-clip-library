#!/usr/bin/env python3
"""Generate thumbnail for source video and upload to R2."""

import os
import sys
import tempfile
import subprocess
import boto3
from botocore.config import Config
from supabase import create_client

# Load environment
from dotenv import load_dotenv
load_dotenv()

# R2 config
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "video-clips")

# Supabase config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_s3_client():
    """Create S3 client for R2."""
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )

def generate_thumbnail(video_path: str, output_path: str, timestamp: str = "00:00:05"):
    """Generate thumbnail from video at given timestamp."""
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", timestamp,
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        "-vf", "scale=640:-1",
        output_path
    ]
    subprocess.run(cmd, capture_output=True, check=True)

def main():
    source_id = sys.argv[1] if len(sys.argv) > 1 else None

    # Initialize clients
    s3 = get_s3_client()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get source(s) - we'll generate thumbnails for all that don't have one in R2
    query = supabase.table("sources").select("*")
    if source_id:
        query = query.eq("id", source_id)

    result = query.execute()
    sources = result.data

    if not sources:
        print("No sources found")
        return

    print(f"Found {len(sources)} sources without thumbnails")

    for source in sources:
        print(f"\nProcessing: {source['title']}")

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                # Download source video
                video_path = os.path.join(tmpdir, "source.mp4")
                thumb_path = os.path.join(tmpdir, "thumbnail.jpg")

                print(f"  Downloading from: {source['original_file_key']}")
                s3.download_file(R2_BUCKET_NAME, source['original_file_key'], video_path)

                # Generate thumbnail at 5 seconds
                print("  Generating thumbnail...")
                generate_thumbnail(video_path, thumb_path, "00:00:05")

                # Upload thumbnail to R2
                # Use same path structure as source but with _thumb.jpg
                base_key = source['original_file_key'].rsplit('.', 1)[0]
                thumb_key = f"{base_key}_thumb.jpg"

                print(f"  Uploading to: {thumb_key}")
                s3.upload_file(
                    thumb_path,
                    R2_BUCKET_NAME,
                    thumb_key,
                    ExtraArgs={"ContentType": "image/jpeg"}
                )

                print(f"  Done! Thumbnail uploaded to: {thumb_key}")

        except Exception as e:
            print(f"  Error: {e}")
            continue

    print("\nAll done!")

if __name__ == "__main__":
    main()
