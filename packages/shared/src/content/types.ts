// Vocabulary content types, shared by the web app and the API.

export type TopicId =
  | 'greetings'
  | 'people'
  | 'numbers'
  | 'food'
  | 'taiwan'
  | 'time'
  | 'actions'
  | 'describing'
  | 'questions';

export interface Note {
  en: string;
  ky: string;
}

export interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  ky: string;
  en: string;
  topic: TopicId;
  /** Note about Taiwan usage; marks the word as Taiwan-specific. */
  tw?: Note;
}

export interface Topic {
  id: TopicId;
  zh: string;
  en: string;
  ky: string;
}
