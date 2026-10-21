import { describe, expect, it } from 'vitest';
import {
  fromToneMarked,
  fromZhuyin,
  parseSyllable,
  plainPinyin,
  syllableToZhuyin,
  toToneMarked,
  toZhuyin,
  zhuyinString,
} from './phonetics.ts';

describe('toToneMarked', () => {
  it.each([
    ['ni3 hao3', 'nǐ hǎo'],
    ['ma1 ma2 ma3 ma4 ma5', 'mā má mǎ mà ma'],
    ['xie4 xie5', 'xiè xie'],
    ['zou3', 'zǒu'], // ou → o
    ['liu2', 'liú'], // iu → last vowel
    ['gui4', 'guì'], // ui → last vowel
    ['lv4', 'lǜ'],
    ['nu:3', 'nǚ'],
    ['nü3', 'nǚ'],
    ['lüe4', 'lüè'],
    ['ju2 qu4 xu1', 'jú qù xū'], // ü written as u
    ['yu2 yue4 yuan2 yun2', 'yú yuè yuán yún'],
    ['shei2', 'shéi'],
    ['er4', 'èr'],
    ['zhi1', 'zhī'],
  ])('%s → %s', (input, expected) => {
    expect(toToneMarked(input)).toBe(expected);
  });
});

describe('toZhuyin', () => {
  const z = (p: string) => zhuyinString(p);

  it('maps initials and simple finals with tones', () => {
    expect(z('ni3 hao3')).toBe('ㄋㄧˇ ㄏㄠˇ');
    expect(z('ma1 ma2 ma3 ma4')).toBe('ㄇㄚ ㄇㄚˊ ㄇㄚˇ ㄇㄚˋ');
  });

  it('puts the neutral tone dot first', () => {
    expect(z('xie4 xie5')).toBe('ㄒㄧㄝˋ ˙ㄒㄧㄝ');
    expect(toZhuyin('ma5')).toEqual([{ body: 'ㄇㄚ', tone: '˙' }]);
  });

  it('handles y/w spellings', () => {
    expect(z('yi1 ya2 ye3 yao4 you3 yan2 yin1 yang2 ying1 yong4')).toBe(
      'ㄧ ㄧㄚˊ ㄧㄝˇ ㄧㄠˋ ㄧㄡˇ ㄧㄢˊ ㄧㄣ ㄧㄤˊ ㄧㄥ ㄩㄥˋ',
    );
    expect(z('wu3 wa1 wo3 wai4 wei4 wan3 wen4 wang4 weng1')).toBe(
      'ㄨˇ ㄨㄚ ㄨㄛˇ ㄨㄞˋ ㄨㄟˋ ㄨㄢˇ ㄨㄣˋ ㄨㄤˋ ㄨㄥ',
    );
    expect(z('yu2 yue4 yuan2 yun2')).toBe('ㄩˊ ㄩㄝˋ ㄩㄢˊ ㄩㄣˊ');
  });

  it('treats u after j/q/x as ü', () => {
    expect(z('ju2 qu4 xu1')).toBe('ㄐㄩˊ ㄑㄩˋ ㄒㄩ');
    expect(z('jue2 quan2 xun2')).toBe('ㄐㄩㄝˊ ㄑㄩㄢˊ ㄒㄩㄣˊ');
    expect(z('jiong3')).toBe('ㄐㄩㄥˇ');
  });

  it('distinguishes lu / lü and nu / nü', () => {
    expect(z('lu4 lv4 nu3 nü3')).toBe('ㄌㄨˋ ㄌㄩˋ ㄋㄨˇ ㄋㄩˇ');
    expect(z('lüe4')).toBe('ㄌㄩㄝˋ');
  });

  it('expands iu, ui and un', () => {
    expect(z('liu2 jiu3')).toBe('ㄌㄧㄡˊ ㄐㄧㄡˇ');
    expect(z('gui4 dui4')).toBe('ㄍㄨㄟˋ ㄉㄨㄟˋ');
    expect(z('dun4 lun2')).toBe('ㄉㄨㄣˋ ㄌㄨㄣˊ');
    expect(z('jun1 yun4')).toBe('ㄐㄩㄣ ㄩㄣˋ');
  });

  it('drops the silent i after zh ch sh r z c s', () => {
    expect(z('zhi1 chi1 shi4 ri4 zi4 ci2 si4')).toBe('ㄓ ㄔ ㄕˋ ㄖˋ ㄗˋ ㄘˊ ㄙˋ');
    expect(z('ji1 qi1 xi1 li3')).toBe('ㄐㄧ ㄑㄧ ㄒㄧ ㄌㄧˇ');
  });

  it('handles er, o after labials, ong and eng', () => {
    expect(z('er4')).toBe('ㄦˋ');
    expect(z('bo2 po2 mo2 fo2')).toBe('ㄅㄛˊ ㄆㄛˊ ㄇㄛˊ ㄈㄛˊ');
    expect(z('zhong1 deng3')).toBe('ㄓㄨㄥ ㄉㄥˇ');
  });

  it('uses Taiwan readings', () => {
    expect(z('le4 se4')).toBe('ㄌㄜˋ ㄙㄜˋ'); // 垃圾
    expect(z('shei2')).toBe('ㄕㄟˊ'); // 誰
    expect(z('xing1 qi2')).toBe('ㄒㄧㄥ ㄑㄧˊ'); // 星期
  });
});

describe('parseSyllable', () => {
  it('returns canonical finals', () => {
    expect(parseSyllable('you3')).toMatchObject({ initial: '', final: 'iou', tone: 3 });
    expect(parseSyllable('jun1')).toMatchObject({ initial: 'j', final: 'ün', spelling: 'jun' });
    expect(parseSyllable('shi4')).toMatchObject({ initial: 'sh', final: '' });
  });

  it.each(['ni', 'ni6', 'ja1', 'yx2', 'xyz1', 'zh1', ''])('rejects "%s"', (input) => {
    expect(() => parseSyllable(input)).toThrow();
  });
});

describe('plainPinyin', () => {
  it('strips tones, digits, spaces and case', () => {
    expect(plainPinyin('Nǐ hǎo')).toBe('nihao');
    expect(plainPinyin('ni3 hao3')).toBe('nihao');
    expect(plainPinyin('lǜ')).toBe('lu');
  });
});

describe('fromToneMarked', () => {
  it.each([
    ['nǐ', 'ni3'],
    ['ma', 'ma5'],
    ['lǜ', 'lü4'],
    ['Xiè', 'xie4'],
    ['hăo', 'hao3'], // breve, as in the TOCFL list
    ['nĭ', 'ni3'],
    ['shuí', 'shui2'],
  ])('%s → %s', (input, expected) => {
    expect(fromToneMarked(input)).toBe(expected);
  });

  it('rejects two tone marks', () => {
    expect(() => fromToneMarked('nǐhǎo')).toThrow();
  });
});

describe('fromZhuyin', () => {
  it.each([
    ['ㄋㄧˇ', 'ni3'],
    ['˙ㄇㄚ', 'ma5'],
    ['ㄇㄚ˙', 'ma5'],
    ['ㄓ', 'zhi1'],
    ['ㄙˋ', 'si4'],
    ['ㄩˊ', 'yu2'],
    ['ㄐㄩㄝˊ', 'jue2'],
    ['ㄌㄩˋ', 'lü4'],
    ['ㄨㄥ', 'weng1'],
    ['ㄏㄨㄥˊ', 'hong2'],
    ['ㄑㄩㄥˊ', 'qiong2'],
    ['ㄉㄧㄡ', 'diu1'],
    ['ㄍㄨㄟˋ', 'gui4'],
    ['ㄉㄨㄣˋ', 'dun4'],
    ['ㄦˋ', 'er4'],
    ['ㄅㄛ', 'bo1'],
    ['ㄧㄞˊ', 'yai2'], // 崖, Taiwan reading
  ])('%s → %s', (input, expected) => {
    expect(fromZhuyin(input)).toBe(expected);
  });

  it('round-trips with syllableToZhuyin', () => {
    const syllables = [
      'zhuang4',
      'lüe4',
      'xiong2',
      'wen3',
      'yuan2',
      'si5',
      'ri4',
      'nü3',
      'er2',
      'ou1',
    ];
    for (const s of syllables) {
      const { body, tone } = syllableToZhuyin(s);
      expect(fromZhuyin(body + (tone === '˙' ? '' : tone) + (tone === '˙' ? '˙' : ''))).toBe(s);
    }
  });

  it('rejects letters that are not Zhuyin', () => {
    expect(() => fromZhuyin('abc')).toThrow();
  });
});
