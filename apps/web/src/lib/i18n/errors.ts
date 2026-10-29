// Errors in the learner's language: by the code the API (or the app itself) gave, else as the
// server worded them, which is English.

import { fillParams } from '@taiwan-mandarin/shared/api';
import { ApiError } from '../api';
import { t } from './index.svelte';

export function errorText(e: unknown): string {
  const say = t().errors;
  if (e instanceof ApiError) {
    const code = e.code;
    if (code && Object.hasOwn(say.codes, code)) return fillParams(say.codes[code], e.params);
    if (e.status >= 500) return say.server;
    return e.message || say.generic;
  }
  return e instanceof Error && e.message ? e.message : say.generic;
}
