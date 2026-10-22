// Learning statistics from the review log and card states. Shared by the web app and the API, so
// both show the same numbers (day-by-day activity, XP and the streak are in activity.ts and
// kintsugi.ts).

/** The parts of a review the statistics need. */
export interface ReviewLike {
  /** Epoch ms. */
  review: number;
  /** 1 Again … 4 Easy. */
  rating: number;
  /** Card state before the review (2 = Review). */
  state: number;
}

/** Local calendar day, "2026-10-21". */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DayStats {
  /** Local day, "2026-10-21". */
  date: string;
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
}

export interface CardCounts {
  /** Seen at least once. */
  learned: number;
  /** Stability of three weeks or more. */
  mature: number;
  suspended: number;
}

export function cardCounts(
  cards: Readonly<Record<string, { card: { stability: number }; suspended?: boolean }>>,
): CardCounts {
  let learned = 0;
  let mature = 0;
  let suspended = 0;
  for (const { card, suspended: off } of Object.values(cards)) {
    if (off) suspended++;
    learned++;
    if (card.stability >= 21) mature++;
  }
  return { learned, mature, suspended };
}
