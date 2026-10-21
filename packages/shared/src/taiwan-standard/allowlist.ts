// Justified exceptions to the Taiwan-standard guard. Each entry applies only to locations that
// start with `where`, and must explain why the term is correct there.

export interface AllowEntry {
  term: string;
  /** Location prefix, e.g. "vocab:tai-wan.tw". */
  where: string;
  reason: string;
}

export const ALLOWLIST: readonly AllowEntry[] = [
  {
    term: '台',
    where: 'vocab:tai-wan.tw',
    reason: 'The note explains that 台 is the common everyday form of 臺.',
  },
  {
    term: '台',
    where: 'vocab:tai-bei.tw',
    reason: 'The note explains that 台 is the common everyday form of 臺.',
  },
  {
    term: '菜單',
    where: 'vocab:cai-dan',
    reason:
      'A restaurant menu is 菜單 in Taiwan. OpenCC maps it to 選單, which is a software menu.',
  },
];
