// What to tell the learner when an account action fails: the server's own wording for
// validation and rate limits, plain words for the usual cases, and never a raw browser error.

import { ApiError } from '../../lib/api';
import { t } from '../../lib/i18n/index.svelte';

export type AuthAction = 'login' | 'register' | 'password' | 'other';

export function authMessage(e: unknown, action: AuthAction = 'other'): string {
  const say = t().errors;
  if (e instanceof ApiError) {
    if (e.status === 401 && action === 'login') return say.wrongLogin;
    if (e.status === 409 && action === 'register') return say.emailTaken;
    if (e.status === 403 && action === 'password') return say.wrongPassword;
    if (e.status === 401) return say.sessionEnded;
    if (e.status >= 500) return say.server;
    return e.message || say.generic;
  }
  return e instanceof Error && e.message ? e.message : say.generic;
}
