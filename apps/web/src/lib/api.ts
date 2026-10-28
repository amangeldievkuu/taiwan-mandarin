// HTTP client for the API. The access token lives in memory only; the refresh token is an
// httpOnly cookie. A token about to expire is renewed before a request, and a 401 triggers one
// silent refresh and a retry; a second 401 means the session is gone.

import type { AuthResponse } from '@taiwan-mandarin/shared/api';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
/** Long enough for an AI answer: the server gives up first (45 s, plus one retry). */
const TIMEOUT_MS = 100_000;
/** A streamed answer that sends nothing for this long has stalled. */
const STREAM_IDLE_MS = 60_000;
/**
 * A session check that takes longer than this is treated as offline. Generous: the server rotates
 * the cookie as it answers, so giving up early on a slow connection used to lose the session.
 */
const REFRESH_TIMEOUT_MS = 20_000;
/** Renew the access token this long before it expires, rather than letting a request fail first. */
const RENEW_AHEAD_MS = 60_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
  }
}

export const OFFLINE_MESSAGE = "Can't reach the server.";

let accessToken: string | null = null;
/** When the access token expires (ms since epoch); 0 when unknown. */
let expiresAt = 0;
let refreshing: Promise<AuthResponse | null> | null = null;
/** Called when the session is gone (refresh failed). */
let onSignedOut: (() => void) | null = null;
/** Called with every session the server hands out, so the app follows the account it is for. */
let onSession: ((session: AuthResponse) => void) | null = null;

export function setSession(token: string | null, expiresIn?: number): void {
  accessToken = token;
  expiresAt = token && expiresIn ? Date.now() + expiresIn * 1000 : 0;
}

export function onSessionLost(callback: () => void): void {
  onSignedOut = callback;
}

export function onSessionRenewed(callback: (session: AuthResponse) => void): void {
  onSession = callback;
}

/** True while an access token is held and not about to expire. */
export function sessionFresh(): boolean {
  return accessToken !== null && (expiresAt === 0 || Date.now() < expiresAt - RENEW_AHEAD_MS);
}

/** Network failures (no connection, DNS, a dropped socket) as one readable error. */
function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof TypeError) return new ApiError(0, OFFLINE_MESSAGE);
  return new ApiError(0, e instanceof Error ? e.message : String(e));
}

/**
 * Tries the refresh cookie. Resolves null when the server says there is no session, and rejects
 * (an ApiError with status 0) when it can't be asked, so being offline isn't taken for signing out.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), REFRESH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${BASE}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        signal: timeout.signal,
      });
    } catch {
      throw new ApiError(0, OFFLINE_MESSAGE);
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401) {
      setSession(null);
      return null;
    }
    if (!response.ok) throw new ApiError(response.status, OFFLINE_MESSAGE);
    const session = (await response.json()) as AuthResponse;
    setSession(session.accessToken, session.expiresIn);
    onSession?.(session);
    return session;
  })().finally(() => (refreshing = null));
  return refreshing;
}

/** Aborts as soon as one of the signals does (AbortSignal.any is too new for some iPhones). */
function anySignal(signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

type Init = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  /** 0 for no time limit (streams watch for stalls instead). */
  timeoutMs?: number;
};

function signedOut(): never {
  setSession(null);
  onSignedOut?.();
  throw new ApiError(401, 'Signed out');
}

/** fetch with the session: one refresh and retry on 401; an ApiError for any other failure. */
async function send(path: string, init: Init = {}): Promise<Response> {
  const { body, auth = true, timeoutMs = TIMEOUT_MS, signal, ...rest } = init;
  const timeout = new AbortController();
  const timer = timeoutMs ? setTimeout(() => timeout.abort(), timeoutMs) : undefined;
  const attempt = () =>
    fetch(`${BASE}${path}`, {
      ...rest,
      signal: anySignal([signal ?? undefined, timeout.signal]),
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

  let response: Response;
  try {
    // An expiring token is renewed first, so the request itself doesn't have to fail and repeat.
    if (auth && accessToken && !sessionFresh()) await refreshSession().catch(() => null);
    response = await attempt();
    if (response.status === 401 && auth) {
      const session = await refreshSession();
      if (!session) signedOut();
      response = await attempt();
      if (response.status === 401) signedOut();
    }
  } catch (e) {
    if (timeout.signal.aborted && !signal?.aborted) {
      throw new ApiError(0, 'The server took too long to answer. Try again.');
    }
    if (signal?.aborted) throw e;
    throw asApiError(e);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => undefined)) as
      { message?: string | string[] } | undefined;
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? response.statusText);
    throw new ApiError(response.status, message, data);
  }
  return response;
}

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const response = await send(path, init);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/**
 * POSTs `body` and yields the NDJSON response one event at a time, as the lines arrive. Stops
 * when `signal` aborts; fails when nothing arrives for a minute.
 */
export async function* apiStream<T>(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<T> {
  const idle = new AbortController();
  let timer = setTimeout(() => idle.abort(), STREAM_IDLE_MS);
  const alive = () => {
    clearTimeout(timer);
    timer = setTimeout(() => idle.abort(), STREAM_IDLE_MS);
  };
  try {
    const response = await send(path, {
      method: 'POST',
      body,
      signal: anySignal([options.signal, idle.signal]),
      timeoutMs: 0,
      headers: { accept: 'application/x-ndjson' },
    });
    const reader = response.body?.getReader();
    if (!reader) throw new ApiError(0, 'This browser cannot read streamed answers.');
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        alive();
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, end).trim();
          buffer = buffer.slice(end + 1);
          if (line) yield JSON.parse(line) as T;
        }
      }
      const rest = (buffer + decoder.decode()).trim();
      if (rest) yield JSON.parse(rest) as T;
    } finally {
      // Stopped early (or failed): let the server know.
      reader.cancel().catch(() => undefined);
    }
  } catch (e) {
    if (idle.signal.aborted && !options.signal?.aborted) {
      throw new ApiError(0, 'The answer stopped arriving. Try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
