// Builds the app's content from the downloaded sources. Run: npm run content
//   1. study-path words: TOCFL + NAER + curated starter words, glossed from CC-CEDICT (and in each
//      other language from its translation, CVDICT in Vietnamese, or data/generated)
//   2. dictionary shards: CC-CEDICT with Taiwan readings, linked to study-path words
//   3. example sentences: Tatoeba, plus AI-written ones from data/generated
//   4. graded readers from data/readers, split into words
// Writes apps/web/public/{content,dict}, a set per language (languages.ts), and review reports in
// data/generated.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  LEVELS,
  plainPinyin,
  sourceKey,
  TOPICS,
  type ContentManifest,
  type Example,
  type ForeignLang,
  type LevelManifest,
  type SearchRow,
} from '@taiwan-mandarin/shared';
import { checkVocab, formatIssues } from '@taiwan-mandarin/shared/taiwan-standard';
import { charReadings, readCedict, syllableInventory } from './cedict.ts';
import { attachTranslations } from './cvdict.ts';
import { buildDictionary } from './dictionary.ts';
import { charHanViet, hanViet, readHanViet } from './hanviet.ts';
import { pickExamples, readTatoeba } from './examples.ts';
import { fileReader, fileWord } from './files.ts';
import { CONTENT_LANGUAGES } from './languages.ts';
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

for (const { lang, name, dictionary } of CONTENT_LANGUAGES) {
  if (!dictionary) continue;
  done = step(dictionary.name);
  const translated = attachTranslations(cedict, lang, dictionary.read(dictionary.path));
  done(`${translated} of ${cedict.length} entries in ${name}`);
}

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
/** A file of `{key, <lang>}` lines → text in `lang` by key. */
const translations = <K extends string>(path: string, key: K, lang: ForeignLang) =>
  new Map(
    readJsonl<Record<K | ForeignLang, string>>(path).map(
      (line) => [line[key], line[lang]] as const,
    ),
  );
const gapGlosses = CONTENT_LANGUAGES.map(
  (l) => [l.lang, translations(l.glosses, 'id', l.lang)] as const,
);
for (const w of words) {
  const en = aiGlosses.get(w.id);
  if (!w.en && en) {
    w.en = en;
    w.glossSource = 'ai';
  }
  for (const [lang, glosses] of gapGlosses) {
    const text = glosses.get(w.id);
    if (!w[lang] && text) {
      w[lang] = text;
      w[sourceKey(lang)] = 'ai';
    }
  }
}
done(
  `${words.length} words ${JSON.stringify(report.bySource)}, ${words.filter((w) => !w.en).length} without gloss` +
    CONTENT_LANGUAGES.map(
      ({ lang, name }) => `, ${words.filter((w) => !w[lang]).length} without a ${name} one`,
    ).join(''),
);

const hanVietLanguage = CONTENT_LANGUAGES.find((l) => l.hanViet);
done = step('Hán-Việt');
const hanVietTable = readHanViet(DATA.hanviet);
const hanVietMissing = new Set<string>();
for (const w of hanVietLanguage ? words : []) {
  const hv = hanViet(hanVietTable, w.hanzi, w.pinyin);
  if (hv) w.hv = hv;
  const syllables = w.pinyin.split(' ');
  [...w.hanzi].forEach((char, i) => {
    if (
      /\p{Script=Han}/u.test(char) &&
      charHanViet(hanVietTable, char, syllables[i] ?? '') === undefined
    )
      hanVietMissing.add(char);
  });
}
done(`${words.filter((w) => w.hv).length} words, ${hanVietMissing.size} characters missing`);

done = step('dictionary');
const dictionary = buildDictionary(
  cedict,
  words,
  CONTENT_LANGUAGES.map(({ lang, wordMeanings, hanViet: hv }) => ({
    lang,
    wordMeanings,
    ...(hv
      ? { reading: (hanzi: string, pinyin: string) => hanViet(hanVietTable, hanzi, pinyin) }
      : {}),
  })),
);
done(`${dictionary.entries} entries, longest ${dictionary.maxLength}`);

done = step('examples');
const sentences = readTatoeba({
  cmn: RAW.tatoebaCmn,
  eng: RAW.tatoebaEng,
  links: RAW.tatoebaLinks,
});
const { examples, usable, annotate, wordLengths } = pickExamples(
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
  const reading = ai.pinyin
    ? { pinyin: ai.pinyin, wordLengths: wordLengths(ai.zh) }
    : annotate(ai.zh);
  const han = [...ai.zh].filter((c) => /\p{Script=Han}/u.test(c)).length;
  if (!reading || reading.pinyin.split(' ').length !== han) {
    skipped++; // a character with no known reading; give it a `pinyin` in the file to keep it
    continue;
  }
  const example: Example = { zh: ai.zh, ...reading, en: ai.en, source: 'ai' };
  const list = examples.get(ai.id) ?? [];
  if (list.length < 2 && !list.some((e) => e.zh === ai.zh)) examples.set(ai.id, [...list, example]);
}
if (skipped) console.warn(`  ${skipped} AI examples skipped: no reading for some character`);
// Translations of example sentences in each language, by sentence (see data/generated/README.md).
const exampleTranslations = CONTENT_LANGUAGES.map(
  (l) => [l.lang, translations(l.examples, 'zh', l.lang)] as const,
);
for (const w of words) {
  const list = examples.get(w.id);
  if (list?.length) {
    w.examples = list.map((e) => {
      const tr = exampleTranslations.flatMap(([lang, byZh]) => {
        const text = byZh.get(e.zh);
        return text ? [[lang, text] as const] : [];
      });
      return tr.length ? { ...e, ...Object.fromEntries(tr) } : e;
    });
  }
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
  CONTENT_LANGUAGES.map(({ lang, name, readers: required }) => ({
    lang,
    name,
    shards: dictionary.localized[lang] ?? [],
    required: required === 'required',
  })),
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
const files: Record<string, string> = {};
/** Writes `content/…` or `dict/…` and records its own hash, so clients re-fetch only changes. */
const write = (path: string, data: unknown) => {
  const json = JSON.stringify(data);
  hash.update(json);
  const target = join(
    OUT[path.startsWith('dict/') ? 'dict' : 'content'],
    path.replace(/^\w+\//, ''),
  );
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, json);
  files[path] = createHash('sha256').update(json).digest('hex').slice(0, 12);
};

const levels: LevelManifest[] = LEVELS.map(({ id }) => {
  const list = words.filter((w) => w.level === id);
  const file = `words-${id}.json`;
  write(
    `content/${file}`,
    list.map((w) => fileWord(w)),
  );
  for (const l of CONTENT_LANGUAGES)
    write(
      `content/${l.lang}/${file}`,
      list.map((w) => fileWord(w, l)),
    );
  return {
    id,
    count: list.length,
    tocfl: list.filter((w) => w.src === 'tocfl').length,
    tbcl: list.filter((w) => w.src === 'tbcl').length,
    file,
  };
});
dictionary.shards.forEach((shard, i) => write(`dict/${i}.json`, shard));
for (const { lang } of CONTENT_LANGUAGES)
  dictionary.localized[lang]?.forEach((shard, i) => write(`dict/${lang}/${i}.json`, shard));
// Search index for pinyin / meaning lookups across the whole path: [id, hanzi, toneless pinyin,
// gloss], plus the Sino-Vietnamese reading in Vietnamese.
write(
  'content/search.json',
  words.map((w): SearchRow => [w.id, w.hanzi, plainPinyin(w.pinyin), w.en.slice(0, 90)]),
);
for (const { lang, searchGloss, hanViet: hv } of CONTENT_LANGUAGES)
  write(
    `content/${lang}/search.json`,
    words.map((w): SearchRow => {
      const gloss = (w[lang] ?? w.en).slice(0, searchGloss);
      const pinyin = plainPinyin(w.pinyin);
      return hv && w.hv ? [w.id, w.hanzi, pinyin, gloss, w.hv] : [w.id, w.hanzi, pinyin, gloss];
    }),
  );
write(
  'content/readers.json',
  readers.map((r) => fileReader(r)),
);
for (const l of CONTENT_LANGUAGES)
  write(
    `content/${l.lang}/readers.json`,
    readers.map((r) => fileReader(r, l)),
  );

const manifest: ContentManifest = {
  version: hash.digest('hex').slice(0, 12),
  levels,
  dictShards: dictionary.shards.length,
  dictMaxLength: dictionary.maxLength,
  readers: readers.length,
  legacyIds,
  files,
  languages: ['en', ...CONTENT_LANGUAGES.map((l) => l.lang)],
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
for (const { lang, name, dictionary: source, glosses } of CONTENT_LANGUAGES)
  writeFileSync(
    join(ROOT, `data/generated/no-gloss-${lang}.tsv`),
    `# Words with no ${name} meaning${source ? ` (${source.name} lacks them)` : ''}: write them into ${basename(glosses)}\n` +
      words
        .filter((w) => !w[lang])
        .map((w) => `${w.id}\t${w.pinyin}\t${w.level}\t${w.en}`)
        .join('\n') +
      '\n',
  );
if (hanVietLanguage)
  writeFileSync(
    join(ROOT, 'data/generated/hanviet-missing.txt'),
    '# Characters of study words with no Hán-Việt reading in data/hanviet.json\n' +
      [...hanVietMissing].join('') +
      '\n',
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
