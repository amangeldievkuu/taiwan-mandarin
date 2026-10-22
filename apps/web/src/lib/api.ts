// HTTP client for the API. The access token lives in memory only; the refresh token is an
// httpOnly cookie, so a 401 triggers one silent refresh and a retry.

import type { AuthResponse } from '@taiwan-mandarin/shared/api';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
/** Long enough for an AI answer: the server gives up first (45 s, plus one retry). */
const TIMEOUT_MS = 100_000;
/** A streamed answer that sends nothing for this long has stalled. */
const STREAM_IDLE_MS = 60_000;

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
    response = await attempt();
    if (response.status === 401 && auth) {
      const session = await refreshSession();
      if (!session) {
        onSignedOut?.();
        throw new ApiError(401, 'Signed out');
      }
      response = await attempt();
    }
  } catch (e) {
    if (timeout.signal.aborted && !signal?.aborted) {
      throw new ApiError(0, 'The server took too long to answer. Try again.');
    }
    throw e;
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
