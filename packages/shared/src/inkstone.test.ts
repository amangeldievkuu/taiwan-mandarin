import { describe, expect, it } from 'vitest';
import {
  activeLooks,
  DEFAULT_LOOKS,
  isUnlocked,
  nextUnlock,
  SLOTS,
  UNLOCKS,
  unlockedAt,
} from './inkstone.ts';
import { SettingsSchema } from './api/index.ts';
import { DEFAULT_SETTINGS } from './settings.ts';

describe('inkstone', () => {
  it('unlocks in order, one look each, never a default', () => {
    const at = UNLOCKS.map((u) => u.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(new Set(UNLOCKS.map((u) => u.id)).size).toBe(UNLOCKS.length);
    for (const u of UNLOCKS) {
      expect(SLOTS[u.slot]).toContain(u.value);
      expect(DEFAULT_LOOKS[u.slot]).not.toBe(u.value);
    }
    // Every look but the defaults can be unlocked.
    const looks = Object.values(SLOTS).reduce((n, values) => n + values.length - 1, 0);
    expect(UNLOCKS.length).toBe(looks);
  });

  it('knows what is unlocked and what comes next', () => {
    expect(unlockedAt(0)).toEqual([]);
    expect(nextUnlock(0)?.id).toBe('paper-nine');
    expect(unlockedAt(1_200).map((u) => u.id)).toEqual(['paper-nine', 'pot-tenmoku']);
    expect(nextUnlock(1_200)?.id).toBe('mo-scarf');
    expect(nextUnlock(1_000_000)).toBeUndefined();
    expect(isUnlocked('pot', 'celadon', 0)).toBe(true);
    expect(isUnlocked('pot', 'tenmoku', 999)).toBe(false);
    expect(isUnlocked('pot', 'tenmoku', 1_000)).toBe(true);
  });

  it('uses a chosen look only once its ink is there', () => {
    const chosen = { pot: 'jun', paper: 'nine' } as const;
    expect(activeLooks(chosen, 600)).toEqual({ ...DEFAULT_LOOKS, paper: 'nine' });
    expect(activeLooks(chosen, 30_000)).toEqual({ ...DEFAULT_LOOKS, pot: 'jun', paper: 'nine' });
    expect(activeLooks(undefined, 30_000)).toEqual(DEFAULT_LOOKS);
    // Something stored by a newer app that this one doesn't know.
    expect(activeLooks({ pot: 'raku' } as never, 1e9).pot).toBe('celadon');
  });

  it('syncs the choices, and settings from older apps without them', () => {
    expect(SettingsSchema.parse(DEFAULT_SETTINGS).looks).toEqual({});
    const older: Partial<typeof DEFAULT_SETTINGS> = { ...DEFAULT_SETTINGS };
    delete older.looks;
    expect(SettingsSchema.safeParse(older).success).toBe(true);
    expect(SettingsSchema.parse({ ...DEFAULT_SETTINGS, looks: { mo: 'hat' } }).looks).toEqual({
      mo: 'hat',
    });
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, looks: { mo: 'cape' } }).success).toBe(
      false,
    );
  });
});
