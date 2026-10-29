// The app's language: the store sets `locale.lang` from the settings, and components read their
// words with t(), which follows it. Call t() in markup, $derived or event handlers, not once at the
// top of a script: a value taken there keeps the old language.

import type { Lang } from '@taiwan-mandarin/shared';
import { en, type Messages } from './en';
import { vi } from './vi';

export const locale = $state<{ lang: Lang; hanViet: boolean }>({ lang: 'en', hanViet: true });

const CATALOGS: Record<Lang, Messages> = { en, vi };

/** The words of the current language. */
export const t = (): Messages => CATALOGS[locale.lang];

/** The locale for dates and numbers. English uses British conventions (21 October). */
export const intlLocale = (): string => (locale.lang === 'vi' ? 'vi-VN' : 'en-GB');

/** A number as the language writes it: "1,000" / "1.000". */
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions): string =>
  n.toLocaleString(locale.lang === 'vi' ? 'vi-VN' : 'en-US', options);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 45 s → "<1m", 10 min → "10m", 3 h → "3h", 4 days → "4d", 2 months → "2mo", 1.5 years → "1.5y". */
export function formatInterval(ms: number): string {
  const units = t().interval;
  if (ms < MINUTE) return units.underMinute;
  // Each unit rolls over to the next once it would round up to it (59.6 min → "1h", not "60m").
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return units.minutes(minutes);
  const hours = Math.round(ms / HOUR);
  if (hours < 24) return units.hours(hours);
  const days = Math.round(ms / DAY);
  if (days < 30) return units.days(days);
  const months = Math.round(ms / DAY / 30);
  if (months < 12) return units.months(months);
  return units.years(formatNumber(ms / DAY / 365, { maximumFractionDigits: 1 }));
}
