import { writeSnapshot } from './account-store';
import type { AccountSnapshot } from './account-store';
import type { AccountUsageData } from '../../shared/account';
import { classifyError } from '../handlers/getUsage';

export const CLAUDE_CODE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

export async function fetchUsageWithToken(accessToken: string): Promise<AccountUsageData> {
  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    method: 'GET',
    headers: {
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || `Status ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  const data = await res.json() as any;
  return {
    five_hour: data.five_hour || null,
    seven_day: data.seven_day || null,
    seven_day_sonnet: data.seven_day_sonnet || null,
    seven_day_opus: data.seven_day_opus || null,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}> {
  const res = await fetch('https://platform.claude.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLAUDE_CODE_CLIENT_ID,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || `Status ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

const isExpired = (expiresAt: any): boolean => {
  if (!expiresAt) return true;
  const time = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
  return isNaN(time) ? true : time < Date.now();
};

export async function usageForSnapshot(
  id: string,
  snapshot: AccountSnapshot,
): Promise<{
  usage: AccountUsageData | null;
  error: string | null;
  errorKind: string | null;
}> {
  let credsObj: any;
  try {
    credsObj = JSON.parse(snapshot.credentials);
  } catch (e: any) {
    return { usage: null, error: 'Invalid credentials format', errorKind: 'unknown' };
  }

  const oauth = credsObj?.claudeAiOauth;
  if (!oauth || typeof oauth !== 'object') {
    return { usage: null, error: 'requires OAuth login', errorKind: 'auth' };
  }

  let accessToken = oauth.accessToken;
  const refreshToken = oauth.refreshToken;
  const expiresAt = oauth.expiresAt;

  if (isExpired(expiresAt)) {
    if (!refreshToken) {
      return {
        usage: null,
        error: 'Access token expired and no refresh token available',
        errorKind: 'auth',
      };
    }
    try {
      const refreshedTokens = await refreshAccessToken(refreshToken);
      accessToken = refreshedTokens.accessToken;
      oauth.accessToken = refreshedTokens.accessToken;
      oauth.refreshToken = refreshedTokens.refreshToken;
      oauth.expiresAt = refreshedTokens.expiresAt;

      // Write snapshot immediately on successful token refresh
      const updatedSnapshot: AccountSnapshot = {
        ...snapshot,
        credentials: JSON.stringify(credsObj),
      };
      await writeSnapshot(id, updatedSnapshot);
    } catch (e: any) {
      const info = classifyError(e.message, e.status);
      return { usage: null, error: info.message, errorKind: info.kind };
    }
  }

  let usage: AccountUsageData | null = null;
  try {
    usage = await fetchUsageWithToken(accessToken);
  } catch (err: any) {
    if (err.status === 401 && refreshToken) {
      try {
        const refreshedTokens = await refreshAccessToken(refreshToken);
        accessToken = refreshedTokens.accessToken;
        oauth.accessToken = refreshedTokens.accessToken;
        oauth.refreshToken = refreshedTokens.refreshToken;
        oauth.expiresAt = refreshedTokens.expiresAt;

        // Write snapshot immediately on successful token refresh
        const updatedSnapshot: AccountSnapshot = {
          ...snapshot,
          credentials: JSON.stringify(credsObj),
        };
        await writeSnapshot(id, updatedSnapshot);

        usage = await fetchUsageWithToken(accessToken);
      } catch (retryErr: any) {
        const info = classifyError(retryErr.message, retryErr.status);
        return {
          usage: null,
          error: info.message,
          errorKind: info.kind,
        };
      }
    } else {
      const info = classifyError(err.message, err.status);
      return { usage: null, error: info.message, errorKind: info.kind };
    }
  }

  return {
    usage,
    error: null,
    errorKind: null,
  };
}
