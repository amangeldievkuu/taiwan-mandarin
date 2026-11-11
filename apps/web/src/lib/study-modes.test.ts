import type { PronounceResult, SyllableResult } from '@taiwan-mandarin/shared/api';
import { describe, expect, it } from 'vitest';
import { Rating } from './srs';
import {
  isHan,
  maskOwnChars,
  parseMode,
  suggestSpeakGrade,
  suggestWriteGrade,
} from './study-modes';

const syllable = (over: Partial<SyllableResult> = {}): SyllableResult => ({
  char: '你',
  pinyin: 'ni3',
  expectedTone: 2,
  sound: 'ok',
  tone: 'ok',
  contour: [],
  ...over,
});
const result = (...syllables: SyllableResult[]): PronounceResult => ({
  transcript: '你好',
  syllables,
  score: 90,
});

describe('parseMode', () => {
  it('keeps every mode, old and new', () => {
    for (const mode of ['recognize', 'recall', 'listen', 'write', 'speak'])
      expect(parseMode(mode)).toBe(mode);
  });

  it('falls back to recognise for anything else', () => {
    expect(parseMode(null)).toBe('recognize');
    expect(parseMode('draw')).toBe('recognize');
    expect(parseMode(3)).toBe('recognize');
  });
});

describe('suggestWriteGrade', () => {
  it('is Good for a clean answer and never Easy', () => {
    expect(suggestWriteGrade({ mistakes: 0, hints: 0, gaveUp: false })).toBe(Rating.Good);
  });

  it('is Hard after a wrong stroke', () => {
    expect(suggestWriteGrade({ mistakes: 2, hints: 0, gaveUp: false })).toBe(Rating.Hard);
  });

  it('is Again after a hint or giving up', () => {
    expect(suggestWriteGrade({ mistakes: 3, hints: 1, gaveUp: false })).toBe(Rating.Again);
    expect(suggestWriteGrade({ mistakes: 0, hints: 0, gaveUp: true })).toBe(Rating.Again);
  });
});

describe('suggestSpeakGrade', () => {
  it('is Good when every sound and tone is right, unclear and neutral tones included', () => {
    expect(
      suggestSpeakGrade(
        result(syllable(), syllable({ tone: 'unclear' }), syllable({ tone: 'neutral' })),
      ),
    ).toBe(Rating.Good);
  });

  it('is Hard when the sounds are right but a tone is not', () => {
    expect(suggestSpeakGrade(result(syllable(), syllable({ tone: 'wrong', heardTone: 4 })))).toBe(
      Rating.Hard,
    );
  });

  it('is Again when a syllable is missing or misheard', () => {
    expect(suggestSpeakGrade(result(syllable(), syllable({ sound: 'missing' })))).toBe(
      Rating.Again,
    );
    expect(suggestSpeakGrade(result(syllable({ sound: 'wrong', heard: '妳' })))).toBe(Rating.Again);
  });

  it('suggests nothing when nothing could be compared', () => {
    expect(suggestSpeakGrade(result())).toBeUndefined();
  });
});

describe('isHan', () => {
  it('tells characters from letters and digits', () => {
    expect([...'卡拉OK3號'].map(isHan)).toEqual([true, true, false, false, false, true]);
  });
});

describe('maskOwnChars', () => {
  it("hides the word's own characters in a meaning", () => {
    expect(maskOwnChars('senior high school (abbr. for 高級中學)', '高中')).toBe(
      'senior high school (abbr. for ～級～學)',
    );
    expect(maskOwnChars('притяжательная частица («мой»: 我的)', '的')).toBe(
      'притяжательная частица («мой»: 我～)',
    );
  });

  it('leaves a meaning without them alone', () => {
    expect(maskOwnChars('teacher', '老師')).toBe('teacher');
  });
});
