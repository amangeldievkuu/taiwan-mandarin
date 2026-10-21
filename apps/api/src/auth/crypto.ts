import { createHash, randomBytes } from 'node:crypto';

/** URL-safe random secret. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Tokens are stored only as SHA-256 hashes (they are random, so no slow hash is needed). */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
