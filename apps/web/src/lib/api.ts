// HTTP client for the API. The access token lives in memory only; the refresh token is an
// httpOnly cookie, so a 401 triggers one silent refresh and a retry.

import type { AuthResponse } from '@taiwan-mandarin/shared/api';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
/** Called when the session is gone (refresh failed). */
let onSignedOut: (() => void) | null = null;

export function setSession(token: string | null): void {
  accessToken = token;
}

export function onSessionLost(callback: () => void): void {
  onSignedOut = callback;
}

/** Tries the refresh cookie. Resolves null when not signed in. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${BASE}/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => (r.ok ? ((await r.json()) as AuthResponse) : null))
    .catch(() => null)
    .then((session) => {
      accessToken = session?.accessToken ?? null;
      return session;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { body, auth = true, ...rest } = init;
  const send = () =>
    fetch(`${BASE}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined && !(body instanceof FormData)
          ? { 'content-type': 'application/json' }
          : {}),
        ...(auth && accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...rest.headers,
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });

  let response = await send();
  if (response.status === 401 && auth) {
    const session = await refreshSession();
    if (!session) {
      onSignedOut?.();
      throw new ApiError(401, 'Signed out');
    }
    response = await send();
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => undefined)) as
      { message?: string | string[] } | undefined;
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? response.statusText);
    throw new ApiError(response.status, message, data);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
