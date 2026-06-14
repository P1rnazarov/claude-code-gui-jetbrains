import { describe, it, expect } from 'vitest';
import {
  clampAutoScrollThreshold,
  nextAutoFollow,
  AUTO_SCROLL_THRESHOLD_DEFAULT,
  AUTO_SCROLL_THRESHOLD_MAX,
  AUTO_SCROLL_THRESHOLD_MIN,
  AUTO_SCROLL_RELEASE_EPS,
} from '../autoScroll';

describe('clampAutoScrollThreshold', () => {
  it('keeps in-range values unchanged', () => {
    expect(clampAutoScrollThreshold(80)).toBe(80);
    expect(clampAutoScrollThreshold(200)).toBe(200);
  });

  it('caps absurdly large values (issue #87: user set 20000)', () => {
    expect(clampAutoScrollThreshold(20000)).toBe(AUTO_SCROLL_THRESHOLD_MAX);
  });

  it('floors values below the minimum', () => {
    expect(clampAutoScrollThreshold(0)).toBe(AUTO_SCROLL_THRESHOLD_MIN);
    expect(clampAutoScrollThreshold(-5)).toBe(AUTO_SCROLL_THRESHOLD_MIN);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampAutoScrollThreshold(NaN)).toBe(AUTO_SCROLL_THRESHOLD_DEFAULT);
    expect(clampAutoScrollThreshold(Infinity)).toBe(AUTO_SCROLL_THRESHOLD_DEFAULT);
  });

  it('rounds fractional values', () => {
    expect(clampAutoScrollThreshold(80.6)).toBe(81);
  });
});

describe('nextAutoFollow', () => {
  const RESUME = 80;

  // release: the user scrolled up (scrollTop decreased past the EPS).
  it('releases (false) when the user scrolls up beyond the release EPS', () => {
    // far from bottom so resume cannot fire
    expect(nextAutoFollow(true, -(AUTO_SCROLL_RELEASE_EPS + 1), 500, RESUME)).toBe(false);
  });

  it('ignores tiny upward jitter within the release EPS', () => {
    // jitter smaller than EPS, still far from bottom -> keep previous state
    expect(nextAutoFollow(true, -(AUTO_SCROLL_RELEASE_EPS - 0.5), 500, RESUME)).toBe(true);
    expect(nextAutoFollow(false, -(AUTO_SCROLL_RELEASE_EPS - 0.5), 500, RESUME)).toBe(false);
  });

  // resume: the user must actively scroll DOWN to within the resume distance.
  it('resumes (true) when actively scrolling down within the resume distance', () => {
    expect(nextAutoFollow(false, 5, 10, RESUME)).toBe(true);
    expect(nextAutoFollow(false, AUTO_SCROLL_RELEASE_EPS + 1, RESUME, RESUME)).toBe(true);
  });

  it('does NOT resume just by sitting near the bottom (no downward scroll)', () => {
    // The bug the user hit: nudge up to read, release fires, then on the idle
    // tick (delta ~= 0) the view must stay put, not snap back to bottom.
    expect(nextAutoFollow(false, 0, 10, RESUME)).toBe(false);
    expect(nextAutoFollow(false, 0, RESUME, RESUME)).toBe(false);
  });

  it('does not resume while scrolling down but still beyond the resume distance', () => {
    expect(nextAutoFollow(false, 50, RESUME + 1, RESUME)).toBe(false);
  });

  // release takes priority over resume in the same tick (Lundis: scrolling up
  // must always stop following, even near the bottom).
  it('prioritizes release over resume when both could fire in one tick', () => {
    expect(nextAutoFollow(true, -(AUTO_SCROLL_RELEASE_EPS + 1), 10, RESUME)).toBe(false);
  });

  it('keeps the previous state when neither release nor resume applies', () => {
    // idle / content growth: delta ~= 0 -> unchanged
    expect(nextAutoFollow(true, 0, 500, RESUME)).toBe(true);
    expect(nextAutoFollow(false, 0, 500, RESUME)).toBe(false);
    // big block inserted at once: scrollTop unchanged (delta 0), dist jumps ->
    // must stay following (the issue #100 bug case)
    expect(nextAutoFollow(true, 0, 4000, RESUME)).toBe(true);
  });

  it('respects a custom release EPS argument', () => {
    expect(nextAutoFollow(true, -10, 500, RESUME, 20)).toBe(true);
    expect(nextAutoFollow(true, -25, 500, RESUME, 20)).toBe(false);
  });
});
