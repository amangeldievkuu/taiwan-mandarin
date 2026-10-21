import { describe, expect, it } from 'vitest';
import { cleanDefinition, normalizePinyin, parseCedictLine, syllableInventory } from './cedict.ts';
import { citationTones, parseForms, pinyinVariants, readForm, zhuyinVariants } from './headword.ts';
import { alignPinyin, type PinyinContext } from './pinyin.ts';
import { taiwanCharReadings } from './dictionary.ts';
import { studyGloss } from './lexicon.ts';

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
