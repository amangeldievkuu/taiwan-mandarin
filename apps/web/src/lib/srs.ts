// Spaced repetition on top of ts-fsrs: scheduling, interval labels, session queue.

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
  type IPreview,
} from 'ts-fsrs';

export { Rating, State };
export { dayKey } from '@taiwan-mandarin/shared';
export type { Card, Grade };

export const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

/** Learning cards due within this window are shown again in the same session. */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/** How many cards later a requeued card comes back. */
const REQUEUE_OFFSET = 3;

let scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

/**
 * Target retention and, once the server has fitted them to the learner's review history,
 * personal FSRS weights.
 */
export function configureScheduler(options: { retention: number; w?: readonly number[] }): void {
  scheduler = fsrs(
    generatorParameters({
      enable_fuzz: true,
      request_retention: options.retention,
      ...(options.w ? { w: [...options.w] } : {}),
    }),
  );
}

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

/** Next state of the card for every grade. Use the same result to preview and to apply. */
export function preview(card: Card, now: Date): IPreview {
  return scheduler.repeat(card, now);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 45s → "<1m", 10 min → "10m", 3 h → "3h", 4 days → "4d", 2 months → "2mo", 1.5 years → "1.5y" */
export function formatInterval(ms: number): string {
  if (ms < MINUTE) return '<1m';
  // Each unit rolls over to the next once it would round up to it (59.6 min → "1h", not "60m").
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(ms / HOUR);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days}d`;
  const months = Math.round(ms / DAY / 30);
  if (months < 12) return `${months}mo`;
  return `${Number((ms / DAY / 365).toFixed(1))}y`;
}

export function intervalLabels(result: IPreview, now: Date): Record<Grade, string> {
  const labels = {} as Record<Grade, string>;
  for (const grade of GRADES) {
    labels[grade] = formatInterval(result[grade].card.due.getTime() - now.getTime());
  }
  return labels;
}

function isLearning(card: Card): boolean {
  return card.state === State.Learning || card.state === State.Relearning;
}

/**
 * Word ids for a session: due cards (oldest first, learning cards slightly ahead of time), then up
 * to `newAllowance` unseen words from `candidates` (in order: the learner's own deck, then the path).
 */
export function buildQueue(
  cards: Readonly<Record<string, { card: Card; suspended?: boolean } | undefined>>,
  candidates: readonly string[],
  now: Date,
  newAllowance: number,
): string[] {
  const due: { id: string; due: number }[] = [];
  for (const [id, record] of Object.entries(cards)) {
    if (!record || record.suspended) continue;
    const { card } = record;
    const limit = now.getTime() + (isLearning(card) ? LEARN_AHEAD_MS : 0);
    if (card.due.getTime() <= limit) due.push({ id, due: card.due.getTime() });
  }
  due.sort((a, b) => a.due - b.due);
  const fresh: string[] = [];
  const seen = new Set<string>();
  for (const id of candidates) {
    if (fresh.length >= newAllowance) break;
    if (cards[id] || seen.has(id)) continue;
    seen.add(id);
    fresh.push(id);
  }
  return [...due.map((d) => d.id), ...fresh];
}

/** Again, or a learning step that falls inside the session window, brings the card back. */
export function shouldRequeue(grade: Grade, next: Card, now: Date): boolean {
  if (grade === Rating.Again) return true;
  return isLearning(next) && next.due.getTime() - now.getTime() <= LEARN_AHEAD_MS;
}

/** Removes the head of the queue and, if requeued, reinserts it a few cards later. */
export function advanceQueue(queue: readonly string[], requeue: boolean): string[] {
  const [head, ...rest] = queue;
  if (!requeue || head === undefined) return rest;
  const at = Math.min(REQUEUE_OFFSET, rest.length);
  return [...rest.slice(0, at), head, ...rest.slice(at)];
}
