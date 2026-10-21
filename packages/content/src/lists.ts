// Readers for the two official Taiwan word lists.
//
// TOCFL 《華語八千詞表》 (國家華語測驗推動工作委員會, 2024-09 edition): 7,517 words on seven sheets,
//   準備一級 … 流利級. Columns: [任務領域,] 詞彙, 漢語拼音, 詞類. Pinyin is run together.
// NAER 《臺灣華語文能力基準》 三等七級詞語表 (國家教育研究院, 2025-04): 14,452 words, levels 第1級–第7級
//   with starred half-levels, situation (情境), frequencies, Zhuyin and pinyin split by syllable.

import type { Level, TopicId } from '@taiwan-mandarin/shared';
import { readXlsx } from './xlsx.ts';

export interface ListEntry {
  /** Raw headword cell. */
  word: string;
  pinyin: string;
  zhuyin?: string;
  pos: string;
  level: Level;
  topic?: TopicId;
  /** Corpus frequency from the list itself (NAER only). */
  freq?: number;
  /** Row order within the list, for stable output. */
  order: number;
}

const TOCFL_SHEETS: [prefix: string, level: Level][] = [
  ['準備級一級', 'N1'],
  ['準備級二級', 'N2'],
  ['入門級', 'L1'],
  ['基礎級', 'L2'],
  ['進階級', 'L3'],
  ['高階級', 'L4'],
  ['流利級', 'L5'],
];

/** TOCFL 任務領域 → topic. */
const TOCFL_CONTEXT: Record<string, TopicId> = {
  個人資料: 'personal',
  教育: 'education',
  旅行: 'travel',
  '房屋與家庭、環境': 'daily',
  購物: 'shopping',
  其他: 'core',
  飲食: 'food',
  '閒暇時間、娛樂': 'leisure',
  與他人的關係: 'social',
  健康及身體照護: 'body',
  工作: 'work',
  日常生活: 'daily',
};

/** NAER 情境 → topic. */
const NAER_SITUATION: Record<string, TopicId> = {
  核心詞: 'core',
  '教育、學習': 'education',
  '身體、醫療': 'body',
  '休閒、娛樂': 'leisure',
  '餐飲、烹飪': 'food',
  日常起居: 'daily',
  職業: 'work',
  '交通、旅遊': 'travel',
  個人資料: 'personal',
  '購物、商店': 'shopping',
  安全: 'safety',
  社會: 'society',
  '社交、人際': 'social',
  '情緒、態度': 'feelings',
  自然環境: 'nature',
  文化: 'culture',
  公共服務: 'public',
  科技: 'tech',
};

/**
 * NAER level → TOCFL band. The cumulative word counts line up with the correspondence table in the
 * TOCFL list's 2022 notes: 第1級 ≈ 準備一級 (≈187), 第1*級 ≈ 準備二級 (≈401), 第2*級 ≈ 入門級 (≈804),
 * 第3*級 ≈ 基礎級 (≈1,265), 第4*級 ≈ 進階級 (≈2,685), 第5級 ≈ 高階級, 第6級 ≈ 流利級, 第7級 = 精通級.
 */
const NAER_LEVEL: Record<string, Level> = {
  '1': 'N1',
  '1*': 'N2',
  '2': 'L1',
  '2*': 'L1',
  '3': 'L2',
  '3*': 'L2',
  '4': 'L3',
  '4*': 'L3',
  '5': 'L4',
  '6': 'L5',
  '7': 'L6',
};

/** Typos in the TOCFL pinyin column. */
const TOCFL_PINYIN_FIXES: Record<string, string> = {
  供給: 'gōngjǐ',
};

export function readTocfl(path: string): ListEntry[] {
  const sheets = readXlsx(path);
  const entries: ListEntry[] = [];
  for (const [prefix, level] of TOCFL_SHEETS) {
    const rows = [...sheets.entries()].find(([name]) => name.startsWith(prefix))?.[1];
    if (!rows) throw new Error(`TOCFL sheet ${prefix} not found`);
    const header = rows[0] ?? [];
    const col = (label: string) => header.findIndex((h) => h.startsWith(label));
    const [cContext, cWord, cPinyin, cPos] = [
      col('任務領域'),
      col('詞彙'),
      col('漢語拼音'),
      col('詞類'),
    ];
    for (const row of rows.slice(1)) {
      const word = row[cWord]?.trim() ?? '';
      if (!word) continue;
      entries.push({
        word,
        pinyin: TOCFL_PINYIN_FIXES[word] ?? row[cPinyin] ?? '',
        pos: (row[cPos] ?? '').replace(/\s+/g, ''),
        level,
        topic: cContext >= 0 ? TOCFL_CONTEXT[row[cContext]?.trim() ?? ''] : undefined,
        order: entries.length,
      });
    }
  }
  return entries;
}

export function readNaer(path: string): ListEntry[] {
  const rows = [...readXlsx(path).values()][0] ?? [];
  const header = rows[0] ?? [];
  const col = (label: string) => header.indexOf(label);
  const [cWord, cLevel, cSituation, cFreq, cZhuyin, cPinyin] = [
    col('word'),
    col('ji'),
    col('situation'),
    col('wfreq'),
    col('bopomofo'),
    col('pinyin'),
  ];
  return rows.slice(1).flatMap((row, order) => {
    // Polyphones are numbered: 本1 (běn), 本2 …
    const word = (row[cWord] ?? '').trim().replace(/\d+$/, '');
    const rawLevel = /第(\d\*?)級/.exec(row[cLevel] ?? '')?.[1] ?? '';
    const level = NAER_LEVEL[rawLevel];
    if (!word || !level) return [];
    return [
      {
        word,
        pinyin: row[cPinyin] ?? '',
        zhuyin: row[cZhuyin] ?? '',
        pos: '',
        level,
        topic: NAER_SITUATION[row[cSituation]?.trim() ?? ''],
        freq: Number(row[cFreq]) || 0,
        order,
      },
    ];
  });
}

/** NAER 通用詞頻表: word → overall frequency rank (1 = most frequent). */
export function readFrequencyRanks(path: string): Map<string, number> {
  const rows = [...readXlsx(path).values()][0] ?? [];
  const ranks = new Map<string, number>();
  for (const row of rows.slice(1)) {
    const word = row[1]?.trim();
    const rank = Number(row[0]);
    if (word && rank && !ranks.has(word)) ranks.set(word, rank);
  }
  return ranks;
}
