// Seals (印) to collect: milestones of practice, all worked out from the activity per day, so every
// device shows the same album. None of them depends on how answers were graded.

import { totalXp, type ActivityMap } from './activity.ts';
import type { Kintsugi } from './kintsugi.ts';

export interface SealAward {
  id: string;
  /** The characters on the seal. */
  zh: string;
  en: string;
  /** How far along, 0–1 (1 = earned). */
  progress: number;
}

export function achievements(days: ActivityMap, streak: Kintsugi): SealAward[] {
  const learned = Object.values(days).reduce((sum, d) => sum + d.learned, 0);
  const practiced = Object.values(days).some((d) => d.reviews > 0);
  const xp = totalXp(days);
  const toward = (value: number, goal: number) => Math.min(1, value / goal);
  return [
    { id: 'first-day', zh: '初', en: 'First day of study', progress: practiced ? 1 : 0 },
    {
      id: 'first-gold',
      zh: '金',
      en: 'First gap mended with gold',
      progress: toward(streak.seams, 1),
    },
    { id: 'bowl-7', zh: '週', en: 'A 7-day sapling', progress: toward(streak.longest, 7) },
    { id: 'bowl-30', zh: '月', en: 'Buds at 30 days', progress: toward(streak.longest, 30) },
    {
      id: 'bowl-100',
      zh: '百日',
      en: 'In bloom at 100 days',
      progress: toward(streak.longest, 100),
    },
    { id: 'words-100', zh: '百', en: '100 new words', progress: toward(learned, 100) },
    { id: 'words-500', zh: '五百', en: '500 new words', progress: toward(learned, 500) },
    { id: 'words-1000', zh: '千', en: '1,000 new words', progress: toward(learned, 1000) },
    { id: 'xp-10000', zh: '萬', en: '10,000 drops of ink', progress: toward(xp, 10_000) },
  ];
}
