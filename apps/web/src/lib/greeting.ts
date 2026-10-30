// The time of day, for the greeting on Today and what 墨 says there. 晚安 is for going to bed,
// so it waits until late; the evening before that is 晚上好.

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** Morning from 5:00, afternoon from 11:00, evening from 18:00, night from 22:00. */
export function partOfDay(hour: number): PartOfDay {
  if (hour < 5 || hour >= 22) return 'night';
  if (hour < 11) return 'morning';
  return hour < 18 ? 'afternoon' : 'evening';
}

export const GREETING_ZH: Record<PartOfDay, string> = {
  morning: '早安',
  afternoon: '午安',
  evening: '晚上好',
  night: '晚安',
};
