// Shared prompt text: what "Taiwan Mandarin" means for generated Chinese.

import { MAINLAND_TERMS } from '@taiwan-mandarin/shared/taiwan-standard';

export const TAIWAN_STYLE = `Write Chinese exactly as people in Taiwan write it today:
- Traditional characters in Taiwan forms (裡, 為, 線, 著). Write 臺 in 臺灣 and 臺北 when being formal; 台 is the everyday form.
- Taiwan vocabulary, never the Mainland word: ${Object.entries(MAINLAND_TERMS)
  .map(([mainland, taiwan]) => `${taiwan} (not ${mainland})`)
  .join(', ')}.
- Taiwan readings from the Ministry of Education dictionary: 垃圾 lèsè, 星期 xīngqí, 期 qí, 危險 wéixiǎn, 企業 qìyè, 暫時 zhànshí, 研究 yánjiù, 頭髮 tóufǎ, 誰 shéi.
- Natural Taiwan conversational tone, including sentence-final particles where a Taiwanese speaker would use them (喔, 啦, 耶, 欸, 齁), and no Beijing erhua (這裡 not 這兒, 一點 not 一點兒).`;

/** The learner's own text is quoted as it is, never "corrected" into Taiwan forms. */
export const EXACT_TEXT = `Wherever you quote the learner's Chinese (source, tokens), copy it exactly, character for character: Simplified or Traditional, 台 or 臺, typos and all. Never correct it there; point out problems in the notes instead.`;

/** Numbered pinyin, one syllable per Chinese character, citation tones. */
export const PINYIN_FORMAT =
  'numbered pinyin, one syllable per Chinese character, separated by spaces, tones 1–4 and 5 for neutral, citation tones for 一 and 不 (e.g. "ni3 hao3", "bu4 ke4 qi4", "yi1 ding4")';

/** 台 is the everyday way to write 臺 (台北 for 臺北): the formal spelling, for looking words up. */
export const formalTai = (text: string): string => text.replaceAll('台', '臺');
