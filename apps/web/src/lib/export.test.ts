import { DEFAULT_SETTINGS } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { cardsCsv, reviewsCsv, toJson, type ExportData } from './export';
import { newCard } from './srs';
import type { ReviewRecord } from './storage';

const now = new Date('2026-11-06T09:00:00Z');

const review: ReviewRecord = {
  id: 'r1',
  wordId: '你好',
  rating: 3,
  state: 0,
  review: now.getTime(),
  due: now.getTime(),
  stability: 1.5,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 1,
  durationMs: 2000,
  pending: true,
};

const data: ExportData = {
  settings: DEFAULT_SETTINGS,
  cards: { 你好: { card: newCard(now), updatedAt: now.getTime(), level: 'N1' } },
  deck: [{ id: '捷運', addedAt: now.getTime() }],
  reviews: [review],
  practice: [],
};

describe('export', () => {
  it('writes everything as JSON, without what only sync needs', () => {
    const parsed = JSON.parse(toJson(data, now));
    expect(parsed.exportedAt).toBe(now.toISOString());
    expect(Object.keys(parsed.cards)).toEqual(['你好']);
    expect(parsed.cards['你好'].card.due).toBe(now.toISOString());
    expect(parsed.deck[0].id).toBe('捷運');
    expect(parsed.reviews[0].wordId).toBe('你好');
    expect(parsed.reviews[0]).not.toHaveProperty('pending');
  });

  it('writes cards as CSV that Excel reads as Unicode', () => {
    const [header, row] = cardsCsv(data.cards).split('\r\n');
    expect(header?.startsWith('﻿word,level,state,due,')).toBe(true);
    expect(row).toBe(`你好,N1,0,${now.toISOString()},0,0,0,0,,false`);
  });

  it('writes reviews as CSV, one line each', () => {
    const lines = reviewsCsv([review]).split('\r\n');
    expect(lines[1]).toBe(`你好,${now.toISOString()},3,0,1.5,5,2000`);
    expect(lines).toHaveLength(3); // header, row, and the final line break
  });

  it('quotes what would break a CSV line', () => {
    const line = reviewsCsv([{ ...review, wordId: 'a,"b"\nc' }]);
    expect(line).toContain('"a,""b""\nc",');
  });
});
