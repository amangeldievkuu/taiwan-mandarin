// Justified exceptions to the Taiwan-standard guard. Each entry applies only to locations that
// start with `where`, and must explain why the term is correct there.

export interface AllowEntry {
  term: string;
  /** Location prefix, e.g. "vocab:臺灣.tw". */
  where: string;
  reason: string;
}

export const ALLOWLIST: readonly AllowEntry[] = [
  {
    term: '台',
    where: 'vocab:臺灣.tw',
    reason: 'The note explains that 台 is the common everyday form of 臺.',
  },
  {
    term: '台',
    where: 'vocab:臺北.tw',
    reason: 'The note explains that 台 is the common everyday form of 臺.',
  },
  ...(['自行車', '摩托車', '地鐵'] as const).map((term) => ({
    term,
    where: `vocab:${term}.examples`,
    reason: 'The example sentence explains the Taiwan word for this Mainland term.',
  })),
  {
    term: '台',
    where: 'apps/api/src/ai/taiwan-style.ts',
    reason: 'The AI style guide explains that 台 is the everyday form of 臺.',
  },
  {
    term: '台',
    // talk.service.ts and its unit test.
    where: 'apps/api/src/ai/talk.service.',
    reason:
      'The conversation partner speaks casually and is told to write 台 (台北, 台鐵); the tests check that 台 and 臺 count as the same.',
  },
  {
    term: '台',
    where: 'apps/api/src/content/content.service.ts',
    reason: 'Lookups map the everyday 台 to 臺, so 台北 finds the word 臺北.',
  },
  ...(['explain', 'talk'] as const).map((where) => ({
    term: '台',
    where,
    reason:
      'AI answers and the texts learners bring may use 台, the everyday form of 臺 (台北, 一台).',
  })),
  {
    term: '菜單',
    where: 'vocab:菜單',
    reason:
      'A restaurant menu is 菜單 in Taiwan. OpenCC maps it to 選單, which is a software menu.',
  },
];

/**
 * Everyday words that OpenCC's Taiwan phrase table ("twp") rewrites into software terminology.
 * They are standard in Taiwan in their general sense, so the guard never flags them:
 * 消息 news (→ 訊息), 打開 open (→ 開啟), 高級 high-end (→ 高階), 支持 support (→ 支援),
 * 項目 item (→ 專案), 程序 procedure (→ 程式), 社區 community (→ 社群), 分區 district (→ 分割槽).
 * 念/唸 and 了解/瞭解 are both standard (TOCFL lists 念, 了解 first).
 */
export const OPENCC_OVERREACH: readonly string[] = [
  '消息', '打開', '高級', '低級', '支持', '項目', '程序', '設置', '保存', '社區', '類型', '數據',
  '信號', '通信', '窗口', '連接', '循環', '局部', '聲明', '干擾', '念', '注意', '准', '斗', '分區', '了解',
]; // prettier-ignore
