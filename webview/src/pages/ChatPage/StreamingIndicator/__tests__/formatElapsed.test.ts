import { describe, it, expect } from 'vitest';
import { formatElapsed } from '../index';

describe('formatElapsed', () => {
  it('renders sub-minute durations in seconds', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(5_000)).toBe('5s');
    expect(formatElapsed(59_999)).toBe('59s');
  });

  it('switches to minutes + seconds at the 60s boundary', () => {
    expect(formatElapsed(60_000)).toBe('1m 0s');
    expect(formatElapsed(65_000)).toBe('1m 5s');
  });

  it('formats multi-minute durations', () => {
    expect(formatElapsed(125_000)).toBe('2m 5s');
    expect(formatElapsed(600_000)).toBe('10m 0s');
  });

  it('floors partial seconds rather than rounding', () => {
    expect(formatElapsed(1_900)).toBe('1s');
    expect(formatElapsed(61_900)).toBe('1m 1s');
  });
});
