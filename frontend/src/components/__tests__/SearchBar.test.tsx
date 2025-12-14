import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('debounces input', async () => {
    const mockSearch = vi.fn();
    render(<SearchBar onSearch={mockSearch} />);

    const input = screen.getByPlaceholderText('Search matters...');
    fireEvent.change(input, { target: { value: 'hello' } });

    expect(mockSearch).not.toBeCalled();
    vi.advanceTimersByTime(500);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toBeCalledWith('hello');
  });

  it('correctly calls onSearch with collated value of multiple keystrokes', () => {
    const mockSearch = vi.fn();
    render(<SearchBar onSearch={mockSearch} />);

    const input = screen.getByPlaceholderText('Search matters...');
    fireEvent.change(input, { target: { value: 'a' } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: 'ab' } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: 'abc' } });
    // quick check to ensure debounce is correctly resetting the timer
    vi.advanceTimersByTime(499);
    expect(mockSearch).not.toBeCalled();
    vi.advanceTimersByTime(1);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('abc');
  });

  it('Clears debounce and search value when clear button is pressed', () => {
    const mockSearch = vi.fn();
    render(<SearchBar onSearch={mockSearch} />);

    const clearBtn = screen.getByText('Clear');
    const input = screen.getByPlaceholderText('Search matters...');
    fireEvent.change(input, { target: { value: 'hello' } });
    vi.advanceTimersByTime(300);
    fireEvent.click(clearBtn);
    expect(mockSearch).toHaveBeenCalled();
    expect(mockSearch).toHaveBeenCalledWith('');
    vi.advanceTimersByTime(400);
    expect(mockSearch).toHaveBeenCalledExactlyOnceWith('');
  });
});
