import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuid } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a version 4 UUID', () => {
    expect(uuid()).toMatch(V4);
  });

  it('works where crypto.randomUUID is missing (plain http outside localhost)', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array<ArrayBuffer>) => real.getRandomValues(bytes),
    });
    const ids = new Set(Array.from({ length: 50 }, uuid));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(V4);
  });
});
