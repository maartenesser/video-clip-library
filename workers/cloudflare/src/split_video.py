"""Video splitting module using FFmpeg."""

import asyncio
import subprocess
import uuid
from pathlib import Path
from typing import Optional

import structlog

from .models import ClipDefinition, ClipResult

logger = structlog.get_logger(__name__)


class VideoSplitError(Exception):
    """Error during video splitting."""

    pass


class VideoSplitter:
    """Splits videos into clips using FFmpeg."""

    def __init__(
        self,
        output_format: str = "mp4",
        video_codec: str = "libx264",
        audio_codec: str = "aac",
        video_bitrate: str = "2M",
        audio_bitrate: str = "128k",
        thumbnail_time_offset: float = 0.5,
    ):
        """Initialize the video splitter.

        Args:
            output_format: Output video format (mp4, webm)
            video_codec: Video codec (libx264, libvpx-vp9)
            audio_codec: Audio codec (aac, libopus)
            video_bitrate: Video bitrate (e.g., "2M")
            audio_bitrate: Audio bitrate (e.g., "128k")
            thumbnail_time_offset: Time offset in seconds for thumbnail
        """
        self.output_format = output_format
        self.video_codec = video_codec
        self.audio_codec = audio_codec
        self.video_bitrate = video_bitrate
        self.audio_bitrate = audio_bitrate
        self.thumbnail_time_offset = thumbnail_time_offset

    async def _run_ffmpeg(self, cmd: list[str], timeout: int = 120) -> None:
        """Run FFmpeg command asynchronously.

        Args:
            cmd: FFmpeg command and arguments
            timeout: Command timeout in seconds
        """
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout,
            )

            if process.returncode != 0:
                raise VideoSplitError(f"FFmpeg error: {stderr.decode()}")

        except asyncio.TimeoutError:
            process.kill()
            raise VideoSplitError("FFmpeg command timed out")

    async def extract_clip(
        self,
        video_path: str,
        start_time: float,
        end_time: float,
        output_path: str,
    ) -> str:
        """Extract a single clip from video.

        Args:
            video_path: Path to source video
            start_time: Start time in seconds
            end_time: End time in seconds
            output_path: Path for output clip

        Returns:
            Path to extracted clip
        """
        duration = end_time - start_time

        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # FFmpeg command for extracting clip
        # Using -ss before -i for faster seeking
        cmd = [
            "ffmpeg",
            "-ss",
            str(start_time),
            "-i",
            video_path,
            "-t",
            str(duration),
            "-c:v",
            self.video_codec,
            "-c:a",
            self.audio_codec,
            "-b:v",
            self.video_bitrate,
            "-b:a",
            self.audio_bitrate,
            "-preset",
            "fast",
            "-movflags",
            "+faststart",  # Enable streaming
            "-y",
            output_path,
        ]

        logger.debug(
            "Extracting clip",
            start=start_time,
            end=end_time,
            duration=duration,
            output=output_path,
        )

        await self._run_ffmpeg(cmd)
        return output_path

    async def generate_thumbnail(
        self,
        video_path: str,
        output_path: str,
        time_offset: Optional[float] = None,
        width: int = 640,
        height: int = 360,
    ) -> str:
        """Generate a thumbnail from video.

        Args:
            video_path: Path to video file
            output_path: Path for output thumbnail
            time_offset: Time in video for thumbnail (default: use configured offset)
            width: Thumbnail width
            height: Thumbnail height

        Returns:
            Path to generated thumbnail
        """
        if time_offset is None:
            time_offset = self.thumbnail_time_offset

        # Ensure output directory exists
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        # FFmpeg command for thumbnail generation
        cmd = [
            "ffmpeg",
            "-ss",
            str(time_offset),
            "-i",
            video_path,
            "-vframes",
            "1",
            "-vf",
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-y",
            output_path,
        ]

        logger.debug("Generating thumbnail", video=video_path, output=output_path)

        await self._run_ffmpeg(cmd, timeout=30)
        return output_path

    async def split_single_clip(
        self,
        video_path: str,
        clip: ClipDefinition,
        output_dir: str,
    ) -> ClipResult:
        """Extract a single clip with thumbnail.

        Args:
            video_path: Path to source video
            clip: Clip definition
            output_dir: Directory for output files

        Returns:
            ClipResult with paths to clip and thumbnail
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Output paths
        clip_filename = f"{clip.clip_id}.{self.output_format}"
        thumb_filename = f"{clip.clip_id}_thumb.jpg"
        clip_path = str(output_dir / clip_filename)
        thumb_path = str(output_dir / thumb_filename)

        # Extract clip
        await self.extract_clip(
            video_path,
            clip.start_time,
            clip.end_time,
            clip_path,
        )

        # Generate thumbnail
        # Use middle of clip or thumbnail_time_offset, whichever is smaller
        duration = clip.end_time - clip.start_time
        thumb_offset = min(self.thumbnail_time_offset, duration / 2)
        await self.generate_thumbnail(clip_path, thumb_path, time_offset=thumb_offset)

        return ClipResult(
            clip_id=clip.clip_id,
            start_time=clip.start_time,
            end_time=clip.end_time,
            duration=duration,
            video_path=clip_path,
            thumbnail_path=thumb_path,
            transcript=clip.transcript,
        )

    async def split_video(
        self,
        video_path: str,
        clips: list[ClipDefinition],
        output_dir: str,
        max_concurrent: int = 3,
    ) -> list[ClipResult]:
        """Split video into multiple clips.

        Args:
            video_path: Path to source video
            clips: List of clip definitions
            output_dir: Directory for output files
            max_concurrent: Maximum concurrent FFmpeg processes

        Returns:
            List of ClipResult objects
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        logger.info(
            "Starting video splitting",
            video=str(video_path),
            total_clips=len(clips),
            output_dir=output_dir,
        )

        # Process clips with limited concurrency
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_with_semaphore(clip: ClipDefinition) -> ClipResult:
            async with semaphore:
                return await self.split_single_clip(str(video_path), clip, output_dir)

        # Process all clips
        results = await asyncio.gather(
            *[process_with_semaphore(clip) for clip in clips],
            return_exceptions=True,
        )

        # Filter out errors and log them
        successful_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(
                    "Failed to extract clip",
                    clip_id=clips[i].clip_id,
                    error=str(result),
                )
            else:
                successful_results.append(result)

        logger.info(
            "Video splitting completed",
            successful=len(successful_results),
            failed=len(clips) - len(successful_results),
        )

        return successful_results


async def split_video(
    video_path: str,
    clips: list[ClipDefinition],
    output_dir: str,
) -> list[ClipResult]:
    """Split a video into clips.

    Args:
        video_path: Path to source video
        clips: List of clip definitions with start/end times
        output_dir: Directory for output files

    Returns:
        List of ClipResult objects with paths to clips and thumbnails
    """
    splitter = VideoSplitter()
    return await splitter.split_video(video_path, clips, output_dir)


def create_clip_definitions(
    scenes: list,
    transcript_segments: list,
    min_duration: float = 3.0,
    max_duration: float = 20.0,
    source_id: str = "",
) -> list[ClipDefinition]:
    """Create clip definitions by merging scenes with transcript segments.

    This function attempts to create clips that:
    1. Respect scene boundaries when possible
    2. Are within the min/max duration constraints
    3. Align with natural speech breaks

    Args:
        scenes: List of SceneBoundary objects
        transcript_segments: List of TranscriptSegment objects
        min_duration: Minimum clip duration in seconds
        max_duration: Maximum clip duration in seconds
        source_id: Source video ID for clip naming

    Returns:
        List of ClipDefinition objects
    """
    clips = []
    clip_index = 0

    for scene in scenes:
        scene_start = scene.start_time
        scene_end = scene.end_time
        scene_duration = scene.duration

        if scene_duration < min_duration:
            # Scene too short, might need to merge with adjacent
            continue

        if scene_duration <= max_duration:
            # Scene is within acceptable range
            transcript = _get_transcript_for_range(
                transcript_segments, scene_start, scene_end
            )
            clips.append(
                ClipDefinition(
                    clip_id=f"{source_id}_clip_{clip_index:04d}",
                    start_time=scene_start,
                    end_time=scene_end,
                    transcript=transcript,
                    scene_indices=[scenes.index(scene)],
                )
            )
            clip_index += 1
        else:
            # Scene too long, need to split at natural breaks
            sub_clips = _split_long_scene(
                scene_start,
                scene_end,
                transcript_segments,
                min_duration,
                max_duration,
                source_id,
                clip_index,
            )
            clips.extend(sub_clips)
            clip_index += len(sub_clips)

    return clips


def _get_transcript_for_range(
    segments: list,
    start_time: float,
    end_time: float,
) -> str:
    """Get transcript text for a time range."""
    texts = []
    for segment in segments:
        # Check if segment overlaps with range
        if segment.end > start_time and segment.start < end_time:
            texts.append(segment.text)
    return " ".join(texts).strip()


def _split_long_scene(
    start_time: float,
    end_time: float,
    transcript_segments: list,
    min_duration: float,
    max_duration: float,
    source_id: str,
    start_index: int,
) -> list[ClipDefinition]:
    """Split a long scene into smaller clips at natural breaks."""
    clips = []
    current_start = start_time
    clip_index = start_index

    # Find transcript segments within this scene
    relevant_segments = [
        seg
        for seg in transcript_segments
        if seg.end > start_time and seg.start < end_time
    ]

    if not relevant_segments:
        # No transcript, just split evenly
        while current_start < end_time:
            clip_end = min(current_start + max_duration, end_time)
            if clip_end - current_start >= min_duration:
                clips.append(
                    ClipDefinition(
                        clip_id=f"{source_id}_clip_{clip_index:04d}",
                        start_time=current_start,
                        end_time=clip_end,
                        transcript="",
                    )
                )
                clip_index += 1
            current_start = clip_end
        return clips

    # Try to split at sentence/segment boundaries
    accumulated_text = []
    segment_idx = 0

    while current_start < end_time and segment_idx < len(relevant_segments):
        target_end = current_start + max_duration

        # Find best break point
        best_break = current_start + min_duration
        accumulated_text = []

        for seg in relevant_segments[segment_idx:]:
            if seg.start >= target_end:
                break

            if seg.start >= current_start:
                accumulated_text.append(seg.text)
                # Check if this is a good break point (end of sentence)
                if seg.end >= current_start + min_duration:
                    if seg.text.rstrip().endswith((".", "!", "?")):
                        best_break = seg.end
                        if seg.end >= current_start + (max_duration * 0.7):
                            # Good enough break point
                            break
                    else:
                        best_break = seg.end

                segment_idx += 1

        clip_end = min(best_break, end_time)
        if clip_end - current_start >= min_duration:
            clips.append(
                ClipDefinition(
                    clip_id=f"{source_id}_clip_{clip_index:04d}",
                    start_time=current_start,
                    end_time=clip_end,
                    transcript=" ".join(accumulated_text).strip(),
                )
            )
            clip_index += 1

        current_start = clip_end

    return clips
