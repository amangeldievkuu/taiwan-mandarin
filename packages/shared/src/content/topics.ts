// Topics follow the situations (情境) of the NAER 《臺灣華語文能力基準》 word list, which cover
// every level. TOCFL's own contexts (任務領域, Novice to Level 2 only) are mapped onto them.

import type { Topic, TopicId } from './types.ts';

export const TOPICS: readonly Topic[] = [
  { id: 'core', zh: '核心詞', en: 'Core words' },
  { id: 'personal', zh: '個人資料', en: 'About you' },
  { id: 'social', zh: '社交、人際', en: 'People & relationships' },
  { id: 'daily', zh: '日常起居', en: 'Daily life & home' },
  { id: 'food', zh: '餐飲、烹飪', en: 'Food & cooking' },
  { id: 'shopping', zh: '購物、商店', en: 'Shopping' },
  { id: 'travel', zh: '交通、旅遊', en: 'Transport & travel' },
  { id: 'leisure', zh: '休閒、娛樂', en: 'Free time' },
  { id: 'education', zh: '教育、學習', en: 'School & learning' },
  { id: 'work', zh: '職業', en: 'Work' },
  { id: 'body', zh: '身體、醫療', en: 'Body & health' },
  { id: 'feelings', zh: '情緒、態度', en: 'Feelings & attitudes' },
  { id: 'nature', zh: '自然環境', en: 'Nature & weather' },
  { id: 'culture', zh: '文化', en: 'Culture' },
  { id: 'society', zh: '社會', en: 'Society' },
  { id: 'public', zh: '公共服務', en: 'Public services' },
  { id: 'safety', zh: '安全', en: 'Safety' },
  { id: 'tech', zh: '科技', en: 'Technology' },
];

export const TOPIC_BY_ID: ReadonlyMap<TopicId, Topic> = new Map(TOPICS.map((t) => [t.id, t]));
