// The learner's language as the app shows it, and how its dates and numbers are written. Apart from
// index.svelte.ts so the catalogs can format their own numbers ("1,000 words").

import type { Lang } from '@taiwan-mandarin/shared';

export const locale = $state<{ lang: Lang; hanViet: boolean }>({ lang: 'en', hanViet: true });

/** Each language's locales for dates and numbers. English writes British dates (21 October). */
const INTL: Record<Lang, { dates: string; numbers: string }> = {
  en: { dates: 'en-GB', numbers: 'en-US' },
  vi: { dates: 'vi-VN', numbers: 'vi-VN' },
};

/** The locale for dates. */
export const intlLocale = (): string => INTL[locale.lang].dates;

/** A number as the language writes it: "1,000" / "1.000". */
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions): string =>
  n.toLocaleString(INTL[locale.lang].numbers, options);
