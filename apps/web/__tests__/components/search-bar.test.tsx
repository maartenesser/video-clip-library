import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '@/components/search-bar';

describe('SearchBar', () => {
  it('renders with default placeholder', () => {
    render(<SearchBar />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search transcripts...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<SearchBar placeholder="Search clips..." />);

    expect(screen.getByPlaceholderText('Search clips...')).toBeInTheDocument();
  });

  it('displays search icon', () => {
    render(<SearchBar />);

    // The search icon should be present (it's inside a div)
    const input = screen.getByTestId('search-input');
    expect(input.previousElementSibling).toBeInTheDocument();
  });

  it('shows clear button when value is present', async () => {
    render(<SearchBar />);

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'test query');

    expect(screen.getByTestId('clear-search')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchBar />);

    expect(screen.queryByTestId('clear-search')).not.toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();

    render(<SearchBar onChange={onChange} onSearch={onSearch} />);

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'test query');

    await userEvent.click(screen.getByTestId('clear-search'));

    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('calls onChange when input value changes', async () => {
    const onChange = vi.fn();

    render(<SearchBar onChange={onChange} />);

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'hello');

    // Should be called for each character
    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange).toHaveBeenLastCalledWith('hello');
  });

  it('debounces onSearch callback', async () => {
    const onSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} debounceMs={100} />);

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'test');

    // Should not call immediately
    expect(onSearch).not.toHaveBeenCalled();

    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('uses controlled value when provided', () => {
    render(<SearchBar value="controlled value" onChange={() => {}} />);

    expect(screen.getByTestId('search-input')).toHaveValue('controlled value');
  });

  it('updates controlled value on change', async () => {
    const onChange = vi.fn();

    const { rerender } = render(<SearchBar value="" onChange={onChange} />);

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'a');

    expect(onChange).toHaveBeenCalledWith('a');

    // Rerender with new value
    rerender(<SearchBar value="a" onChange={onChange} />);
    expect(input).toHaveValue('a');
  });

  it('clears input on Escape key', async () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();

    render(<SearchBar onChange={onChange} onSearch={onSearch} />);

    const input = screen.getByTestId('search-input');
    await userEvent.type(input, 'test query');
    await userEvent.keyboard('{Escape}');

    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('shows loading indicator when isLoading is true', () => {
    render(<SearchBar isLoading={true} />);

    // The loading spinner should replace the search icon
    // We can check for the animate-spin class
    const container = screen.getByTestId('search-input').parentElement;
    const spinner = container?.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<SearchBar className="custom-class" />);

    const container = screen.getByTestId('search-input').parentElement;
    expect(container).toHaveClass('custom-class');
  });

  it('handles rapid typing with debounce', async () => {
    const onSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} debounceMs={200} />);

    const input = screen.getByTestId('search-input');

    // Type quickly
    await userEvent.type(input, 'quick search', { delay: 10 });

    // Wait less than debounce time
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not have called yet
    expect(onSearch).not.toHaveBeenCalled();

    // Wait for full debounce
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Should only be called once with final value
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('quick search');
  });
});
