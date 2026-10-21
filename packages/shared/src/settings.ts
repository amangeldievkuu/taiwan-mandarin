// User settings, shared by the web app and the API.

export type Phonetics = 'zhuyin' | 'pinyin' | 'both';
export type MeaningLang = 'ky' | 'en';
export type GlyphStyle = 'kai' | 'sans';

export interface Settings {
  phonetics: Phonetics;
  meaning: MeaningLang;
  glyphStyle: GlyphStyle;
  newPerDay: number;
}
