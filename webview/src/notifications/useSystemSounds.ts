import { useEffect, useState } from 'react';
import { api } from '@/api/ClaudeCodeApi';
import type { SystemSound } from './types';

/**
 * Shape returned by `useSystemSounds`.
 *
 * - `sounds`  — last successfully fetched list (empty until the first response).
 * - `loading` — `true` while a fetch is in flight and no cached value exists yet.
 * - `error`   — error message string when the fetch rejected, else `null`.
 */
export interface UseSystemSoundsResult {
  sounds: SystemSound[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Module-scope cache
//
// The list of OS system sounds is stable for the backend's lifetime, so we
// keep a single shared cache and one in-flight Promise. All hook subscribers
// register a small notifier that fires when the cache transitions, which lets
// concurrent mounts share a single network round trip.
// ---------------------------------------------------------------------------

type SoundsState = {
  sounds: SystemSound[];
  loading: boolean;
  error: string | null;
};

let cache: SystemSound[] | null = null;
let inFlight: Promise<SystemSound[]> | null = null;
let lastError: string | null = null;
const subscribers = new Set<(state: SoundsState) => void>();

function snapshot(): SoundsState {
  if (cache !== null) {
    return { sounds: cache, loading: false, error: null };
  }
  if (lastError !== null) {
    return { sounds: [], loading: false, error: lastError };
  }
  return { sounds: [], loading: inFlight !== null, error: null };
}

function notifyAll(): void {
  const state = snapshot();
  subscribers.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // Defensive: a single faulty listener shouldn't poison the rest.
    }
  });
}

function ensureFetch(): Promise<SystemSound[]> {
  if (cache !== null) {
    return Promise.resolve(cache);
  }
  if (inFlight) {
    return inFlight;
  }
  // Reset previous error so a retry after `_resetSystemSoundsCache()` starts clean.
  lastError = null;
  inFlight = api.sounds
    .list()
    .then((sounds) => {
      cache = sounds;
      lastError = null;
      return sounds;
    })
    .catch((err: unknown) => {
      lastError = err instanceof Error ? err.message : String(err);
      cache = null;
      throw err;
    })
    .finally(() => {
      inFlight = null;
      notifyAll();
    });
  return inFlight;
}

/**
 * React hook that returns the OS system-sound list fetched from the backend.
 *
 * The list is cached at module scope for the lifetime of the page, so every
 * subscriber after the first one renders synchronously with `loading: false`
 * and the cached data. Concurrent mounts share a single in-flight Promise.
 *
 * Errors are surfaced as `error: string`. The next `_resetSystemSoundsCache()`
 * call (test-only helper) will trigger a fresh fetch on the next mount.
 */
export function useSystemSounds(): UseSystemSoundsResult {
  const [state, setState] = useState<SoundsState>(() => snapshot());

  useEffect(() => {
    const listener = (next: SoundsState) => setState(next);
    subscribers.add(listener);

    // Kick off a fetch if nothing has happened yet. Swallow rejection here —
    // the error is already captured in module-level `lastError` and broadcast
    // via `notifyAll()`.
    if (cache === null && inFlight === null && lastError === null) {
      ensureFetch().catch(() => {
        /* handled via lastError + notifyAll */
      });
    }

    // Sync to the freshest snapshot in case the cache was filled between
    // render and subscription.
    setState(snapshot());

    return () => {
      subscribers.delete(listener);
    };
  }, []);

  return state;
}

/**
 * Test-only: drop the cache so the next `useSystemSounds()` mount re-fetches.
 *
 * Production callers should never need this.
 */
export function _resetSystemSoundsCache(): void {
  cache = null;
  inFlight = null;
  lastError = null;
  subscribers.clear();
}
