"""Scene detection module using PySceneDetect."""

import subprocess
from pathlib import Path
from typing import Optional

import structlog
from scenedetect import AdaptiveDetector, ContentDetector, SceneManager, open_video
from scenedetect.stats_manager import StatsManager

from .models import SceneBoundary, SceneDetectionResult

logger = structlog.get_logger(__name__)


class SceneDetectionError(Exception):
    """Error during scene detection."""

    pass


class SceneDetector:
    """Detects scene boundaries in videos using PySceneDetect."""

    def __init__(
        self,
        min_scene_len: float = 1.5,
        threshold: float = 27.0,
        use_adaptive: bool = True,
    ):
        """Initialize the scene detector.

        Args:
            min_scene_len: Minimum scene length in seconds
            threshold: Detection threshold (lower = more sensitive)
            use_adaptive: Use AdaptiveDetector (better for talking-head videos)
        """
        self.min_scene_len = min_scene_len
        self.threshold = threshold
        self.use_adaptive = use_adaptive

    def get_video_info(self, video_path: str) -> dict:
        """Get video metadata using FFprobe.

        Args:
            video_path: Path to video file

        Returns:
            Dictionary with duration, fps, width, height
        """
        cmd = [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            video_path,
        ]

        try:
            import json

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode != 0:
                raise SceneDetectionError(f"FFprobe error: {result.stderr}")

            data = json.loads(result.stdout)

            # Find video stream
            video_stream = None
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_stream = stream
                    break

            if not video_stream:
                raise SceneDetectionError("No video stream found")

            # Parse frame rate
            fps_str = video_stream.get("r_frame_rate", "30/1")
            if "/" in fps_str:
                num, den = map(float, fps_str.split("/"))
                fps = num / den if den else 30.0
            else:
                fps = float(fps_str)

            return {
                "duration": float(data.get("format", {}).get("duration", 0)),
                "fps": fps,
                "width": int(video_stream.get("width", 0)),
                "height": int(video_stream.get("height", 0)),
                "codec": video_stream.get("codec_name", "unknown"),
            }

        except subprocess.TimeoutExpired:
            raise SceneDetectionError("FFprobe timed out")
        except json.JSONDecodeError as e:
            raise SceneDetectionError(f"Failed to parse FFprobe output: {e}")

    def detect_scenes(self, video_path: str) -> SceneDetectionResult:
        """Detect scene boundaries in a video.

        Args:
            video_path: Path to video file

        Returns:
            SceneDetectionResult with scene boundaries
        """
        video_path = Path(video_path)
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        logger.info(
            "Starting scene detection",
            video=str(video_path),
            min_scene_len=self.min_scene_len,
            use_adaptive=self.use_adaptive,
        )

        # Get video info
        video_info = self.get_video_info(str(video_path))
        fps = video_info["fps"]
        duration = video_info["duration"]

        logger.info(
            "Video info",
            duration=duration,
            fps=fps,
            resolution=f"{video_info['width']}x{video_info['height']}",
        )

        # Open video with PySceneDetect
        video = open_video(str(video_path))

        # Create scene manager with stats
        stats_manager = StatsManager()
        scene_manager = SceneManager(stats_manager)

        # Choose detector based on configuration
        min_scene_frames = int(self.min_scene_len * fps)

        if self.use_adaptive:
            # AdaptiveDetector is better for talking-head videos
            # It adapts to gradual lighting changes
            detector = AdaptiveDetector(
                adaptive_threshold=self.threshold / 10,  # Adaptive uses different scale
                min_scene_len=min_scene_frames,
            )
        else:
            # ContentDetector for general purpose
            detector = ContentDetector(
                threshold=self.threshold,
                min_scene_len=min_scene_frames,
            )

        scene_manager.add_detector(detector)

        # Detect scenes
        scene_manager.detect_scenes(video)
        scene_list = scene_manager.get_scene_list()

        # Convert to our model
        scenes = []
        for i, (start, end) in enumerate(scene_list):
            start_time = start.get_seconds()
            end_time = end.get_seconds()

            scenes.append(
                SceneBoundary(
                    start_time=start_time,
                    end_time=end_time,
                    start_frame=start.get_frames(),
                    end_frame=end.get_frames(),
                    duration=end_time - start_time,
                )
            )

        # If no scenes detected, treat entire video as one scene
        if not scenes:
            logger.info("No scene cuts detected, treating video as single scene")
            scenes = [
                SceneBoundary(
                    start_time=0.0,
                    end_time=duration,
                    start_frame=0,
                    end_frame=int(duration * fps),
                    duration=duration,
                )
            ]

        result = SceneDetectionResult(
            total_scenes=len(scenes),
            video_duration=duration,
            fps=fps,
            scenes=scenes,
        )

        logger.info(
            "Scene detection completed",
            total_scenes=result.total_scenes,
            avg_scene_duration=duration / len(scenes) if scenes else 0,
        )

        return result


def detect_scenes(
    video_path: str,
    min_scene_len: float = 1.5,
    threshold: Optional[float] = None,
    use_adaptive: bool = True,
) -> list[SceneBoundary]:
    """Detect scene boundaries in a video.

    Args:
        video_path: Path to video file
        min_scene_len: Minimum scene length in seconds
        threshold: Detection threshold (auto-set based on detector type)
        use_adaptive: Use AdaptiveDetector for talking-head videos

    Returns:
        List of SceneBoundary objects
    """
    if threshold is None:
        threshold = 3.0 if use_adaptive else 27.0

    detector = SceneDetector(
        min_scene_len=min_scene_len,
        threshold=threshold,
        use_adaptive=use_adaptive,
    )

    result = detector.detect_scenes(video_path)
    return result.scenes
