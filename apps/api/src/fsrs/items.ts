// Review history → FSRS training items. Each item is one card's reviews up to the one being
// predicted, as (rating, days since the previous review). A day starts at 04:00 learner time (as
// in Anki), so a late-night review counts toward the previous day.
//
// An item is as long as the card's history before it, so the work grows with the square of one
// card's review count. Sync takes any reviews a client sends (20,000 of one word in a request),
// so both are bounded here: without that, one account could stop and crash the server.

export interface ReviewPoint {
  wordId: string;
  reviewedAt: Date;
  rating: number;
}

export type TrainingItem = { rating: number; deltaT: number }[];

const DAY = 86_400_000;

/**
 * A card's reviews after its first this many are left out. The fit needs a history from its first
 * review, and few cards are ever reviewed this often.
 */
export const MAX_CARD_REVIEWS = 64;

/**
 * Steps in all items together (a review counts once in every item it is in): this bounds a fit's
 * time and memory. 100,000 reviews over 5,000 words take about a million.
 */
export const MAX_STEPS = 2_000_000;

export function dayNumber(at: Date, utcOffsetMinutes: number): number {
  return Math.floor((at.getTime() + utcOffsetMinutes * 60_000 - 4 * 3_600_000) / DAY);
}

/**
 * One item per review after a card's first, once the card has been seen on an earlier day, in
 * review order (as the binding's own converter gives them). Past `maxSteps`, the newest are kept.
 */
export function trainingItems(
  reviews: readonly ReviewPoint[],
  utcOffsetMinutes = 480,
  maxSteps = MAX_STEPS,
): TrainingItem[] {
  const byCard = new Map<string, ReviewPoint[]>();
  for (const r of reviews) {
    const list = byCard.get(r.wordId);
    if (list) list.push(r);
    else byCard.set(r.wordId, [r]);
  }

  /** Each card's steps, and each item as a card, a length and the time of its last review. */
  const histories: TrainingItem[] = [];
  const ends: { card: number; length: number; at: number }[] = [];
  for (const list of byCard.values()) {
    list.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
    const kept = list.slice(0, MAX_CARD_REVIEWS);
    let previous: number | undefined;
    const steps = kept.map((r) => {
      const day = dayNumber(r.reviewedAt, utcOffsetMinutes);
      const deltaT = previous === undefined ? 0 : day - previous;
      previous = day;
      return { rating: r.rating, deltaT };
    });
    const card = histories.push(steps) - 1;
    let leftFirstDay = false;
    for (let end = 2; end <= steps.length; end++) {
      if ((steps[end - 1]?.deltaT ?? 0) > 0) leftFirstDay = true;
      const at = kept[end - 1]?.reviewedAt.getTime() ?? 0;
      if (leftFirstDay) ends.push({ card, length: end, at });
    }
  }

  // Newest first until the budget is spent, then back in review order.
  ends.sort((a, b) => b.at - a.at);
  const chosen: typeof ends = [];
  let spent = 0;
  for (const end of ends) {
    if (spent + end.length > maxSteps) break;
    spent += end.length;
    chosen.push(end);
  }
  chosen.sort((a, b) => a.at - b.at);
  return chosen.map(({ card, length }) => (histories[card] ?? []).slice(0, length));
}
