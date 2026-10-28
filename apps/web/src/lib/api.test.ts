import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  ApiError,
  OFFLINE_MESSAGE,
  onSessionLost,
  onSessionRenewed,
  refreshSession,
  sessionFresh,
  setSession,
} from './api';

const user = { id: 'u1', email: 'a@b.c', displayName: null, createdAt: '2026-01-01' };
const session = (token: string) => ({ user, accessToken: token, expiresIn: 900 });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => {
    const headers = (init as RequestInit).headers as Record<string, string>;
    return `${String(url).replace('/api', '')} ${headers?.['authorization'] ?? '-'}`;
  });

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  setSession(null);
  onSessionLost(() => undefined);
  onSessionRenewed(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('api', () => {
  it('refreshes once and retries on 401', async () => {
    setSession('old', 900);
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, session('new')))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api('/v1/me')).resolves.toEqual({ ok: true });
    expect(calls()).toEqual(['/v1/me Bearer old', '/v1/auth/refresh -', '/v1/me Bearer new']);
  });

  it('shares one refresh between requests that fail together', async () => {
    setSession('old', 900);
    let release: (r: Response) => void = () => undefined;
    const pending = new Promise<Response>((r) => (release = r));
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/refresh')) return pending;
      const auth = (fetchMock.mock.calls.at(-1)?.[1] as RequestInit).headers as Record<
        string,
        string
      >;
      return Promise.resolve(auth['authorization'] === 'Bearer new' ? json(200, 1) : json(401, {}));
    });
    const both = Promise.all([api('/v1/a'), api('/v1/b')]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    release(json(200, session('new')));
    await expect(both).resolves.toEqual([1, 1]);
    expect(calls().filter((c) => c.includes('refresh'))).toHaveLength(1);
  });

  it('signs out when the retry is refused too', async () => {
    setSession('old', 900);
    const lost = vi.fn();
    onSessionLost(lost);
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, session('new')))
      .mockResolvedValueOnce(json(401, {}));
    await expect(api('/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(lost).toHaveBeenCalledOnce();
    expect(sessionFresh()).toBe(false);
  });

  it('signs out when there is no session to refresh', async () => {
    setSession('old', 900);
    const lost = vi.fn();
    onSessionLost(lost);
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    await expect(api('/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(lost).toHaveBeenCalledOnce();
  });

  it('turns a dropped connection into a readable error, not a TypeError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
    const error = await api('/v1/me', { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, message: OFFLINE_MESSAGE });
  });

  it('does not take being offline for being signed out', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
    await expect(refreshSession()).rejects.toMatchObject({ status: 0 });
    fetchMock.mockResolvedValueOnce(json(503, {}));
    await expect(refreshSession()).rejects.toMatchObject({ status: 503 });
  });

  it('renews a token that is about to expire before sending', async () => {
    vi.useFakeTimers();
    setSession('old', 900);
    expect(sessionFresh()).toBe(true);
    vi.advanceTimersByTime(14.5 * 60_000);
    expect(sessionFresh()).toBe(false);
    const renewed = vi.fn();
    onSessionRenewed(renewed);
    fetchMock
      .mockResolvedValueOnce(json(200, session('new')))
      .mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api('/v1/me')).resolves.toEqual({ ok: true });
    expect(calls()).toEqual(['/v1/auth/refresh -', '/v1/me Bearer new']);
    expect(renewed).toHaveBeenCalledWith(session('new'));
    expect(sessionFresh()).toBe(true);
  });

  it('passes the server message through for other failures', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { message: 'Use at least 8 characters' }));
    await expect(api('/v1/auth/register', { auth: false })).rejects.toMatchObject({
      status: 400,
      message: 'Use at least 8 characters',
    });
  });
});
