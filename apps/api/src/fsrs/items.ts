// Review history → FSRS training items. Each item is one card's reviews up to the one being
// predicted, as (rating, days since the previous review). A day starts at 04:00 learner time (as
// in Anki), so a late-night review counts toward the previous day.

export interface ReviewPoint {
  wordId: string;
  reviewedAt: Date;
  rating: number;
}

export type TrainingItem = { rating: number; deltaT: number }[];

const DAY = 86_400_000;

export function dayNumber(at: Date, utcOffsetMinutes: number): number {
  return Math.floor((at.getTime() + utcOffsetMinutes * 60_000 - 4 * 3_600_000) / DAY);
}

export function trainingItems(
  reviews: readonly ReviewPoint[],
  utcOffsetMinutes = 480,
): TrainingItem[] {
  const byCard = new Map<string, ReviewPoint[]>();
  for (const r of reviews) byCard.set(r.wordId, [...(byCard.get(r.wordId) ?? []), r]);
  const items: TrainingItem[] = [];
  for (const list of byCard.values()) {
    list.sort((a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime());
    let previous: number | undefined;
    const steps = list.map((r) => {
      const day = dayNumber(r.reviewedAt, utcOffsetMinutes);
      const deltaT = previous === undefined ? 0 : day - previous;
      previous = day;
      return { rating: r.rating, deltaT };
    });
    // One item per review after the first, once the card has been seen on an earlier day.
    for (let end = 2; end <= steps.length; end++) {
      const prefix = steps.slice(0, end);
      if (prefix.slice(1).some((s) => s.deltaT > 0)) items.push(prefix);
    }
  }
  return items;
}
