// Merges the TOCFL and NAER lists, the curated starter words and CC-CEDICT into study-path words.

import {
  CURATED,
  type CuratedWord,
  LEVEL_IDS,
  levelIndex,
  splitSyllables,
  toZhuyin,
  type Lang,
  type Level,
  type TopicId,
  type Word,
} from '@taiwan-mandarin/shared';
import { checkText, MAINLAND_TERMS } from '@taiwan-mandarin/shared/taiwan-standard';
import { toneless, type CedictEntry } from './cedict.ts';
import { parseForms, readForm, type Form } from './headword.ts';
import type { ListEntry } from './lists.ts';
import type { PinyinContext } from './pinyin.ts';

interface Candidate {
  forms: { text: string; pinyin: string; form: Form }[];
  level: Level;
  src: Word['src'];
  pos?: string;
  topic?: TopicId;
  order: number;
}

export interface LexiconReport {
  unreadable: string[];
  readingDiffs: string[];
  noGloss: number;
  bySource: Record<Word['src'], number>;
}

/** Taiwan-standard text: Taiwan character forms and wording (臺, 裡, 冷氣…). */
const isTaiwanForm = (text: string) =>
  checkText({ text, where: 'lexicon' }).length === 0 && !Object.hasOwn(MAINLAND_TERMS, text);

/** The MOE standard writes 臺 for stage / platform / station words the lists spell with 台. */
const withTai = (forms: Form[]): Form[] =>
  forms.flatMap((form) =>
    form.text.includes('台') && !forms.some((f) => f.text === form.text.replaceAll('台', '臺'))
      ? [{ ...form, text: form.text.replaceAll('台', '臺') }, form]
      : [form],
  );

/** Ranks written forms to choose the headword. Higher is better. */
function formScore(form: Form): number {
  let score = -10 * form.order;
  if (!isTaiwanForm(form.text)) score -= 100;
  if (form.text.includes('台')) score -= 50;
  // Taiwan rarely uses erhua; prefer 一會 over 一會兒 when both are listed.
  if (form.text.length > 1 && form.text.endsWith('兒')) score -= 20;
  // 桌(子) → 桌子 (a bare 桌 is a bound form); 小孩(子) → 小孩.
  if (form.optional === 'full' && form.baseLength === 1) score += 5;
  if (form.optional === 'base' && form.baseLength > 1) score += 5;
  return score;
}

function readEntry(
  entry: ListEntry,
  ctx: PinyinContext,
  unreadable: string[],
): Candidate | undefined {
  const forms = withTai(parseForms(entry.word)).flatMap((form) => {
    const pinyin = readForm(form, entry, ctx);
    return pinyin ? [{ text: form.text, pinyin, form }] : [];
  });
  if (forms.length === 0) {
    unreadable.push(`${entry.word} [${entry.pinyin}${entry.zhuyin ? ' | ' + entry.zhuyin : ''}]`);
    return undefined;
  }
  forms.sort((a, b) => formScore(b.form) - formScore(a.form));
  return {
    forms,
    level: entry.level,
    src: entry.zhuyin === undefined ? 'tocfl' : 'tbcl',
    pos: entry.pos || undefined,
    topic: entry.topic,
    order: entry.order,
  };
}

/** Senses that are pointers rather than meanings, kept out of flashcard glosses. */
const GLOSS_SKIP: Record<Lang, RegExp> = {
  en: /^(surname |variant of |old variant of |used in |see |abbr\. for |also written |\(old\) )/i,
  // CVDICT's wording of the same: "họ Tán", "biến thể (cũ) của", "dùng trong", "xem (thêm)",
  // "viết tắt của", "cũng viết là", "(cũ)". A surname is "họ" + a capitalized name ("họ hàng" is a
  // word: relatives).
  vi: /^(họ (hai chữ |kép )?\p{Lu}|biến thể (cũ |cổ )?(của|cho) |\(cổ\) biến thể|chữ cổ của |dùng trong |xem |viết tắt (của|cho) |cũng (được )?viết |\((cũ|cổ)\) |\(cách (nói|gọi) cũ\))/iu,
};

/**
 * Character variants that differ between Taiwan's standard forms and CC-CEDICT's Traditional
 * headwords (汙/污, 溼/濕, 臺/台…). Lookups fold both sides to the first form.
 */
const VARIANTS = [
  '臺台', '汙污', '溼濕', '裡裏', '鍊鏈', '痠酸', '姊姐', '著着', '線綫', '峰峯', '群羣', '啟啓',
  '眾衆', '為爲', '偽僞', '真眞', '說説', '戶户', '告吿', '教敎', '查査', '雞鷄', '夠够', '床牀',
  '衛衞', '鉤鈎', '撐撑', '綠緑', '銳鋭', '脫脱', '稅税', '閱閲', '蔥葱', '冊册', '嘆歎', '黏粘',
  '佈布', '證証', '蹟跡', '祕秘',
]; // prettier-ignore
const FOLD = new Map(
  VARIANTS.flatMap((pair) => [...pair].map((c) => [c, pair.charAt(0)] as const)),
);
export const fold = (text: string) => [...text].map((c) => FOLD.get(c) ?? c).join('');

/** The CC-CEDICT entries a study word's gloss comes from: its reading, common words first. */
function pickEntries(
  hanzi: string,
  pinyin: string,
  dict: ReadonlyMap<string, CedictEntry[]>,
): CedictEntry[] {
  const entries = dict.get(fold(hanzi)) ?? [];
  const sound = toneless(pinyin);
  const same = (e: CedictEntry) =>
    toneless(e.pinyin) === sound ||
    (e.mainlandPinyin !== undefined && toneless(e.mainlandPinyin) === sound);
  const exact = entries.filter((e) => e.pinyin === pinyin || e.mainlandPinyin === pinyin);
  let matching = exact.length ? exact : entries.filter(same);
  // Taiwan reading CC-CEDICT doesn't list (血 xiě, 熟 shóu, 模樣 móyàng): fine when the headword
  // has only one common reading anyway.
  const common = entries.filter((e) => !e.proper);
  if (matching.length === 0 && new Set(common.map((e) => toneless(e.pinyin))).size === 1)
    matching = common;
  const nonProper = matching.filter((e) => !e.proper);
  return (nonProper.length ? nonProper : matching).slice(0, 2);
}

/** The gloss in one language from the chosen entries' definitions, pointers ("see …") left out. */
function glossFrom(entries: readonly CedictEntry[], lang: Lang): string {
  const all = entries.flatMap((e) => (lang === 'vi' ? (e.vi ?? []) : e.defs));
  const defs = all.filter((d) => !GLOSS_SKIP[lang].test(d));
  return studyGloss(defs.length ? defs : all, lang);
}

export function gloss(
  hanzi: string,
  pinyin: string,
  dict: ReadonlyMap<string, CedictEntry[]>,
): { en: string; vi?: string; cl?: string } | undefined {
  const chosen = pickEntries(hanzi, pinyin, dict);
  const en = glossFrom(chosen, 'en');
  if (!en) return undefined;
  const vi = glossFrom(chosen, 'vi');
  const cl = [...new Set(chosen.flatMap((e) => e.classifiers))].join(' ');
  return { en, vi: vi || undefined, cl: cl || undefined };
}

const GENERAL_MEASURE_WORD: Record<Lang, [RegExp, string]> = {
  en: [
    /^\(classifier used before a noun that has no specific classifier\)$/,
    'general measure word',
  ],
  vi: [/^\(lượng từ dùng trước danh từ không có lượng từ cụ thể\)$/, 'lượng từ chung'],
};
const NOT_A_SENSE: Record<Lang, RegExp> = {
  en: /^(also pr\.|also written|see also|abbr\. for)/i,
  vi: /^(cũng (đọc|phát âm)|cũng (được )?viết|xem thêm|viết tắt)/i,
};
/**
 * Senses in parentheses from end to end: notes ("(completed action marker)") and labelled senses
 * ("(literary) to suffer (a misfortune)"), which flashcards do without. Vietnamese puts English's
 * "(of sb or sth) to be at" as "(ai đó hoặc cái gì đó) ở (vị trí)": a meaning, not a note.
 */
const NOTE_ONLY: Record<Lang, RegExp> = {
  en: /^\(.*\)$/,
  vi: /^\((?!(ai|cái|vật|người|của|về|đối với) ).*\)$/u,
};
/** Vietnamese takes more letters to say the same, so its glosses get a little more room. */
const GLOSS_LENGTH: Record<Lang, { sense: number; total: number }> = {
  en: { sense: 48, total: 90 },
  vi: { sense: 56, total: 100 },
};

/**
 * A flashcard-sized gloss: the first short senses, about 90 characters at most (100 in
 * Vietnamese). CC-CEDICT's long usage notes stay in the dictionary.
 */
export function studyGloss(defs: readonly string[], lang: Lang = 'en'): string {
  const [general, generalLabel] = GENERAL_MEASURE_WORD[lang];
  const { sense: senseLength, total } = GLOSS_LENGTH[lang];
  const senses = [
    ...new Set(
      defs
        .flatMap((d) => d.split(/; (?![^(]*\))/))
        .map((d) => d.trim().replace(general, generalLabel)),
    ),
  ].filter((d) => d && !NOT_A_SENSE[lang].test(d));
  const short = senses.filter((d) => d.length <= senseLength && !NOTE_ONLY[lang].test(d));
  const picked: string[] = [];
  for (const sense of short.length ? short : senses) {
    if (picked.length >= 4 || [...picked, sense].join('; ').length > total) break;
    picked.push(sense);
  }
  if (picked.length === 0 && senses[0])
    return senses[0].slice(0, total - 2).replace(/\s+\S*$/, '') + '…';
  return picked.join('; ');
}

/** A word's Vietnamese meaning and note: the curated ones, else CVDICT's gloss. */
function vietnamese(
  curated: CuratedWord | undefined,
  cvdict: string | undefined,
): Pick<Word, 'vi' | 'viSource' | 'twVi'> {
  if (curated?.vi) return { vi: curated.vi, viSource: 'curated', twVi: curated.twVi };
  return cvdict ? { vi: cvdict, viSource: 'cvdict' } : {};
}

export function buildLexicon(input: {
  tocfl: readonly ListEntry[];
  naer: readonly ListEntry[];
  cedict: readonly CedictEntry[];
  frequency: ReadonlyMap<string, number>;
  ctx: PinyinContext;
}): { words: Word[]; legacyIds: Record<string, string>; report: LexiconReport } {
  const unreadable: string[] = [];
  const readingDiffs: string[] = [];
  const dict = new Map<string, CedictEntry[]>();
  for (const e of input.cedict) {
    const key = fold(e.trad);
    const list = dict.get(key);
    if (list) list.push(e);
    else dict.set(key, [e]);
  }

  const naer = input.naer.flatMap((e) => readEntry(e, input.ctx, unreadable) ?? []);
  // Every NAER written form → candidates, for matching TOCFL words.
  const naerByForm = new Map<string, Candidate[]>();
  for (const c of naer) {
    for (const f of c.forms) naerByForm.set(f.text, [...(naerByForm.get(f.text) ?? []), c]);
  }

  const matched = new Set<Candidate>();
  const merged: Candidate[] = [];
  for (const entry of input.tocfl) {
    const word = readEntry(entry, input.ctx, unreadable);
    if (!word) continue;
    const head = word.forms[0];
    if (!head) continue;
    // Same word in the NAER list: same written form and same syllables (tones may differ).
    // Exact reading first; for longer words also accept a tone difference. Single characters
    // that differ only in tone are different words (好 hǎo / hào, 種 zhǒng / zhòng).
    const pairs = word.forms
      .flatMap((f) => (naerByForm.get(f.text) ?? []).map((c) => ({ f, c })))
      .filter(({ c }) => !matched.has(c));
    const twin =
      pairs.find(({ f, c }) => c.forms.some((g) => g.text === f.text && g.pinyin === f.pinyin)) ??
      pairs.find(
        ({ f, c }) =>
          [...f.text].length > 1 &&
          c.forms.some((g) => g.text === f.text && toneless(g.pinyin) === toneless(f.pinyin)),
      );
    if (twin) {
      matched.add(twin.c);
      const naerReading = twin.c.forms.find((g) => g.text === head.text)?.pinyin;
      // NAER's Zhuyin is syllable-split and newer; use its tones when the syllables agree.
      if (
        naerReading &&
        naerReading !== head.pinyin &&
        [...head.text].length > 1 &&
        toneless(naerReading) === toneless(head.pinyin)
      ) {
        readingDiffs.push(`${head.text}: TOCFL ${head.pinyin} → NAER ${naerReading}`);
        head.pinyin = naerReading;
      }
      word.topic =
        twin.c.topic && twin.c.topic !== 'core' ? twin.c.topic : (word.topic ?? twin.c.topic);
      const extra = twin.c.forms.filter((g) => !word.forms.some((f) => f.text === g.text));
      word.forms.push(...extra);
    }
    merged.push(word);
  }
  // NAER-only words. A longer word whose headword is already in TOCFL with other syllables is a
  // reading variant (NAER's 為什麼 wèishénmo vs MOE wèishénme), not a new word.
  const tocflHeads = new Set(merged.map((c) => c.forms[0]?.text));
  for (const c of naer) {
    const head = c.forms[0]?.text ?? '';
    if (matched.has(c) || ([...head].length > 1 && tocflHeads.has(head))) continue;
    merged.push(c);
  }

  // Curated starter words: their reading, gloss and notes win. Words missing from both lists join
  // the path at the level of their hardest component.
  const curatedByHanzi = new Map(CURATED.map((c) => [c.hanzi, c]));

  const levelOf = new Map<string, Level>();
  for (const c of merged) {
    for (const f of c.forms) {
      const known = levelOf.get(f.text);
      if (!known || levelIndex(c.level) < levelIndex(known)) levelOf.set(f.text, c.level);
    }
  }

  const words: Word[] = [];
  const seenHead = new Set<string>();
  const curatedUsed = new Set<(typeof CURATED)[number]>();
  for (const c of merged) {
    const head = c.forms[0];
    if (!head) continue;
    const key = `${head.text}|${head.pinyin}`;
    if (seenHead.has(key)) continue; // listed twice (e.g. as both noun and measure word)
    seenHead.add(key);
    const curated = curatedByHanzi.get(head.text);
    const useCurated =
      curated !== undefined &&
      !curatedUsed.has(curated) &&
      (curated.pinyin === head.pinyin ||
        ([...head.text].length > 1 && toneless(curated.pinyin) === toneless(head.pinyin)));
    if (useCurated) curatedUsed.add(curated);
    const pinyin = useCurated ? curated.pinyin : head.pinyin;
    const g = [head.text, ...c.forms.slice(1).map((f) => f.text)].reduce<ReturnType<typeof gloss>>(
      (found, text) => found ?? gloss(text, pinyin, dict),
      undefined,
    );
    const variants = [...new Set(c.forms.slice(1).map((f) => f.text))].filter(
      (t) => t !== head.text,
    );
    words.push({
      id: head.text,
      hanzi: head.text,
      pinyin,
      en: useCurated ? curated.en : (g?.en ?? ''),
      ...vietnamese(useCurated ? curated : undefined, g?.vi),
      level: c.level,
      src: c.src,
      rank: 0,
      topic: c.topic ?? 'core',
      pos: c.pos,
      variants: variants.length ? variants : undefined,
      cl: g?.cl,
      glossSource: useCurated ? 'curated' : g ? 'cedict' : 'none',
      ...(useCurated
        ? {
            tw: curated.tw,
            mainland: curated.mainland,
            readingUnverified: curated.readingUnverified,
          }
        : {}),
      // Mainland words the NAER list includes for recognition (地鐵, 自行車): say what Taiwan uses.
      ...(Object.hasOwn(MAINLAND_TERMS, head.text) && !useCurated
        ? {
            tw: `Mainland usage. Taiwan says ${MAINLAND_TERMS[head.text]}.`,
            twVi: `Cách nói ở Trung Quốc đại lục. Ở Đài Loan nói ${MAINLAND_TERMS[head.text]}.`,
          }
        : {}),
    });
  }

  for (const curated of CURATED) {
    if (curatedUsed.has(curated)) continue;
    // Not in either list (你好嗎, 牛肉麵, 悠遊卡…): its own level, else the hardest listed part.
    const parts = segmentKnown(curated.hanzi, levelOf);
    const level =
      curated.level ??
      parts.reduce<Level>((max, part) => {
        const l = levelOf.get(part);
        return l && levelIndex(l) > levelIndex(max) ? l : max;
      }, 'N1');
    words.push({
      id: curated.hanzi,
      hanzi: curated.hanzi,
      pinyin: curated.pinyin,
      en: curated.en,
      ...vietnamese(curated, gloss(curated.hanzi, curated.pinyin, dict)?.vi),
      level,
      src: 'curated',
      rank: 0,
      topic: 'core',
      glossSource: 'curated',
      tw: curated.tw,
      mainland: curated.mainland,
      readingUnverified: curated.readingUnverified,
    });
  }

  // Same characters, several readings (得 dé / de / děi): "hanzi~reading" ids.
  const count = new Map<string, number>();
  for (const w of words) count.set(w.hanzi, (count.get(w.hanzi) ?? 0) + 1);
  for (const w of words) {
    if ((count.get(w.hanzi) ?? 0) > 1) w.id = `${w.hanzi}~${w.pinyin.replace(/ /g, '')}`;
  }

  // Study order: within a level, TOCFL words before supplementary ones, then by corpus frequency.
  const freq = (w: Word) =>
    Math.min(
      input.frequency.get(w.hanzi) ?? Infinity,
      ...(w.variants ?? []).map((v) => input.frequency.get(v) ?? Infinity),
    );
  const tier = (w: Word) => (Object.hasOwn(MAINLAND_TERMS, w.hanzi) ? 2 : w.src === 'tbcl' ? 1 : 0);
  for (const level of LEVEL_IDS) {
    words
      .filter((w) => w.level === level)
      .sort((a, b) => tier(a) - tier(b) || freq(a) - freq(b) || a.hanzi.localeCompare(b.hanzi))
      .forEach((w, i) => (w.rank = i));
  }
  words.sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.rank - b.rank);

  for (const w of words) {
    if (splitSyllables(w.pinyin).length !== [...w.hanzi].length)
      throw new Error(`Misaligned reading ${w.hanzi} ${w.pinyin}`);
    toZhuyin(w.pinyin);
  }

  const legacyIds: Record<string, string> = {};
  for (const curated of CURATED) {
    const word = words.find((w) => w.hanzi === curated.hanzi && w.pinyin === curated.pinyin);
    if (word) legacyIds[curated.legacyId] = word.id;
  }

  const bySource = { tocfl: 0, tbcl: 0, curated: 0 };
  for (const w of words) bySource[w.src]++;
  return {
    words,
    legacyIds,
    report: { unreadable, readingDiffs, noGloss: words.filter((w) => !w.en).length, bySource },
  };
}

/** Greedy longest-match split of `text` into forms present in `known`. */
function segmentKnown(text: string, known: ReadonlyMap<string, unknown>): string[] {
  const chars = [...text];
  const parts: string[] = [];
  for (let i = 0; i < chars.length;) {
    let len = Math.min(8, chars.length - i);
    while (len > 1 && !known.has(chars.slice(i, i + len).join(''))) len--;
    parts.push(chars.slice(i, i + len).join(''));
    i += len;
  }
  return parts;
}
