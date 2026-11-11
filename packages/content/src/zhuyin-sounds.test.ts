// The Zhuyin course plays each letter's sound by having the device's voice read one character
// (packages/shared/src/zhuyin-course.ts). A voice reads a character by its main reading, so that
// has to be the one the course means: the first in the built dictionary (Taiwan readings).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  dictShardOf,
  TONE_DEMO,
  TONE_SETS,
  ZHUYIN_LESSONS,
  type DictShard,
} from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { OUT } from './paths.ts';

const built = existsSync(join(OUT.dict, '0.json'));
const shards = new Map<number, DictShard>();

function readings(char: string): string[] {
  const n = dictShardOf(char);
  let shard = shards.get(n);
  if (!shard) {
    shard = JSON.parse(readFileSync(join(OUT.dict, `${n}.json`), 'utf8')) as DictShard;
    shards.set(n, shard);
  }
  return [...new Set((shard[char] ?? []).map((e) => e.p))];
}

const sounds = [
  ...ZHUYIN_LESSONS.flatMap((l) => l.letters.map((x) => x.sound)),
  ...TONE_DEMO,
  ...TONE_SETS.flat(),
];

describe.skipIf(!built)('the Zhuyin course, against the built dictionary', () => {
  it.each(sounds)('reads $char as $pinyin first', ({ char, pinyin }) => {
    expect(readings(char)[0]).toBe(pinyin);
  });
});
