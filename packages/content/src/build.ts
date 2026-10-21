// Builds the app's content from the downloaded sources. Run: npm run content
//   1. study-path words: TOCFL + NAER + curated starter words, glossed from CC-CEDICT
//   2. dictionary shards: CC-CEDICT with Taiwan readings, linked to study-path words
//   3. example sentences: Tatoeba, plus AI-written ones from data/generated
//   4. graded readers from data/readers, split into words
// Writes apps/web/public/{content,dict} and review reports in data/generated.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  LEVELS,
  plainPinyin,
  TOPICS,
  type ContentManifest,
  type Example,
  type LevelManifest,
} from '@taiwan-mandarin/shared';
import { checkVocab, formatIssues } from '@taiwan-mandarin/shared/taiwan-standard';
import { charReadings, readCedict, syllableInventory } from './cedict.ts';
import { buildDictionary } from './dictionary.ts';
import { pickExamples, readTatoeba } from './examples.ts';
import { buildLexicon } from './lexicon.ts';
import { readFrequencyRanks, readNaer, readTocfl } from './lists.ts';
import { DATA, OUT, RAW, ROOT } from './paths.ts';
import { readReaders } from './readers.ts';

const step = (label: string) => {
  const start = performance.now();
  return (detail = '') =>
    console.log(`✓ ${label} (${Math.round(performance.now() - start)} ms) ${detail}`);
};

for (const [name, path] of Object.entries(RAW)) {
  if (!existsSync(path)) {
    console.error(
      `Missing source "${name}": ${path}\nRun: npm run fetch -w @taiwan-mandarin/content`,
    );
    process.exit(1);
  }
}

const readJsonl = <T>(path: string): T[] =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as T)
    : [];

let done = step('CC-CEDICT');
const cedict = readCedict(RAW.cedict);
const ctx = { inventory: syllableInventory(cedict), readings: charReadings(cedict) };
done(`${cedict.length} entries`);

done = step('word lists');
const tocfl = readTocfl(RAW.tocfl);
const naer = readNaer(RAW.naer);
const frequency = readFrequencyRanks(RAW.frequency);
done(`TOCFL ${tocfl.length}, NAER ${naer.length}`);

done = step('study path');
const { words, legacyIds, report } = buildLexicon({ tocfl, naer, cedict, frequency, ctx });
// Glosses written for words CC-CEDICT lacks (see data/generated/README.md).
const aiGlosses = new Map(
  readJsonl<{ id: string; en: string }>(DATA.aiGlosses).map((g) => [g.id, g.en] as const),
);
for (const w of words) {
  const en = aiGlosses.get(w.id);
  if (!w.en && en) {
    w.en = en;
    w.glossSource = 'ai';
  }
}
done(
  `${words.length} words ${JSON.stringify(report.bySource)}, ${words.filter((w) => !w.en).length} without gloss`,
);

done = step('dictionary');
const dictionary = buildDictionary(cedict, words);
done(`${dictionary.entries} entries, longest ${dictionary.maxLength}`);

done = step('examples');
const sentences = readTatoeba({
  cmn: RAW.tatoebaCmn,
  eng: RAW.tatoebaEng,
  links: RAW.tatoebaLinks,
});
const { examples, usable, annotate } = pickExamples(
  sentences,
  words,
  dictionary.shards,
  dictionary.maxLength,
);
// AI-written examples for words Tatoeba doesn't cover. Pinyin is derived like Tatoeba's unless
// given (needed when the sentence uses a less common reading: 得 děi, 還 huán…).
const wordIds = new Set(words.map((w) => w.id));
let skipped = 0;
for (const ai of readJsonl<{ id: string; zh: string; en: string; pinyin?: string }>(
  DATA.aiExamples,
)) {
  if (!wordIds.has(ai.id)) throw new Error(`examples-ai: unknown word id ${ai.id}`);
  const pinyin = ai.pinyin ?? annotate(ai.zh);
  const han = [...ai.zh].filter((c) => /\p{Script=Han}/u.test(c)).length;
  if (!pinyin || pinyin.split(' ').length !== han) {
    skipped++; // a character with no known reading; give it a `pinyin` in the file to keep it
    continue;
  }
  const example: Example = { zh: ai.zh, pinyin, en: ai.en, source: 'ai' };
  const list = examples.get(ai.id) ?? [];
  if (list.length < 2 && !list.some((e) => e.zh === ai.zh)) examples.set(ai.id, [...list, example]);
}
if (skipped) console.warn(`  ${skipped} AI examples skipped: no reading for some character`);
for (const w of words) {
  const list = examples.get(w.id);
  if (list?.length) w.examples = list;
}
done(
  `${usable} usable of ${sentences.length} Tatoeba sentences; ${examples.size} words have examples`,
);

done = step('Taiwan-standard guard');
const issues = checkVocab(words, TOPICS);
if (issues.length) {
  console.error(formatIssues(issues.slice(0, 60)));
  console.error(`${issues.length} guard issues in generated content`);
  process.exit(1);
}
done();

done = step('readers');
const tooHard: string[] = [];
const readers = readReaders(
  DATA.readers,
  words,
  dictionary.shards,
  dictionary.maxLength,
  (id, above) => {
    if (above.length) tooHard.push(`${id}\t${[...new Set(above)].join(' ')}`);
  },
);
done(
  `${readers.length} texts; words above their level (auto-glossed): ${readers.map((r) => `${r.id} ${Math.round(r.hard * 100)}%`).join(', ')}`,
);

// ---- write ----
done = step('write');
rmSync(OUT.content, { recursive: true, force: true });
rmSync(OUT.dict, { recursive: true, force: true });
mkdirSync(OUT.content, { recursive: true });
mkdirSync(OUT.dict, { recursive: true });
const hash = createHash('sha256');
const write = (path: string, data: unknown) => {
  const json = JSON.stringify(data);
  hash.update(json);
  writeFileSync(path, json);
};

const levels: LevelManifest[] = LEVELS.map(({ id }) => {
  const list = words.filter((w) => w.level === id);
  const file = `words-${id}.json`;
  write(join(OUT.content, file), list);
  return {
    id,
    count: list.length,
    tocfl: list.filter((w) => w.src === 'tocfl').length,
    tbcl: list.filter((w) => w.src === 'tbcl').length,
    file,
  };
});
dictionary.shards.forEach((shard, i) => write(join(OUT.dict, `${i}.json`), shard));
// Search index for pinyin / English lookups across the whole path: [id, hanzi, toneless pinyin, gloss].
write(
  join(OUT.content, 'search.json'),
  words.map((w) => [w.id, w.hanzi, plainPinyin(w.pinyin), w.en.slice(0, 90)]),
);
write(join(OUT.content, 'readers.json'), readers);

const manifest: ContentManifest = {
  version: hash.digest('hex').slice(0, 12),
  levels,
  dictShards: dictionary.shards.length,
  dictMaxLength: dictionary.maxLength,
  readers: readers.length,
  legacyIds,
};
writeFileSync(join(OUT.content, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Review reports, committed so changes show up in diffs.
mkdirSync(join(ROOT, 'data/generated'), { recursive: true });
writeFileSync(
  join(ROOT, 'data/generated/reading-diffs.txt'),
  '# TOCFL readings replaced by NAER readings (same syllables, different tones)\n' +
    report.readingDiffs.join('\n') +
    '\n',
);
writeFileSync(
  join(ROOT, 'data/generated/no-gloss.tsv'),
  words
    .filter((w) => !w.en)
    .map((w) => `${w.id}\t${w.pinyin}\t${w.level}`)
    .join('\n') + '\n',
);
writeFileSync(
  join(ROOT, 'data/generated/reader-hard-words.tsv'),
  "# Reader words above the reader's level that have no glossary entry\n" +
    tooHard.join('\n') +
    '\n',
);
writeFileSync(
  join(ROOT, 'data/generated/unreadable.txt'),
  '# List entries whose reading could not be aligned with the characters\n' +
    report.unreadable.join('\n') +
    '\n',
);
done(`version ${manifest.version}`);
console.table(levels.map(({ id, count, tocfl, tbcl }) => ({ id, count, tocfl, tbcl })));
