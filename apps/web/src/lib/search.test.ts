import type { SearchRow } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { indexRows, searchRows } from './search';

const ids = (rows: SearchRow[]) => rows.map((r) => r[0]);

describe('searchRows', () => {
  const english = indexRows([
    ['班', '班', 'ban', 'class; team'],
    ['朋友', '朋友', 'pengyou', 'friend'],
    ['學生', '學生', 'xuesheng', 'student'],
    ['半', '半', 'ban', 'half'],
    ['辦法', '辦法', 'banfa', 'means; method'],
  ]);

  it('finds characters, pinyin and English as before', () => {
    expect(ids(searchRows(english, '學'))).toEqual(['學生']);
    expect(ids(searchRows(english, 'ban'))).toEqual(['班', '半', '辦法']);
    expect(ids(searchRows(english, 'friend'))).toEqual(['朋友']);
    expect(ids(searchRows(english, 'end'))).toEqual([]);
  });

  const vietnamese = indexRows([
    ['班', '班', 'ban', 'lớp; đội', 'ban'],
    ['朋友', '朋友', 'pengyou', 'bạn; bạn bè', 'bằng hữu'],
    ['學生', '學生', 'xuesheng', 'học sinh; sinh viên', 'học sinh'],
    ['半', '半', 'ban', 'một nửa', 'bán'],
    ['國家', '國家', 'guojia', 'quốc gia; đất nước', 'quốc gia'],
    ['走', '走', 'zou', 'đi bộ; đi', 'tẩu'],
  ]);

  it('never reads Vietnamese as pinyin', () => {
    expect(ids(searchRows(vietnamese, 'bạn'))).toEqual(['朋友']);
    expect(ids(searchRows(vietnamese, 'đi'))).toEqual(['走']);
  });

  it('matches meanings without accents, the typed spelling first', () => {
    expect(ids(searchRows(vietnamese, 'hoc sinh'))).toEqual(['學生']);
    expect(ids(searchRows(vietnamese, 'ban'))).toEqual(['班', '半', '朋友']);
    // Decomposed input (some Vietnamese keyboards) matches too.
    expect(ids(searchRows(vietnamese, 'học sinh'.normalize('NFD')))).toEqual(['學生']);
  });

  it('finds the Sino-Vietnamese reading last', () => {
    expect(ids(searchRows(vietnamese, 'bang huu'))).toEqual(['朋友']);
    expect(ids(searchRows(vietnamese, 'quoc gia'))).toEqual(['國家']);
  });
});
