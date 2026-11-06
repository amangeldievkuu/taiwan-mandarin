// A copy of the learner's data to keep: everything as JSON, or words and reviews as CSV for a
// spreadsheet. Built here, so it works offline and without an account.

import type { Settings } from '@taiwan-mandarin/shared';
import type { CardRecord, PracticeRecord, ReviewRecord, Snapshot } from './storage';

export interface ExportData {
  settings: Settings;
  cards: Record<string, CardRecord>;
  deck: Snapshot['deck'];
  reviews: ReviewRecord[];
  practice: PracticeRecord[];
}

/** `pending` only says what is left to sync. */
const withoutPending = <T extends { pending?: boolean }>(rows: T[]): T[] =>
  rows.map((row) => {
    const copy = { ...row };
    delete copy.pending;
    return copy;
  });

export function toJson(data: ExportData, now: Date): string {
  return JSON.stringify(
    {
      app: 'taiwan-mandarin',
      exportedAt: now.toISOString(),
      settings: data.settings,
      cards: data.cards,
      deck: data.deck,
      reviews: withoutPending(data.reviews),
      practice: withoutPending(data.practice),
    },
    null,
    2,
  );
}

type Cell = string | number | boolean | null | undefined;

const cell = (value: Cell): string => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const iso = (time: Date | string | number | null | undefined): string =>
  time === null || time === undefined ? '' : new Date(time).toISOString();

/** With a byte order mark, or Excel reads the characters as another encoding. */
const csv = (header: readonly string[], rows: readonly Cell[][]): string =>
  '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';

export function cardsCsv(cards: Record<string, CardRecord>): string {
  return csv(
    [
      'word',
      'level',
      'state',
      'due',
      'stability',
      'difficulty',
      'reps',
      'lapses',
      'last_review',
      'suspended',
    ],
    Object.entries(cards).map(([id, { card, level, suspended }]) => [
      id,
      level,
      card.state,
      iso(card.due),
      card.stability,
      card.difficulty,
      card.reps,
      card.lapses,
      iso(card.last_review),
      suspended ?? false,
    ]),
  );
}

export function reviewsCsv(reviews: readonly ReviewRecord[]): string {
  return csv(
    ['word', 'reviewed_at', 'rating', 'state', 'stability', 'difficulty', 'duration_ms'],
    reviews.map((r) => [
      r.wordId,
      iso(r.review),
      r.rating,
      r.state,
      r.stability,
      r.difficulty,
      r.durationMs,
    ]),
  );
}

/** Hands the browser a file to save. */
export function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Some browsers start the download only after this tick.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
