// The reminder's words, in 墨's voice: a little ink, a little Chinese, never a scolding. A few
// lines each, taken in turn by the day so the same one doesn't come every evening. 墨 is an
// "it", and in Russian speaks in the present tense, like the app (see i18n/ru.ts).

import { dayNumber, type Lang } from '@taiwan-mandarin/shared';

type Some<T> = readonly [T, ...T[]];

interface Lines {
  title: string;
  due: Some<(n: number) => string>;
  /** Nothing due: the streak (and new words) are waiting. */
  idle: Some<string>;
}

/** The line for day number `n`, in turn. */
const nth = <T>(lines: Some<T>, n: number): T => lines[n % lines.length] ?? lines[0];

const rules = new Map<string, Intl.PluralRules>();
const form = (lang: string, n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>>) => {
  let rule = rules.get(lang);
  if (!rule) rules.set(lang, (rule = new Intl.PluralRules(lang)));
  return forms[rule.select(n)] ?? forms.other ?? '';
};

const en = (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`;
const ru = (n: number) =>
  `${n} ${form('ru', n, { one: 'слово', few: 'слова', many: 'слов', other: 'слова' })}`;

const LINES: Record<Lang, Lines> = {
  en: {
    title: '墨 · 練習時間',
    due: [
      (n) =>
        `墨 has ground fresh ink 🖌️ ${en(n)} ${n === 1 ? 'is' : 'are'} waiting for you. 加油！`,
      (n) => `Tea's poured, the brush is wet 🍵 ${en(n)} to review today.`,
      (n) => `${en(n)} would love a visit today. 墨 is holding the brush ✍️`,
    ],
    idle: [
      'Nothing to review — a quiet page for a few new words? 墨 is waiting 🖌️',
      "Keep today's ink flowing: one short session and the streak grows 🌱",
      '墨 has the inkstone ready. A few minutes of 華語 today? 加油！',
    ],
  },
  ru: {
    title: '墨 · 練習時間',
    due: [
      (n) => `У 墨 свежая тушь 🖌️ На повторение: ${ru(n)}. 加油！`,
      (n) => `Чай налит, кисть готова 🍵 Сегодня повторить: ${ru(n)}.`,
      (n) => `Загляни сегодня — на повторение: ${ru(n)}. 墨 держит кисть ✍️`,
    ],
    idle: [
      'Повторять нечего — может, пара новых слов? 墨 ждёт 🖌️',
      'Пусть тушь не высыхает: короткое занятие, и серия растёт 🌱',
      'Тушечница у 墨 готова. Пара минут 華語 сегодня? 加油！',
    ],
  },
  vi: {
    title: '墨 · 練習時間',
    due: [
      (n) => `墨 vừa mài mực mới 🖌️ ${n} từ đang chờ bạn. 加油！`,
      (n) => `Trà đã rót, bút đã sẵn 🍵 Hôm nay có ${n} từ cần ôn.`,
      (n) => `${n} từ muốn gặp bạn hôm nay. 墨 đang cầm bút ✍️`,
    ],
    idle: [
      'Không có gì để ôn — học vài từ mới nhé? 墨 đang chờ 🖌️',
      'Giữ mực luôn chảy: một buổi ngắn thôi là chuỗi ngày lại dài thêm 🌱',
      '墨 đã chuẩn bị nghiên mực. Vài phút 華語 hôm nay nhé? 加油！',
    ],
  },
};

/** The reminder for `day` ("YYYY-MM-DD") with `due` cards due. */
export function reminderText(
  lang: Lang,
  due: number,
  day: string,
): { title: string; body: string } {
  const lines = LINES[lang] ?? LINES.en;
  const turn = dayNumber(day);
  const body = due > 0 ? nth(lines.due, turn)(due) : nth(lines.idle, turn);
  return { title: lines.title, body };
}
