"""Video assembly module for concatenating clips and adding subtitles.

Assembles multiple clips into a single video with optional subtitle burn-in.
"""

import asyncio
import os
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import structlog

from .r2_client import R2Client, get_r2_client

logger = structlog.get_logger(__name__)

# Default subtitle style
DEFAULT_SUBTITLE_STYLE = {
    "font": "Arial",
    "size": 24,
    "position": "bottom",
    "color": "#FFFFFF",
}


@dataclass
class ClipInput:
    """Input clip for assembly."""
    clip_id: str
    file_key: str
    transcript: str
    start_time: float
    end_time: float
    duration: float


@dataclass
class SubtitleStyle:
    """Subtitle styling options."""
    font: str = "Arial"
    size: int = 24
    position: str = "bottom"  # bottom, top, middle
    color: str = "#FFFFFF"
    outline_color: str = "#000000"
    outline_width: int = 2


@dataclass
class AssemblyResult:
    """Result of video assembly."""
    assembly_id: str
    file_key: str
    file_url: str
    duration: float
    clip_count: int


class VideoAssembler:
    """Assembles multiple video clips into a single video."""

    def __init__(
        self,
        r2_client: Optional[R2Client] = None,
        output_bucket: str = "video-clips",
    ):
        """Initialize the video assembler.

        Args:
            r2_client: R2 client for storage operations
            output_bucket: Bucket for output videos
        """
        self.r2_client = r2_client or get_r2_client()
        self.output_bucket = output_bucket

    async def download_clip(
        self,
        file_key: str,
        temp_dir: str,
        index: int,
    ) -> str:
        """Download a clip from R2 to local storage.

        Args:
            file_key: R2 key of the clip
            temp_dir: Temporary directory for download
            index: Index for unique naming

        Returns:
            Local path to downloaded clip
        """
        local_path = str(Path(temp_dir) / f"clip_{index:04d}.mp4")
        await self.r2_client.download_file(file_key, local_path)
        return local_path

    def generate_srt(
        self,
        clips: list[ClipInput],
        output_path: str,
    ) -> str:
        """Generate SRT subtitle file from clip transcripts.

        Args:
            clips: List of clips with transcripts
            output_path: Path to save SRT file

        Returns:
            Path to generated SRT file
        """
        srt_path = output_path
        current_time = 0.0

        with open(srt_path, "w", encoding="utf-8") as f:
            subtitle_index = 1

            for clip in clips:
                if not clip.transcript.strip():
                    current_time += clip.duration
                    continue

                # Split transcript into segments (roughly 10 words each)
                words = clip.transcript.split()
                words_per_segment = 10
                segments = []

                for i in range(0, len(words), words_per_segment):
                    segment_words = words[i:i + words_per_segment]
                    segments.append(" ".join(segment_words))

                if not segments:
                    current_time += clip.duration
                    continue

                # Calculate time per segment
                segment_duration = clip.duration / len(segments)

                for segment in segments:
                    start = current_time
                    end = current_time + segment_duration

                    # Format timestamps as HH:MM:SS,mmm
                    start_str = self._format_srt_time(start)
                    end_str = self._format_srt_time(end)

                    f.write(f"{subtitle_index}\n")
                    f.write(f"{start_str} --> {end_str}\n")
                    f.write(f"{segment}\n")
                    f.write("\n")

                    subtitle_index += 1
                    current_time = end

                # Adjust for any timing discrepancy
                current_time = sum(c.duration for c in clips[:clips.index(clip) + 1])

        logger.info("Generated SRT file", path=srt_path, subtitles=subtitle_index - 1)
        return srt_path

    def _format_srt_time(self, seconds: float) -> str:
        """Format seconds as SRT timestamp.

        Args:
            seconds: Time in seconds

        Returns:
            Formatted timestamp (HH:MM:SS,mmm)
        """
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    async def concat_clips(
        self,
        clip_paths: list[str],
        output_path: str,
    ) -> str:
        """Concatenate clips using FFmpeg concat demuxer.

        Args:
            clip_paths: List of local clip paths
            output_path: Path for output video

        Returns:
            Path to concatenated video
        """
        logger.info("Concatenating clips", count=len(clip_paths))

        # Create concat list file
        list_path = output_path.replace(".mp4", "_list.txt")
        with open(list_path, "w") as f:
            for path in clip_paths:
                # Escape single quotes in path
                escaped_path = path.replace("'", "'\\''")
                f.write(f"file '{escaped_path}'\n")

        # Concat using FFmpeg
        cmd = [
            "ffmpeg",
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_path,
            "-c", "copy",
            output_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            logger.error(
                "FFmpeg concat failed",
                stderr=stderr.decode("utf-8", errors="ignore")[:500],
            )
            raise RuntimeError("Failed to concatenate clips")

        # Clean up list file
        os.remove(list_path)

        logger.info("Clips concatenated", output=output_path)
        return output_path

    def _get_subtitle_filter(self, style: SubtitleStyle, srt_path: str) -> str:
        """Build FFmpeg subtitle filter string.

        Args:
            style: Subtitle styling options
            srt_path: Path to SRT file

        Returns:
            FFmpeg filter string
        """
        # Convert position to ASS alignment
        alignment_map = {
            "bottom": 2,   # Bottom center
            "top": 8,      # Top center
            "middle": 5,   # Middle center
        }
        alignment = alignment_map.get(style.position, 2)

        # Convert hex color to ASS format (BGR)
        color = style.color.lstrip("#")
        if len(color) == 6:
            r, g, b = color[:2], color[2:4], color[4:6]
            ass_color = f"&H00{b}{g}{r}&"
        else:
            ass_color = "&H00FFFFFF&"

        outline_color = style.outline_color.lstrip("#")
        if len(outline_color) == 6:
            r, g, b = outline_color[:2], outline_color[2:4], outline_color[4:6]
            ass_outline = f"&H00{b}{g}{r}&"
        else:
            ass_outline = "&H00000000&"

        # Build force_style string
        force_style = (
            f"FontName={style.font},"
            f"FontSize={style.size},"
            f"PrimaryColour={ass_color},"
            f"OutlineColour={ass_outline},"
            f"Outline={style.outline_width},"
            f"Alignment={alignment}"
        )

        # Escape special characters in path
        escaped_path = srt_path.replace(":", "\\:").replace("'", "\\'")

        return f"subtitles='{escaped_path}':force_style='{force_style}'"

    async def burn_subtitles(
        self,
        input_path: str,
        srt_path: str,
        output_path: str,
        style: SubtitleStyle,
    ) -> str:
        """Burn subtitles into video using FFmpeg.

        Args:
            input_path: Path to input video
            srt_path: Path to SRT file
            output_path: Path for output video
            style: Subtitle styling options

        Returns:
            Path to video with burned subtitles
        """
        logger.info("Burning subtitles", input=input_path, srt=srt_path)

        subtitle_filter = self._get_subtitle_filter(style, srt_path)

        cmd = [
            "ffmpeg",
            "-y",
            "-i", input_path,
            "-vf", subtitle_filter,
            "-c:a", "copy",
            output_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        _, stderr = await process.communicate()

        if process.returncode != 0:
            logger.error(
                "FFmpeg subtitle burn failed",
                stderr=stderr.decode("utf-8", errors="ignore")[:500],
            )
            raise RuntimeError("Failed to burn subtitles")

        logger.info("Subtitles burned", output=output_path)
        return output_path

    async def get_video_duration(self, video_path: str) -> float:
        """Get duration of a video file.

        Args:
            video_path: Path to video file

        Returns:
            Duration in seconds
        """
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout, _ = await process.communicate()

        try:
            return float(stdout.decode().strip())
        except ValueError:
            return 0.0

    async def assemble(
        self,
        clips: list[ClipInput],
        title: str,
        include_subtitles: bool = True,
        subtitle_style: Optional[SubtitleStyle] = None,
    ) -> AssemblyResult:
        """Assemble clips into a single video.

        Args:
            clips: List of clips to assemble
            title: Title for the assembled video
            include_subtitles: Whether to burn in subtitles
            subtitle_style: Subtitle styling options

        Returns:
            Assembly result with file URL
        """
        assembly_id = str(uuid.uuid4())
        logger.info(
            "Starting video assembly",
            assembly_id=assembly_id,
            clip_count=len(clips),
            include_subtitles=include_subtitles,
        )

        if not clips:
            raise ValueError("No clips provided for assembly")

        with tempfile.TemporaryDirectory() as temp_dir:
            # Step 1: Download all clips
            logger.info("Downloading clips", count=len(clips))
            download_tasks = [
                self.download_clip(clip.file_key, temp_dir, i)
                for i, clip in enumerate(clips)
            ]
            clip_paths = await asyncio.gather(*download_tasks)

            # Step 2: Concatenate clips
            concat_path = str(Path(temp_dir) / "concat.mp4")
            await self.concat_clips(clip_paths, concat_path)

            final_path = concat_path

            # Step 3: Add subtitles if requested
            if include_subtitles:
                style = subtitle_style or SubtitleStyle()
                srt_path = str(Path(temp_dir) / "subtitles.srt")
                self.generate_srt(clips, srt_path)

                subtitled_path = str(Path(temp_dir) / "final.mp4")
                final_path = await self.burn_subtitles(
                    concat_path, srt_path, subtitled_path, style
                )

            # Step 4: Get final duration
            duration = await self.get_video_duration(final_path)

            # Step 5: Upload to R2
            file_key = f"assembled/{assembly_id}.mp4"
            file_url = await self.r2_client.upload_file(
                final_path,
                file_key,
                bucket=self.output_bucket,
            )

            logger.info(
                "Assembly complete",
                assembly_id=assembly_id,
                duration=duration,
                file_key=file_key,
            )

            return AssemblyResult(
                assembly_id=assembly_id,
                file_key=file_key,
                file_url=file_url,
                duration=duration,
                clip_count=len(clips),
            )


async def assemble_video(
    clips: list[ClipInput],
    title: str,
    include_subtitles: bool = True,
    subtitle_style: Optional[dict] = None,
) -> AssemblyResult:
    """Convenience function to assemble a video.

    Args:
        clips: List of clips to assemble
        title: Title for the assembled video
        include_subtitles: Whether to burn in subtitles
        subtitle_style: Optional subtitle style dict

    Returns:
        Assembly result
    """
    assembler = VideoAssembler()

    style = None
    if subtitle_style:
        style = SubtitleStyle(
            font=subtitle_style.get("font", "Arial"),
            size=subtitle_style.get("size", 24),
            position=subtitle_style.get("position", "bottom"),
            color=subtitle_style.get("color", "#FFFFFF"),
        )

    return await assembler.assemble(
        clips=clips,
        title=title,
        include_subtitles=include_subtitles,
        subtitle_style=style,
    )
