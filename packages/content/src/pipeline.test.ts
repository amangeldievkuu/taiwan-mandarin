import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dictShardOf, type DictShard, type Reader, type Word } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { cleanDefinition, normalizePinyin, parseCedictLine, syllableInventory } from './cedict.ts';
import { pickExamples } from './examples.ts';
import { citationTones, parseForms, pinyinVariants, readForm, zhuyinVariants } from './headword.ts';
import { alignPinyin, type PinyinContext } from './pinyin.ts';
import { buildDictionary, taiwanCharReadings } from './dictionary.ts';
import { fileReader, fileWord } from './files.ts';
import { contentLanguage, type ContentLanguage } from './languages.ts';
import { readReaders } from './readers.ts';
import {
  attachTranslations,
  CVDICT_RULES,
  isTaiwanReadingNote,
  parseCvdictLine,
} from './cvdict.ts';
import { charHanViet, hanViet, type HanVietTable } from './hanviet.ts';
import { fold, gloss, studyGloss } from './lexicon.ts';

const LINES = [
  '垃圾 垃圾 [la1 ji1] /trash/refuse/garbage/Taiwan pr. [le4 se4]/',
  '桌子 桌子 [zhuo1 zi5] /table/desk/CL:張|张[zhang1],套[tao4]/',
  '這兒 这儿 [zhe4 r5] /here/',
  '這裡 这里 [zhe4 li3] /here/',
  '爸爸 爸爸 [ba4 ba5] /father/',
  '一會兒 一会儿 [yi1 hui4 r5] /a moment/',
  '點 点 [dian3] /point/',
  '有 有 [you3] /to have/',
  '座右銘 座右铭 [zuo4 you4 ming2] /motto/',
  '女兒 女儿 [nu:3 er2] /daughter/',
  '偶爾 偶尔 [ou3 er3] /occasionally/',
  '和 和 [He2] /surname He/',
];
const entries = LINES.flatMap((l) => parseCedictLine(l) ?? []);
const readings = new Map<string, Set<string>>();
for (const e of entries) {
  const chars = [...e.trad];
  e.pinyin.split(' ').forEach((s, i) => {
    const c = chars[i] ?? '';
    readings.set(c, new Set([...(readings.get(c) ?? []), s.replace(/\d/, '')]));
  });
}
const ctx: PinyinContext = { inventory: syllableInventory(entries), readings };
for (const s of ['wo', 'ni', 'hao', 'yi', 'dian', 'hui', 'zuo', 'you', 'ming', 'ou', 'er'])
  (ctx.inventory as Set<string>).add(s);

describe('CC-CEDICT parsing', () => {
  it('applies the Taiwan reading and keeps the Mainland one', () => {
    expect(entries[0]).toMatchObject({
      trad: '垃圾',
      pinyin: 'le4 se4',
      mainlandPinyin: 'la1 ji1',
    });
    expect(entries[0]?.defs).toEqual(['trash', 'refuse', 'garbage']);
  });

  it('extracts measure words in Traditional characters', () => {
    expect(entries[1]?.classifiers).toEqual(['張', '套']);
  });

  it('flags names', () => {
    expect(entries.at(-1)?.proper).toBe(true);
  });

  it('normalizes readings', () => {
    expect(normalizePinyin('Xia4hai2')).toBe('xia4 hai2');
    expect(normalizePinyin('nu:3 er2')).toBe('nü3 er2');
  });

  it('rewrites cross-references to Traditional with tone marks', () => {
    expect(cleanDefinition('see 什麼|什么[shen2 me5]')).toBe('see 什麼 (shénme)');
    expect(cleanDefinition('used for 師傅|师傅 (in Taiwan)')).toBe('used for 師傅 (in Taiwan)');
    expect(cleanDefinition('also pr. [shui2]')).toBe('also pr. shuí');
  });

  it('writes readings inside definitions as words', () => {
    expect(cleanDefinition('see 西安[Xi1 an1]')).toBe("see 西安 (Xī'ān)");
    expect(cleanDefinition('see 馬英九[Ma3 Ying1 jiu3]')).toBe('see 馬英九 (Mǎ Yīngjiǔ)');
    expect(cleanDefinition('see 一不做，二不休[yi1 bu4 zuo4 , er4 bu4 xiu1]')).toBe(
      'see 一不做，二不休 (yībùzuò, èrbùxiū)',
    );
  });
});

describe('example sentences', () => {
  const word = (hanzi: string, pinyin: string, rank: number): Word => ({
    id: hanzi,
    hanzi,
    pinyin,
    en: hanzi,
    level: 'N1',
    src: 'tocfl',
    rank,
    topic: 'core',
    glossSource: 'cedict',
  });
  const words = [
    word('我', 'wo3', 1),
    word('今天', 'jin1 tian1', 2),
    word('買', 'mai3', 3),
    word('的', 'de5', 4),
    word('東西', 'dong1 xi5', 5),
  ];
  const shards: DictShard[] = Array.from({ length: 128 }, () => ({}));
  const { examples, annotate, wordLengths } = pickExamples(
    [{ id: '1', zh: '我今天買的東西。', en: 'What I bought today.', native: true }],
    words,
    shards,
    4,
  );

  it('keeps word boundaries so readings can be spaced by word', () => {
    expect(examples.get('今天')?.[0]).toMatchObject({
      pinyin: 'wo3 jin1 tian1 mai3 de5 dong1 xi5',
      wordLengths: [1, 2, 1, 1, 2],
    });
    expect(annotate('今天我買東西')).toEqual({
      pinyin: 'jin1 tian1 wo3 mai3 dong1 xi5',
      wordLengths: [2, 1, 1, 2],
    });
    expect(wordLengths('我買東西？')).toEqual([1, 1, 2]);
  });

  it('skips sentences with a word it cannot read', () => {
    expect(annotate('我買蘋果')).toBeUndefined();
  });
});

describe('headword cells', () => {
  it('splits variants and drops Zhuyin annotations', () => {
    expect(parseForms('爸爸/爸').map((f) => f.text)).toEqual(['爸爸', '爸']);
    expect(parseForms('名字(˙ㄗ)').map((f) => f.text)).toEqual(['名字']);
    expect(parseForms('部分(˙ㄈㄣ)/部份(˙ㄈㄣ)').map((f) => f.text)).toEqual(['部分', '部份']);
  });

  it('expands optional parts', () => {
    expect(parseForms('小孩(子)').map((f) => [f.text, f.optional])).toEqual([
      ['小孩', 'base'],
      ['小孩子', 'full'],
    ]);
    expect(pinyinVariants('xiăohái(zi) ')).toEqual(['xiăohái', 'xiăoháizi']);
  });

  it('reads Zhuyin cells, including erhua', () => {
    expect(zhuyinVariants('ㄅㄚˋ ˙ㄅㄚ / ㄅㄚˋ')).toEqual([['ba4', 'ba5'], ['ba4']]);
    expect(zhuyinVariants('ㄉㄞˋ ㄏㄨㄟˇㄦ')).toEqual([['dai4', 'hui3', 'er5']]);
  });

  it('restores citation tones for 一 and 不', () => {
    expect(citationTones('一點', 'yi4 dian3')).toBe('yi1 dian3');
    expect(citationTones('一塊', 'yi2 kuai4')).toBe('yi1 kuai4');
    expect(citationTones('不要', 'bu2 yao4')).toBe('bu4 yao4');
    expect(citationTones('一點兒', 'yi1 dian3 er1')).toBe('yi1 dian3 er5');
  });

  it('picks the reading whose syllables fit the characters', () => {
    const [here, colloquial] = parseForms('這裡/這兒');
    const cells = { pinyin: 'zhèlĭ/zhèr ' };
    if (!here || !colloquial) throw new Error('expected two forms');
    expect(readForm(here, cells, ctx)).toBe('zhe4 li3');
    expect(readForm(colloquial, cells, ctx)).toBe('zhe4 er5');
  });
});

describe('alignPinyin', () => {
  const align = (text: string, hanzi: string) => alignPinyin(text, hanzi, ctx)?.pinyin;

  it('splits run-together pinyin', () => {
    expect(align('zuòyòumíng', '座右銘')).toBe('zuo4 you4 ming2');
    expect(align('bàba', '爸爸')).toBe('ba4 ba5');
  });

  it('respects spaces and apostrophes', () => {
    expect(align('ǒu ěr', '偶爾')).toBe('ou3 er3');
    expect(align("ǒu'ěr", '偶爾')).toBe('ou3 er3');
  });

  it('turns erhua before 兒 into a separate syllable', () => {
    expect(align('yīhuĭr', '一會兒')).toBe('yi1 hui3 er5');
  });

  it('gives up when the syllables cannot match the characters', () => {
    expect(align('nǐ', '你好')).toBeUndefined();
  });
});

describe('Taiwan dictionary readings', () => {
  it('fixes Mainland character readings', () => {
    expect(taiwanCharReadings('學期', 'xue2 qi1')).toBe('xue2 qi2');
    expect(taiwanCharReadings('危機', 'wei1 ji1')).toBe('wei2 ji1');
    expect(taiwanCharReadings('期待', 'qi2 dai4')).toBe('qi2 dai4');
  });
});

describe('studyGloss', () => {
  it('keeps the first short senses', () => {
    expect(
      studyGloss([
        "of; ~'s (possessive particle); (used after an attribute when it modifies a noun); (used at the end of a declarative sentence for emphasis)",
      ]),
    ).toBe("of; ~'s (possessive particle)");
    expect(studyGloss(['trash', 'refuse', 'garbage', '(coll.) of poor quality'])).toBe(
      'trash; refuse; garbage; (coll.) of poor quality',
    );
  });

  it('shortens a single long sense', () => {
    expect(studyGloss(['a'.repeat(30) + ' ' + 'b'.repeat(80)])).toMatch(/…$/);
  });
});

describe('CVDICT (Vietnamese)', () => {
  const cvdictOf = (lines: string[]) =>
    new Map(
      lines.flatMap((l) => {
        const parsed = parseCvdictLine(l);
        return parsed ? [parsed] : [];
      }),
    );

  it('keys lines exactly as CC-CEDICT does, case included', () => {
    expect(parseCedictLine('和 和 [He2] /surname He/')?.key).toBe('和 和 [He2]');
    expect(parseCedictLine('和 和 [he2] /and/')?.key).toBe('和 和 [he2]');
    const cedict = ['和 和 [He2] /surname He/', '和 和 [he2] /and/'].flatMap(
      (l) => parseCedictLine(l) ?? [],
    );
    const cvdict = cvdictOf(['和 和 [He2] /họ [He2]/', '和 和 [he2] /và/']);
    expect(attachTranslations(cedict, 'vi', cvdict)).toBe(2);
    expect(cedict.map((e) => e.tr?.vi)).toEqual([['họ Hé'], ['và']]);
  });

  it('drops measure words and Taiwan readings however they are worded', () => {
    expect(
      parseCvdictLine(
        '垃圾 垃圾 [la1 ji1] /rác/rác thải/(khẩu ngữ) chất lượng kém/Tiếng Đài Loan đọc là [le4 se4]/',
      )?.[1],
    ).toEqual(['rác', 'rác thải', '(khẩu ngữ) chất lượng kém']);
    expect(parseCvdictLine('國家 国家 [guo2 jia1] /quốc gia; dân tộc/LT:個|个[ge4]/')?.[1]).toEqual(
      ['quốc gia; dân tộc'],
    );
    for (const note of [
      'phiên âm Đài Loan [xing4]',
      'cách phát âm ở Đài Loan: [le4 se4]',
      'người Đài Loan phát âm [xing4] cho nghĩa hành vi-cử chỉ',
    ])
      expect(isTaiwanReadingNote(note)).toBe(true);
    // Taiwan senses and cross-references are meanings, not reading notes.
    expect(isTaiwanReadingNote('(Đài Loan) xe tay ga')).toBe(false);
    expect(isTaiwanReadingNote('(Đài Loan) như 機車|机车[ji1 che1]')).toBe(false);
  });

  it('rewrites cross-references like CC-CEDICT', () => {
    expect(parseCvdictLine('台 台 [tai2] /biến thể của 臺|台[tai2]/')?.[1]).toEqual([
      'biến thể của 臺 (tái)',
    ]);
  });

  it('glosses from the same entries as English, pointers and labelled notes left out', () => {
    const cedict = [
      '行 行 [hang2] /row; line/profession/',
      '行 行 [xing2] /to walk; to go/capable/',
    ].flatMap((l) => parseCedictLine(l) ?? []);
    const cvdict = cvdictOf([
      '行 行 [hang2] /hàng; dòng/nghề/',
      '行 行 [xing2] /đi; đến/có khả năng/',
    ]);
    attachTranslations(cedict, 'vi', cvdict);
    const dict = new Map([[fold('行'), cedict]]);
    expect(gloss('行', 'xing2', dict)).toMatchObject({
      en: 'to walk; to go; capable',
      tr: { vi: 'đi; đến; có khả năng' },
    });
    expect(gloss('行', 'hang2', dict)?.tr.vi).toBe('hàng; dòng; nghề');
    expect(
      studyGloss(['họ Tán', 'họ hàng', 'biến thể của 臺 (tái)', 'xem thêm 得罪'], CVDICT_RULES),
    ).toBe('họ Tán; họ hàng; biến thể của 臺 (tái)');
    expect(
      studyGloss(
        ['tồn tại; còn sống', '(ai đó hoặc cái gì đó) ở (vị trí)', '(văn học) khổ (sở)'],
        CVDICT_RULES,
      ),
    ).toBe('tồn tại; còn sống; (ai đó hoặc cái gì đó) ở (vị trí)');
  });
});

describe('Vietnamese content', () => {
  const cedict = [
    '垃圾 垃圾 [la1 ji1] /trash/garbage/Taiwan pr. [le4 se4]/',
    '臺灣 台湾 [Tai2 wan1] /Taiwan/',
    '台灣 台湾 [Tai2 wan1] /variant of 臺灣|台湾[Tai2 wan1]/',
  ].flatMap((l) => parseCedictLine(l) ?? []);
  const vi = new Map<string, string[]>([['垃圾 垃圾 [la1 ji1]', ['rác']]]);
  attachTranslations(cedict, 'vi', vi);
  const word = (hanzi: string, pinyin: string, en: string, extra: Partial<Word> = {}): Word => ({
    id: hanzi,
    hanzi,
    pinyin,
    en,
    level: 'N1',
    src: 'tocfl',
    rank: 0,
    topic: 'core',
    glossSource: 'cedict',
    ...extra,
  });
  const words = [
    word('垃圾', 'le4 se4', 'garbage', { vi: 'rác', viSource: 'cvdict' }),
    word('臺灣', 'tai2 wan1', 'Taiwan'),
    word('珍奶', 'zhen1 nai3', 'bubble tea', { glossSource: 'ai', vi: 'trà sữa', viSource: 'ai' }),
  ];
  const { shards, localized } = buildDictionary(cedict, words, [{ lang: 'vi' }]);
  const viShards = localized.vi ?? [];
  const vietnamese = [
    { lang: 'vi' as const, name: 'Vietnamese', shards: viShards, required: true },
  ];

  it('builds Vietnamese dictionary shards entry for entry, marking English stand-ins', () => {
    shards.forEach((shard, i) => {
      const viShard = viShards[i] ?? {};
      expect(Object.keys(viShard)).toEqual(Object.keys(shard));
      for (const [head, list] of Object.entries(shard))
        expect(viShard[head]?.map((e) => [e.t, e.p, e.w])).toEqual(
          list.map((e) => [e.t, e.p, e.w]),
        );
    });
    const at = (head: string) => viShards[dictShardOf(head)]?.[head];
    expect(at('垃圾')?.[0]).toMatchObject({ d: ['rác'] });
    expect(at('垃圾')?.[0]?.en).toBeUndefined();
    expect(at('臺灣')?.[0]).toMatchObject({ d: ['Taiwan'], en: 1 });
    // A study word CC-CEDICT lacks: its own Vietnamese gloss.
    expect(at('珍奶')?.[0]).toMatchObject({ d: ['trà sữa'] });
  });

  it('reads Vietnamese reader text and checks it has one translation per paragraph', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readers-'));
    const reader = {
      id: 'trash',
      level: 'N1',
      topic: 'daily',
      title: '垃圾',
      titleEn: 'Trash',
      summary: 'Trash.',
      paragraphs: ['垃圾。'],
      translation: ['Trash.'],
      vi: { title: 'Rác', summary: 'Rác.', translation: ['Rác.'] },
    };
    writeFileSync(join(dir, 'trash.json'), JSON.stringify(reader));
    const [read] = readReaders(dir, words, shards, vietnamese, 4);
    expect(read?.vi).toEqual({ title: 'Rác', summary: 'Rác.', translation: ['Rác.'] });

    writeFileSync(
      join(dir, 'trash.json'),
      JSON.stringify({ ...reader, vi: { ...reader.vi, translation: [] } }),
    );
    expect(() => readReaders(dir, words, shards, vietnamese, 4)).toThrow(/Vietnamese translation/);
  });
});

describe('Russian content', () => {
  const cedict = [
    '打 打 [da2] /dozen (loanword)/',
    '打 打 [da3] /to hit/to strike/',
    '打 打 [da3] /from/since/',
    '垃圾 垃圾 [la1 ji1] /trash/garbage/Taiwan pr. [le4 se4]/',
  ].flatMap((l) => parseCedictLine(l) ?? []);
  const word = (hanzi: string, pinyin: string, en: string, extra: Partial<Word> = {}): Word => ({
    id: hanzi,
    hanzi,
    pinyin,
    en,
    level: 'N1',
    src: 'tocfl',
    rank: 0,
    topic: 'core',
    glossSource: 'cedict',
    ...extra,
  });
  const words = [
    word('打', 'da3', 'to hit', { ru: 'бить', ruSource: 'ai' }),
    word('垃圾', 'le4 se4', 'garbage', {
      vi: 'rác',
      ru: 'мусор',
      ruSource: 'curated',
      hv: 'lạp ngập',
    }),
    word('珍奶', 'zhen1 nai3', 'bubble tea', { ru: 'бабл-ти', ruSource: 'ai' }),
  ];
  const { localized } = buildDictionary(cedict, words, [{ lang: 'ru', wordMeanings: true }]);
  const at = (head: string) => localized.ru?.[dictShardOf(head)]?.[head];

  it('gives a study word’s first entry its meaning, and keeps the rest English', () => {
    expect(at('打')?.map((e) => [e.p, e.d, e.en])).toEqual([
      ['da3', ['бить'], undefined],
      ['da3', ['from', 'since'], 1],
      ['da2', ['dozen (loanword)'], 1],
    ]);
    expect(at('垃圾')?.[0]).toMatchObject({ d: ['мусор'] });
    expect(at('珍奶')?.[0]).toMatchObject({ d: ['бабл-ти'] });
    expect(at('垃圾')?.[0]?.h).toBeUndefined();
  });

  const vi = contentLanguage('vi') as ContentLanguage;
  const ru = contentLanguage('ru') as ContentLanguage;
  const garbage = {
    ...(words[1] as Word),
    twVi: 'Ở Đài Loan đọc là lè sè.',
    twRu: 'На Тайване читается lè sè.',
    examples: [
      { zh: '垃圾', pinyin: 'le4 se4', en: 'Trash.', vi: 'Rác.', ru: 'Мусор.', source: 'ai' },
    ],
  } satisfies Word;

  it('keeps each language’s fields in its own files', () => {
    expect(fileWord(garbage, ru)).toEqual({
      ...garbage,
      vi: undefined,
      twVi: undefined,
      hv: undefined,
      examples: [{ zh: '垃圾', pinyin: 'le4 se4', en: 'Trash.', ru: 'Мусор.', source: 'ai' }],
    } as unknown as Word);
    const inVietnamese = fileWord(garbage, vi);
    expect(Object.keys(inVietnamese)).not.toContain('ru');
    expect(Object.keys(inVietnamese)).not.toContain('twRu');
    expect(inVietnamese).toMatchObject({ vi: 'rác', hv: 'lạp ngập' });
    const english = fileWord(garbage);
    for (const key of ['vi', 'ru', 'ruSource', 'twVi', 'twRu', 'hv'])
      expect(Object.keys(english)).not.toContain(key);
  });

  it('reads readers without a Russian block while it is optional', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readers-'));
    writeFileSync(
      join(dir, 'trash.json'),
      JSON.stringify({
        id: 'trash',
        level: 'N1',
        topic: 'daily',
        title: '垃圾',
        titleEn: 'Trash',
        summary: 'Trash.',
        paragraphs: ['垃圾。'],
        translation: ['Trash.'],
      }),
    );
    const russian = { lang: 'ru' as const, name: 'Russian', shards: [], required: false };
    const [read] = readReaders(dir, words, [], [russian], 4);
    expect(read?.ru).toBeUndefined();
    expect(() => readReaders(dir, words, [], [{ ...russian, required: true }], 4)).toThrow(
      /no Russian/,
    );
    expect(fileReader(read as Reader, ru).ru).toBeUndefined();
  });

  it('needs a gloss in each required language for every glossed word', () => {
    const dir = mkdtempSync(join(tmpdir(), 'readers-'));
    const reader = {
      id: 'truck',
      level: 'N1',
      topic: 'daily',
      title: '垃圾車',
      titleEn: 'The garbage truck',
      summary: 'The truck.',
      paragraphs: ['垃圾車。'],
      translation: ['The garbage truck.'],
      ru: { title: 'Мусоровоз', summary: 'Мусоровоз.', translation: ['Мусоровоз.'] },
    };
    writeFileSync(join(dir, 'truck.json'), JSON.stringify(reader));
    const truck = word('垃圾車', 'le4 se4 che1', 'garbage truck', { level: 'L2' });
    const russian = { lang: 'ru' as const, name: 'Russian', shards: [], required: true };
    expect(() => readReaders(dir, [...words, truck], [], [russian], 4)).toThrow(
      /no Russian gloss for 垃圾車/,
    );
    writeFileSync(
      join(dir, 'truck.json'),
      JSON.stringify({ ...reader, ru: { ...reader.ru, glossary: { 垃圾車: 'мусоровоз' } } }),
    );
    const [read] = readReaders(dir, [...words, truck], [], [russian], 4);
    expect(read?.paragraphs[0]?.[0]).toMatchObject({
      t: '垃圾車',
      g: 'garbage truck',
      gr: 'мусоровоз',
    });
  });
});

describe('Hán-Việt', () => {
  const table: HanVietTable = new Map([
    [
      '好',
      new Map<string, string | null>([
        ['hao3', 'hảo'],
        ['hao4', 'hiếu'],
      ]),
    ],
    ['朋', new Map<string, string | null>([['', 'bằng']])],
    ['友', new Map<string, string | null>([['you3', 'hữu']])],
    ['喔', new Map<string, string | null>([['', null]])],
    ['人', new Map<string, string | null>([['', 'nhân']])],
  ]);

  it('reads a character as the word reads it', () => {
    expect(charHanViet(table, '好', 'hao3')).toBe('hảo');
    expect(charHanViet(table, '好', 'hao4')).toBe('hiếu');
    // A neutral tone takes the same syllable's reading in any tone.
    expect(charHanViet(table, '友', 'you5')).toBe('hữu');
    expect(charHanViet(table, '喔', 'o1')).toBeNull();
    expect(charHanViet(table, '嗎', 'ma5')).toBeUndefined();
  });

  it('reads words, or gives up on any character without a reading', () => {
    expect(hanViet(table, '朋友', 'peng2 you5')).toBe('bằng hữu');
    expect(hanViet(table, '好人', 'hao3 ren2')).toBe('hảo nhân');
    expect(hanViet(table, '好嗎', 'hao3 ma5')).toBeUndefined();
    expect(hanViet(table, '好喔', 'hao3 o1')).toBeUndefined();
  });
});
