import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClipCard } from '@/components/clip-card';

describe('ClipCard', () => {
  const defaultProps = {
    id: 'clip-1',
    fileUrl: 'https://storage.example.com/clips/clip-1.mp4',
    durationSeconds: 125,
  };

  it('renders clip card with duration', () => {
    render(<ClipCard {...defaultProps} />);

    expect(screen.getByTestId('clip-card')).toBeInTheDocument();
    expect(screen.getByText('2:05')).toBeInTheDocument(); // 125 seconds = 2:05
  });

  it('renders thumbnail when provided', () => {
    render(
      <ClipCard
        {...defaultProps}
        thumbnailUrl="https://storage.example.com/thumbnails/clip-1.jpg"
      />
    );

    const thumbnail = screen.getByTestId('clip-thumbnail');
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute(
      'src',
      'https://storage.example.com/thumbnails/clip-1.jpg'
    );
  });

  it('renders tags when provided', () => {
    const tags = [
      { id: 'tag-1', name: 'Funny', color: '#ff0000' },
      { id: 'tag-2', name: 'Highlight', color: '#00ff00' },
    ];

    render(<ClipCard {...defaultProps} tags={tags} />);

    const tagsContainer = screen.getByTestId('clip-tags');
    expect(tagsContainer).toBeInTheDocument();
    expect(screen.getByText('Funny')).toBeInTheDocument();
    expect(screen.getByText('Highlight')).toBeInTheDocument();
  });

  it('shows +N badge when more than 4 tags', () => {
    const tags = [
      { id: 'tag-1', name: 'Tag1' },
      { id: 'tag-2', name: 'Tag2' },
      { id: 'tag-3', name: 'Tag3' },
      { id: 'tag-4', name: 'Tag4' },
      { id: 'tag-5', name: 'Tag5' },
      { id: 'tag-6', name: 'Tag6' },
    ];

    render(<ClipCard {...defaultProps} tags={tags} />);

    expect(screen.getByText('+2')).toBeInTheDocument();
    // Should only show first 4 tags
    expect(screen.getByText('Tag1')).toBeInTheDocument();
    expect(screen.getByText('Tag4')).toBeInTheDocument();
    expect(screen.queryByText('Tag5')).not.toBeInTheDocument();
  });

  it('renders transcript segment when provided', () => {
    render(
      <ClipCard
        {...defaultProps}
        transcriptSegment="This is a sample transcript segment for the clip."
      />
    );

    expect(
      screen.getByText('This is a sample transcript segment for the clip.')
    ).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const onClick = vi.fn();

    render(<ClipCard {...defaultProps} onClick={onClick} />);

    const card = screen.getByTestId('clip-card');
    await userEvent.click(card);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('formats short durations correctly', () => {
    render(<ClipCard {...defaultProps} durationSeconds={45} />);

    expect(screen.getByText('0:45')).toBeInTheDocument();
  });

  it('formats long durations correctly', () => {
    render(<ClipCard {...defaultProps} durationSeconds={3665} />); // 1:01:05

    expect(screen.getByText('1:01:05')).toBeInTheDocument();
  });

  it('applies tag colors when provided', () => {
    const tags = [{ id: 'tag-1', name: 'Custom', color: '#3498db' }];

    render(<ClipCard {...defaultProps} tags={tags} />);

    const tagBadge = screen.getByText('Custom');
    expect(tagBadge).toHaveStyle({ backgroundColor: '#3498db' });
  });

  it('shows video element on hover', async () => {
    render(<ClipCard {...defaultProps} />);

    const card = screen.getByTestId('clip-card');
    const video = screen.getByTestId('clip-video');

    // Video should be hidden initially
    expect(video).toHaveClass('opacity-0');

    // Hover over the card
    fireEvent.mouseEnter(card);

    // Video should become visible
    expect(video).toHaveClass('opacity-100');
  });

  it('hides video on mouse leave', async () => {
    render(<ClipCard {...defaultProps} />);

    const card = screen.getByTestId('clip-card');
    const video = screen.getByTestId('clip-video');

    // Hover
    fireEvent.mouseEnter(card);
    expect(video).toHaveClass('opacity-100');

    // Leave
    fireEvent.mouseLeave(card);
    expect(video).toHaveClass('opacity-0');
  });
});
