// A word's form for a number, by each language's own rules (Intl.PluralRules): English 1 word,
// 2 words; Russian 1 слово, 2 слова, 5 слов, 1,5 слова.

import type { Lang } from '@taiwan-mandarin/shared';

/** A form for each plural category the language uses; `other` stands in for the rest. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const rules = new Map<Lang, Intl.PluralRules>();

export function plural(lang: Lang, n: number, forms: PluralForms): string {
  let rule = rules.get(lang);
  if (!rule) rules.set(lang, (rule = new Intl.PluralRules(lang)));
  return forms[rule.select(n)] ?? forms.other;
}
