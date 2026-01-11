import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClipGrid } from '@/components/clip-grid';

const mockClips = [
  {
    id: 'clip-1',
    thumbnailUrl: 'https://storage.example.com/thumb1.jpg',
    fileUrl: 'https://storage.example.com/clip1.mp4',
    durationSeconds: 60,
    transcriptSegment: 'First clip transcript',
    startTimeSeconds: 0,
    endTimeSeconds: 60,
    tags: [{ id: 'tag-1', name: 'Funny', color: '#ff0000' }],
  },
  {
    id: 'clip-2',
    thumbnailUrl: 'https://storage.example.com/thumb2.jpg',
    fileUrl: 'https://storage.example.com/clip2.mp4',
    durationSeconds: 90,
    transcriptSegment: 'Second clip transcript',
    startTimeSeconds: 60,
    endTimeSeconds: 150,
    tags: [{ id: 'tag-2', name: 'Highlight', color: '#00ff00' }],
  },
];

const mockTags = [
  { id: 'tag-1', name: 'Funny', color: '#ff0000', category: 'Mood' },
  { id: 'tag-2', name: 'Highlight', color: '#00ff00', category: 'Type' },
  { id: 'tag-3', name: 'Tutorial', color: '#0000ff', category: 'Type' },
];

describe('ClipGrid', () => {
  it('renders clips grid', () => {
    render(<ClipGrid clips={mockClips} tags={mockTags} />);

    const grid = screen.getByTestId('clip-grid');
    expect(grid).toBeInTheDocument();

    // Should render all clips
    const cards = screen.getAllByTestId('clip-card');
    expect(cards).toHaveLength(2);
  });

  it('renders filter controls', () => {
    render(<ClipGrid clips={mockClips} tags={mockTags} />);

    const filters = screen.getByTestId('clip-grid-filters');
    expect(filters).toBeInTheDocument();

    // Should have search input
    expect(screen.getByTestId('search-input')).toBeInTheDocument();

    // Should have tag selector
    expect(screen.getByTestId('tag-selector-trigger')).toBeInTheDocument();

    // Should have sort select
    expect(screen.getByTestId('sort-select')).toBeInTheDocument();
  });

  it('shows empty state when no clips', () => {
    render(<ClipGrid clips={[]} tags={mockTags} />);

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByText(/no clips found/i)).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    render(<ClipGrid clips={[]} tags={mockTags} isLoading={true} />);

    // Should show skeleton elements
    const grid = screen.getByTestId('clip-grid');
    const skeletons = within(grid).getAllByRole('generic');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows load more button when hasMore is true', () => {
    render(
      <ClipGrid clips={mockClips} tags={mockTags} hasMore={true} />
    );

    expect(screen.getByTestId('load-more')).toBeInTheDocument();
  });

  it('hides load more button when hasMore is false', () => {
    render(
      <ClipGrid clips={mockClips} tags={mockTags} hasMore={false} />
    );

    expect(screen.queryByTestId('load-more')).not.toBeInTheDocument();
  });

  it('calls onLoadMore when load more button is clicked', async () => {
    const onLoadMore = vi.fn();

    render(
      <ClipGrid
        clips={mockClips}
        tags={mockTags}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    await userEvent.click(screen.getByTestId('load-more'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('calls onFilterChange when search query changes', async () => {
    const onFilterChange = vi.fn();

    render(
      <ClipGrid
        clips={mockClips}
        tags={mockTags}
        onFilterChange={onFilterChange}
      />
    );

    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'test query');

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(onFilterChange).toHaveBeenCalled();
    const lastCall = onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0];
    expect(lastCall.search).toBe('test query');
  });

  // Skip: Radix UI Select doesn't work well in jsdom due to scrollIntoView and portal issues
  it.skip('calls onFilterChange when sort option changes', async () => {
    const onFilterChange = vi.fn();

    render(
      <ClipGrid
        clips={mockClips}
        tags={mockTags}
        onFilterChange={onFilterChange}
      />
    );

    // Open sort dropdown
    await userEvent.click(screen.getByTestId('sort-select'));

    // Select a different option
    await userEvent.click(screen.getByText('Longest first'));

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'duration-desc',
      })
    );
  });

  it('renders clips with their tags', () => {
    render(<ClipGrid clips={mockClips} tags={mockTags} />);

    expect(screen.getByText('Funny')).toBeInTheDocument();
    expect(screen.getByText('Highlight')).toBeInTheDocument();
  });

  it('renders transcript segments in clips', () => {
    render(<ClipGrid clips={mockClips} tags={mockTags} />);

    expect(screen.getByText('First clip transcript')).toBeInTheDocument();
    expect(screen.getByText('Second clip transcript')).toBeInTheDocument();
  });

  it('opens clip detail dialog when clip is clicked', async () => {
    render(<ClipGrid clips={mockClips} tags={mockTags} />);

    const cards = screen.getAllByTestId('clip-card');
    await userEvent.click(cards[0]);

    // Dialog should open with clip details
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Clip Details')).toBeInTheDocument();
  });
});
