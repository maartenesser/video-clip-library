import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoUploader } from '@/components/video-uploader';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('VideoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropzone with instructions', () => {
    render(<VideoUploader />);

    expect(screen.getByText(/drag and drop a video file/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse your files/i)).toBeInTheDocument();
    expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
  });

  it('shows file input element', () => {
    render(<VideoUploader />);

    const fileInput = screen.getByTestId('file-input');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
  });

  it('calls fetch with correct params when file is selected', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          uploadUrl: 'https://storage.example.com/upload',
          fileKey: 'videos/test-video.mp4',
          fileUrl: 'https://storage.example.com/videos/test-video.mp4',
        }),
    });

    render(<VideoUploader />);

    const file = new File(['video content'], 'test-video.mp4', {
      type: 'video/mp4',
    });

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sources/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'test-video.mp4',
          contentType: 'video/mp4',
        }),
      });
    });
  });

  it('shows file name after selection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          uploadUrl: 'https://storage.example.com/upload',
          fileKey: 'videos/test-video.mp4',
          fileUrl: 'https://storage.example.com/videos/test-video.mp4',
        }),
    });

    render(<VideoUploader />);

    const file = new File(['video content'], 'test-video.mp4', {
      type: 'video/mp4',
    });

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });
  });

  it('shows error when presigned URL fetch fails', async () => {
    const onError = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Upload failed' }),
    });

    render(<VideoUploader onError={onError} />);

    const file = new File(['video content'], 'test-video.mp4', {
      type: 'video/mp4',
    });

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument();
    });

    expect(onError).toHaveBeenCalledWith('Upload failed');
  });

  it('rejects invalid file types', async () => {
    render(<VideoUploader />);

    const file = new File(['text content'], 'document.txt', {
      type: 'text/plain',
    });

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    // The file should be rejected and not trigger upload
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows clearing selected file', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          uploadUrl: 'https://storage.example.com/upload',
          fileKey: 'videos/test-video.mp4',
          fileUrl: 'https://storage.example.com/videos/test-video.mp4',
        }),
    });

    render(<VideoUploader />);

    const file = new File(['video content'], 'test-video.mp4', {
      type: 'video/mp4',
    });

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument();
    });

    // Find and click the remove button
    const removeButton = screen.getByRole('button', { name: /remove file/i });
    await userEvent.click(removeButton);

    // Should show dropzone again
    await waitFor(() => {
      expect(screen.getByText(/drag and drop a video file/i)).toBeInTheDocument();
    });
  });

  it('formats file size correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          uploadUrl: 'https://storage.example.com/upload',
          fileKey: 'videos/test.mp4',
          fileUrl: 'https://storage.example.com/videos/test.mp4',
        }),
    });

    render(<VideoUploader />);

    // Create a file with specific size (1024 bytes = 1 KB)
    const content = new Array(1024).fill('a').join('');
    const file = new File([content], 'test.mp4', {
      type: 'video/mp4',
    });

    const fileInput = screen.getByTestId('file-input');
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText('1 KB')).toBeInTheDocument();
    });
  });
});
