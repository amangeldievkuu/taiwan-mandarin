// What to tell the learner when an account action fails: plain words for the usual cases, the
// server's error in the learner's language otherwise, and never a raw browser error.

import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/i18n/errors';
import { t } from '../../lib/i18n/index.svelte';

export type AuthAction = 'login' | 'register' | 'password' | 'other';

export function authMessage(e: unknown, action: AuthAction = 'other'): string {
  const say = t().errors;
  if (e instanceof ApiError) {
    if (e.status === 401 && action === 'login') return say.wrongLogin;
    if (e.status === 409 && action === 'register') return say.emailTaken;
    if (e.status === 403 && action === 'password') return say.wrongPassword;
    if (e.status === 401) return say.sessionEnded;
  }
  return errorText(e);
}
