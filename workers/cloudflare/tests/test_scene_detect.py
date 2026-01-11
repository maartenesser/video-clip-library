"""Tests for scene detection module."""

import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.models import SceneBoundary, SceneDetectionResult
from src.scene_detect import SceneDetectionError, SceneDetector, detect_scenes


class TestSceneDetector:
    """Tests for SceneDetector class."""

    def test_init_default_values(self):
        """Test default initialization."""
        detector = SceneDetector()

        assert detector.min_scene_len == 1.5
        assert detector.threshold == 27.0
        assert detector.use_adaptive is True

    def test_init_custom_values(self):
        """Test initialization with custom values."""
        detector = SceneDetector(
            min_scene_len=2.0,
            threshold=30.0,
            use_adaptive=False,
        )

        assert detector.min_scene_len == 2.0
        assert detector.threshold == 30.0
        assert detector.use_adaptive is False

    def test_get_video_info(self, sample_video_path):
        """Test getting video metadata."""
        detector = SceneDetector()

        info = detector.get_video_info(sample_video_path)

        assert "duration" in info
        assert "fps" in info
        assert "width" in info
        assert "height" in info
        assert info["duration"] > 0
        assert info["fps"] > 0

    def test_get_video_info_missing_file(self):
        """Test video info with missing file."""
        detector = SceneDetector()

        with pytest.raises(SceneDetectionError):
            detector.get_video_info("/nonexistent/video.mp4")

    def test_detect_scenes_basic(self, sample_video_path):
        """Test basic scene detection."""
        detector = SceneDetector(min_scene_len=0.5)

        result = detector.detect_scenes(sample_video_path)

        assert isinstance(result, SceneDetectionResult)
        assert result.total_scenes > 0
        assert result.video_duration > 0
        assert result.fps > 0
        assert len(result.scenes) > 0

    def test_detect_scenes_returns_boundaries(self, sample_video_path):
        """Test that scene detection returns proper boundaries."""
        detector = SceneDetector(min_scene_len=0.5)

        result = detector.detect_scenes(sample_video_path)

        for scene in result.scenes:
            assert isinstance(scene, SceneBoundary)
            assert scene.start_time >= 0
            assert scene.end_time > scene.start_time
            assert scene.duration > 0
            assert scene.start_frame >= 0
            assert scene.end_frame > scene.start_frame

    def test_detect_scenes_missing_file(self):
        """Test scene detection with missing file."""
        detector = SceneDetector()

        with pytest.raises(FileNotFoundError):
            detector.detect_scenes("/nonexistent/video.mp4")

    def test_detect_scenes_single_scene(self, sample_video_path):
        """Test that a video without cuts returns at least one scene."""
        # Use very high threshold to avoid detecting cuts
        detector = SceneDetector(
            min_scene_len=0.5,
            threshold=100.0,  # Very high threshold
            use_adaptive=False,
        )

        result = detector.detect_scenes(sample_video_path)

        # Should have at least one scene (the whole video)
        assert result.total_scenes >= 1
        assert len(result.scenes) >= 1

    def test_detect_scenes_adaptive_vs_content(self, sample_video_path):
        """Test that both detector types work."""
        # Adaptive detector
        adaptive_detector = SceneDetector(use_adaptive=True, threshold=3.0)
        adaptive_result = adaptive_detector.detect_scenes(sample_video_path)

        # Content detector
        content_detector = SceneDetector(use_adaptive=False, threshold=27.0)
        content_result = content_detector.detect_scenes(sample_video_path)

        # Both should return valid results
        assert adaptive_result.total_scenes >= 1
        assert content_result.total_scenes >= 1


class TestSceneBoundary:
    """Tests for SceneBoundary model."""

    def test_scene_boundary_creation(self):
        """Test creating a SceneBoundary."""
        boundary = SceneBoundary(
            start_time=0.0,
            end_time=5.0,
            start_frame=0,
            end_frame=150,
            duration=5.0,
        )

        assert boundary.start_time == 0.0
        assert boundary.end_time == 5.0
        assert boundary.duration == 5.0
        assert boundary.start_frame == 0
        assert boundary.end_frame == 150


class TestSceneDetectionResult:
    """Tests for SceneDetectionResult model."""

    def test_scene_detection_result_creation(self, sample_scene_boundaries):
        """Test creating a SceneDetectionResult."""
        result = SceneDetectionResult(
            total_scenes=3,
            video_duration=10.0,
            fps=30.0,
            scenes=sample_scene_boundaries,
        )

        assert result.total_scenes == 3
        assert result.video_duration == 10.0
        assert result.fps == 30.0
        assert len(result.scenes) == 3


class TestConvenienceFunction:
    """Tests for the detect_scenes convenience function."""

    def test_detect_scenes_function(self, sample_video_path):
        """Test the convenience function."""
        scenes = detect_scenes(sample_video_path, min_scene_len=0.5)

        assert isinstance(scenes, list)
        assert len(scenes) >= 1
        assert all(isinstance(s, SceneBoundary) for s in scenes)

    def test_detect_scenes_function_with_options(self, sample_video_path):
        """Test convenience function with custom options."""
        scenes = detect_scenes(
            sample_video_path,
            min_scene_len=1.0,
            threshold=30.0,
            use_adaptive=False,
        )

        assert isinstance(scenes, list)
        assert len(scenes) >= 1
