import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagSelector } from '@/components/tag-selector';

const mockTags = [
  { id: 'tag-1', name: 'Funny', color: '#ff0000', category: 'Mood' },
  { id: 'tag-2', name: 'Sad', color: '#0000ff', category: 'Mood' },
  { id: 'tag-3', name: 'Highlight', color: '#00ff00', category: 'Type' },
  { id: 'tag-4', name: 'Tutorial', color: '#ffff00', category: 'Type' },
];

describe('TagSelector', () => {
  it('renders trigger button with placeholder', () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={[]}
        onSelectionChange={() => {}}
      />
    );

    expect(screen.getByTestId('tag-selector-trigger')).toBeInTheDocument();
    expect(screen.getByText('Select tags...')).toBeInTheDocument();
  });

  it('shows custom placeholder', () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={[]}
        onSelectionChange={() => {}}
        placeholder="Filter by tags"
      />
    );

    expect(screen.getByText('Filter by tags')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={[]}
        onSelectionChange={() => {}}
      />
    );

    await userEvent.click(screen.getByTestId('tag-selector-trigger'));

    const tagList = screen.getByTestId('tag-list');
    expect(tagList).toBeInTheDocument();
  });

  it('displays tags grouped by category', async () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={[]}
        onSelectionChange={() => {}}
      />
    );

    await userEvent.click(screen.getByTestId('tag-selector-trigger'));

    // Should show category headers
    expect(screen.getByText('Mood')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();

    // Should show all tags
    expect(screen.getByText('Funny')).toBeInTheDocument();
    expect(screen.getByText('Sad')).toBeInTheDocument();
    expect(screen.getByText('Highlight')).toBeInTheDocument();
    expect(screen.getByText('Tutorial')).toBeInTheDocument();
  });

  it('calls onSelectionChange when a tag is selected', async () => {
    const onSelectionChange = vi.fn();

    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    await userEvent.click(screen.getByTestId('tag-selector-trigger'));
    await userEvent.click(screen.getByTestId('tag-option-tag-1'));

    expect(onSelectionChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('calls onSelectionChange when a tag is deselected', async () => {
    const onSelectionChange = vi.fn();

    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1']}
        onSelectionChange={onSelectionChange}
      />
    );

    await userEvent.click(screen.getByTestId('tag-selector-trigger'));
    await userEvent.click(screen.getByTestId('tag-option-tag-1'));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('displays selected tags as badges', () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1', 'tag-3']}
        onSelectionChange={() => {}}
      />
    );

    expect(screen.getByTestId('selected-tag-tag-1')).toBeInTheDocument();
    expect(screen.getByTestId('selected-tag-tag-3')).toBeInTheDocument();
  });

  it('shows clear all button when tags are selected', () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1']}
        onSelectionChange={() => {}}
      />
    );

    expect(screen.getByTestId('clear-all-tags')).toBeInTheDocument();
  });

  it('hides clear all button when no tags selected', () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={[]}
        onSelectionChange={() => {}}
      />
    );

    expect(screen.queryByTestId('clear-all-tags')).not.toBeInTheDocument();
  });

  it('clears all tags when clear all button is clicked', async () => {
    const onSelectionChange = vi.fn();

    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1', 'tag-2']}
        onSelectionChange={onSelectionChange}
      />
    );

    await userEvent.click(screen.getByTestId('clear-all-tags'));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('removes individual tag when X is clicked on badge', async () => {
    const onSelectionChange = vi.fn();

    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1', 'tag-2']}
        onSelectionChange={onSelectionChange}
      />
    );

    const tag1Badge = screen.getByTestId('selected-tag-tag-1');
    const removeButton = within(tag1Badge).getByRole('button');
    await userEvent.click(removeButton);

    expect(onSelectionChange).toHaveBeenCalledWith(['tag-2']);
  });

  it('applies tag colors to badges', async () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1']}
        onSelectionChange={() => {}}
      />
    );

    const badge = screen.getByTestId('selected-tag-tag-1');
    expect(badge).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('shows empty message when no tags available', async () => {
    render(
      <TagSelector
        tags={[]}
        selectedTagIds={[]}
        onSelectionChange={() => {}}
      />
    );

    await userEvent.click(screen.getByTestId('tag-selector-trigger'));

    expect(screen.getByText('No tags available')).toBeInTheDocument();
  });

  it('shows checkboxes for selected state', async () => {
    render(
      <TagSelector
        tags={mockTags}
        selectedTagIds={['tag-1']}
        onSelectionChange={() => {}}
      />
    );

    await userEvent.click(screen.getByTestId('tag-selector-trigger'));

    // The checkbox for tag-1 should be checked
    const tag1Option = screen.getByTestId('tag-option-tag-1');
    const checkbox = within(tag1Option).getByRole('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'checked');

    // The checkbox for tag-2 should not be checked
    const tag2Option = screen.getByTestId('tag-option-tag-2');
    const checkbox2 = within(tag2Option).getByRole('checkbox');
    expect(checkbox2).toHaveAttribute('data-state', 'unchecked');
  });
});
