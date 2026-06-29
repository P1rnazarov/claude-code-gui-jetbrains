import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchUsageWithToken, refreshAccessToken, usageForSnapshot } from '../account-usage';
import * as accountStore from '../account-store';

describe('account-usage', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    vi.spyOn(accountStore, 'writeSnapshot').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchUsageWithToken returns usage when response is ok', async () => {
    const mockUsage = {
      five_hour: { utilization: 0.1, resets_at: '2026-06-29T21:30:41Z' },
      seven_day: null,
      seven_day_sonnet: null,
      seven_day_opus: null,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockUsage,
    });

    const result = await fetchUsageWithToken('token123');
    expect(result).toEqual(mockUsage);
    expect(mockFetch).toHaveBeenCalledWith('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'Authorization': 'Bearer token123',
      },
    });
  });

  it('fetchUsageWithToken throws error when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(fetchUsageWithToken('token123')).rejects.toThrow(/Unauthorized/);
  });

  it('refreshAccessToken POSTs to token endpoint and returns new credentials', async () => {
    const mockTokenRes = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTokenRes,
    });

    const result = await refreshAccessToken('old-refresh');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(mockFetch).toHaveBeenCalledWith('https://platform.claude.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: 'old-refresh',
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
      }),
    });
  });

  it('usageForSnapshot handles expired token proactively, refreshes and fetches usage', async () => {
    const credentials = JSON.stringify({
      claudeAiOauth: {
        accessToken: 'expired-access',
        refreshToken: 'refresh-token',
        expiresAt: '2020-01-01T00:00:00Z',
      },
    });
    const snapshot = {
      credentials,
      oauthAccount: null,
    };

    const mockTokenRes = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    };
    const mockUsage = {
      five_hour: { utilization: 0.5, resets_at: '2026-06-29T21:30:41Z' },
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/token')) {
        return {
          ok: true,
          json: async () => mockTokenRes,
        };
      }
      if (url.includes('/usage')) {
        return {
          ok: true,
          json: async () => mockUsage,
        };
      }
      return { ok: false };
    });

    const res = await usageForSnapshot('acc-1', snapshot);
    expect(res.usage?.five_hour?.utilization).toBe(0.5);
    expect(res.error).toBeNull();
    expect(accountStore.writeSnapshot).toHaveBeenCalled();
  });

  it('usageForSnapshot retries with refresh token on 401 error', async () => {
    const credentials = JSON.stringify({
      claudeAiOauth: {
        accessToken: 'invalid-access',
        refreshToken: 'refresh-token',
        expiresAt: '2030-01-01T00:00:00Z',
      },
    });
    const snapshot = {
      credentials,
      oauthAccount: null,
    };

    const mockTokenRes = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    };
    const mockUsage = {
      five_hour: { utilization: 0.3, resets_at: '2026-06-29T21:30:41Z' },
    };

    let usageCalledCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/token')) {
        return {
          ok: true,
          json: async () => mockTokenRes,
        };
      }
      if (url.includes('/usage')) {
        usageCalledCount++;
        if (usageCalledCount === 1) {
          return {
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
          };
        }
        return {
          ok: true,
          json: async () => mockUsage,
        };
      }
      return { ok: false };
    });

    const res = await usageForSnapshot('acc-1', snapshot);
    expect(res.usage?.five_hour?.utilization).toBe(0.3);
    expect(res.error).toBeNull();
    expect(accountStore.writeSnapshot).toHaveBeenCalled();
    expect(usageCalledCount).toBe(2);
  });

  it('usageForSnapshot returns error if no oauth login', async () => {
    const snapshot = {
      credentials: '{}',
      oauthAccount: null,
    };
    const res = await usageForSnapshot('acc-1', snapshot);
    expect(res.usage).toBeNull();
    expect(res.error).toBe('requires OAuth login');
    expect(res.errorKind).toBe('auth');
  });
});
