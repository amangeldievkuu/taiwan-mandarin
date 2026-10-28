// What to tell the learner when an account action fails: the server's own wording for
// validation and rate limits, plain words for the usual cases, and never a raw browser error.

import { ApiError } from '../../lib/api';

export type AuthAction = 'login' | 'register' | 'password' | 'other';

export function authMessage(e: unknown, action: AuthAction = 'other'): string {
  if (e instanceof ApiError) {
    if (e.status === 401 && action === 'login') return 'Wrong email or password.';
    if (e.status === 409 && action === 'register')
      return 'That email already has an account. Sign in instead?';
    if (e.status === 403 && action === 'password') return 'The current password is wrong.';
    if (e.status === 401) return 'Your session ended. Sign in again.';
    if (e.status >= 500) return 'The server had a problem. Try again in a moment.';
    return e.message || 'Something went wrong.';
  }
  return e instanceof Error && e.message ? e.message : 'Something went wrong.';
}
