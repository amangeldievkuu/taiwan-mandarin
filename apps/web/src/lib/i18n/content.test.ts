import { afterEach, describe, expect, it } from 'vitest';
import type { DictEntry, Reader } from '@taiwan-mandarin/shared';
import {
  definitionsOf,
  glossOf,
  readerTitleOf,
  readerTranslationOf,
  tokenGlossOf,
  twNoteOf,
} from './content';
import { locale } from './index.svelte';

describe('content text', () => {
  afterEach(() => {
    locale.lang = 'en';
  });

  const word = { en: 'garbage', vi: 'rác', tw: 'Taiwan says 垃圾.', twVi: 'Ở Đài Loan nói 垃圾.' };
  const reader = {
    titleEn: 'Trash',
    translation: ['Trash.', 'More.'],
    vi: { title: 'Rác', summary: 'Rác.', translation: ['Rác.'] },
  } as unknown as Reader;

  it('is in the learner’s language when the files have it', () => {
    locale.lang = 'vi';
    expect(glossOf(word)).toEqual({ text: 'rác', lang: 'vi' });
    expect(twNoteOf(word)).toEqual({ text: 'Ở Đài Loan nói 垃圾.', lang: 'vi' });
    expect(tokenGlossOf({ t: '垃圾', g: 'garbage', gv: 'rác' })).toEqual({
      text: 'rác',
      lang: 'vi',
    });
    expect(readerTitleOf(reader)).toEqual({ text: 'Rác', lang: 'vi' });
  });

  it('falls back to the English, marked as English', () => {
    locale.lang = 'vi';
    expect(glossOf({ en: 'garbage' })).toEqual({ text: 'garbage', lang: 'en' });
    expect(tokenGlossOf({ t: '垃圾', g: 'garbage' })).toEqual({ text: 'garbage', lang: 'en' });
    expect(readerTranslationOf(reader, 1)).toEqual({ text: 'More.', lang: 'en' });
  });

  it('is English in English, whatever else the files have', () => {
    expect(glossOf(word)).toEqual({ text: 'garbage', lang: 'en' });
    expect(twNoteOf(word)).toEqual({ text: 'Taiwan says 垃圾.', lang: 'en' });
  });

  it('labels dictionary definitions by the file’s language', () => {
    const own: DictEntry = { t: '垃圾', p: 'le4 se4', d: ['rác'] };
    const english: DictEntry = { t: '臺', p: 'tai2', d: ['platform'], en: 1 };
    locale.lang = 'vi';
    expect(definitionsOf(own).lang).toBe('vi');
    expect(definitionsOf(english).lang).toBe('en');
  });
});
