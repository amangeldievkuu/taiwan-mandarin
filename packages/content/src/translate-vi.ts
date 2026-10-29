// Writes the Vietnamese that CVDICT doesn't give, with OpenAI (structured outputs, 50 items per
// request, a few requests at a time). Each mode reads the built Vietnamese content, so build first;
// results are appended or merged as they come, so an interrupted run just continues next time.
//
//   npm run translate-vi -w @taiwan-mandarin/content -- --only examples --limit 100
//
//   examples  example sentences → data/generated/examples-vi.jsonl ({ zh, vi })
//   hanviet   every character's Sino-Vietnamese reading → data/hanviet.json, checked against
//             Unihan's kVietnamese (data/generated/hanviet-unihan-diffs.txt lists disagreements)
//   glosses   words with no Vietnamese meaning → data/generated/glosses-vi.jsonl ({ id, vi });
//             run it after a build that has the other two
//
// The key comes from apps/api/.env (or the environment). The model is --model, else
// OPENAI_EXAMPLES_MODEL, else OPENAI_MODEL; the reasoning effort --effort, else low.
// Rebuild afterwards: npm run build -w @taiwan-mandarin/content

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { unzipSync } from 'fflate';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  splitSyllables,
  toToneMarked,
  type ContentManifest,
  type Reader,
  type Word,
} from '@taiwan-mandarin/shared';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import { z } from 'zod';
import { DATA, OUT, ROOT } from './paths.ts';

const apiEnv = join(ROOT, 'apps/api/.env');
if (existsSync(apiEnv)) process.loadEnvFile(apiEnv);
if (!process.env['OPENAI_API_KEY']) {
  console.error('Set OPENAI_API_KEY (in apps/api/.env or the environment).');
  process.exit(1);
}
const setting = (name: string) => process.env[name]?.trim() || undefined;

const MODES = ['examples', 'hanviet', 'glosses'] as const;
const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    limit: { type: 'string', default: '100000' },
    model: {
      type: 'string',
      default: setting('OPENAI_EXAMPLES_MODEL') ?? setting('OPENAI_MODEL') ?? 'gpt-6-luna',
    },
    effort: { type: 'string', default: 'low' },
    concurrency: { type: 'string', default: '4' },
  },
});
const mode = MODES.find((m) => m === args.only);
if (!mode) {
  console.error(`Choose what to translate: --only ${MODES.join(' | ')}`);
  process.exit(1);
}
const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const effort = EFFORTS.find((e) => e === args.effort?.toLowerCase());
if (!effort) {
  console.error(`Unknown reasoning effort "${args.effort}"; use one of ${EFFORTS.join(', ')}.`);
  process.exit(1);
}
const model = args.model ?? 'gpt-6-luna';
const limit = Number(args.limit);

// ---- the built Vietnamese content ----

const contentFile = <T>(file: string) =>
  JSON.parse(readFileSync(join(OUT.content, file), 'utf8')) as T;
const manifest = contentFile<ContentManifest>('manifest.json');
if (!manifest.languages?.includes('vi')) {
  console.error('Build the content first: npm run build -w @taiwan-mandarin/content');
  process.exit(1);
}
const words = manifest.levels.flatMap((l) => contentFile<Word[]>(`vi/${l.file}`));
const readers = contentFile<Reader[]>('vi/readers.json');

const readJsonl = <T>(path: string): T[] =>
  existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as T)
    : [];

const VIETNAMESE_STYLE = `- Natural, everyday Vietnamese as people in Vietnam say it today; neutral register.
- Taiwan context: 臺北 Đài Bắc, 高雄 Cao Hùng, 臺中 Đài Trung, 臺南 Đài Nam, 花蓮 Hoa Liên, 桃園 Đào Viên; 捷運 tàu điện MRT, 高鐵 tàu cao tốc, 機車 xe máy, 便利商店 cửa hàng tiện lợi, 夜市 chợ đêm, 塊/元 (money) đồng (Đài tệ).
- No pinyin and no Chinese characters in the Vietnamese.`;

// ---- one batch job, whatever the mode ----

interface Job<Item> {
  label: string;
  items: Item[];
  instructions: string;
  /** One input line per item; the model answers by line number. */
  line: (item: Item) => string;
  /** Validates and stores one answer; false rejects it. */
  keep: (item: Item, answer: string | null) => boolean;
  /** Saves what was kept, after each request. */
  save?: () => void;
}

const Answers = z.object({
  answers: z.array(z.object({ n: z.number().int(), text: z.string().nullable() })),
});

const tokens = { input: 0, cached: 0, output: 0, reasoning: 0 };
const client = new OpenAI();

async function runJob<Item>(job: Job<Item>): Promise<void> {
  const items = job.items.slice(0, limit);
  if (!items.length) {
    console.log(`${job.label}: nothing to do.`);
    return;
  }
  const CHUNK = 50;
  const chunks: Item[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK));
  console.log(
    `${job.label}: ${items.length} items in ${chunks.length} requests (${model}, effort ${effort})`,
  );
  let kept = 0;
  let rejected = 0;
  let failed = 0;

  async function run(chunk: Item[]): Promise<void> {
    const response = await client.responses.parse({
      model,
      instructions: job.instructions,
      input: chunk.map((item, n) => `${n + 1} | ${job.line(item)}`).join('\n'),
      reasoning: { effort },
      text: { format: zodTextFormat(Answers, 'answers') },
      store: false,
    });
    const usage = response.usage;
    tokens.input += usage?.input_tokens ?? 0;
    tokens.cached += usage?.input_tokens_details?.cached_tokens ?? 0;
    tokens.output += usage?.output_tokens ?? 0;
    tokens.reasoning += usage?.output_tokens_details?.reasoning_tokens ?? 0;
    if (response.status === 'incomplete' || !response.output_parsed) {
      failed++;
      console.warn(`  ${chunk.length} items not written: ${response.incomplete_details?.reason}`);
      return;
    }
    const seen = new Set<number>();
    for (const { n, text } of response.output_parsed.answers) {
      const item = chunk[n - 1];
      if (!item || seen.has(n)) continue;
      seen.add(n);
      if (job.keep(item, text?.trim() || null)) kept++;
      else rejected++;
    }
    job.save?.();
    console.log(`  ${kept} kept, ${rejected} rejected so far`);
  }

  const queue = [...chunks];
  await Promise.all(
    Array.from({ length: Number(args.concurrency) }, async () => {
      for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
        await run(chunk).catch((e: unknown) =>
          console.warn(`  ${e instanceof Error ? e.message : e}`),
        );
      }
    }),
  );
  console.log(
    `${job.label}: kept ${kept}, rejected ${rejected}` +
      (failed ? `, ${failed} requests failed (retried next run)` : '') +
      '.',
  );
}

/** Vietnamese text we can store: no Simplified or Mainland Chinese slipped in, sensible length. */
const usable = (text: string | null, where: string, maxLength: number): text is string =>
  !!text && text.length <= maxLength && checkText({ text, where }).length === 0;

// ---- examples ----

function examplesJob(): Job<{ zh: string; en: string }> {
  const done = new Set(readJsonl<{ zh: string }>(DATA.viExamples).map((e) => e.zh));
  const todo = new Map<string, { zh: string; en: string }>();
  for (const w of words)
    for (const e of w.examples ?? [])
      if (!e.vi && !done.has(e.zh) && !todo.has(e.zh)) todo.set(e.zh, { zh: e.zh, en: e.en });
  return {
    label: 'examples',
    items: [...todo.values()],
    instructions: `You translate example sentences for Vietnamese speakers learning Taiwan Mandarin (臺灣華語). Each line is "number | Chinese | English".

- Translate the Chinese, keeping its meaning, tone and register. The English is only a reference; where it differs from the Chinese, follow the Chinese.
- Western names as in the English (Tom, Mary); Chinese names in their Hán-Việt reading (王 Vương, 小明 Tiểu Minh).
${VIETNAMESE_STYLE}
Answer every number with its Vietnamese sentence.`,
    line: (e) => `${e.zh} | ${e.en}`,
    keep: (e, vi) => {
      if (!usable(vi, `vi-example:${e.zh}`, Math.max(160, e.zh.length * 8))) return false;
      appendFileSync(DATA.viExamples, JSON.stringify({ zh: e.zh, vi }) + '\n');
      done.add(e.zh);
      return true;
    },
  };
}

// ---- glosses ----

function glossesJob(): Job<Word> {
  const done = new Set(readJsonl<{ id: string }>(DATA.aiGlossesVi).map((g) => g.id));
  return {
    label: 'glosses',
    items: words.filter((w) => !w.vi && w.en && !done.has(w.id)),
    instructions: `You write Vietnamese flashcard glosses for words of Taiwan Mandarin (臺灣華語), like the entries of a good Chinese–Vietnamese dictionary. Each line is "number | word | pinyin | English gloss".

- One to four senses a learner needs, most common first, separated by "; ", at most about 100 characters.
- Follow Taiwan usage. The English gloss is a reference for the intended sense.
- A verb as a verb, a noun as a noun; a measure word as "lượng từ cho …".
${VIETNAMESE_STYLE}
Answer every number with its gloss.`,
    line: (w) => `${w.hanzi} | ${toToneMarked(w.pinyin)} | ${w.en}`,
    keep: (w, vi) => {
      if (!usable(vi, `vi-gloss:${w.id}`, 120)) return false;
      appendFileSync(DATA.aiGlossesVi, JSON.stringify({ id: w.id, vi }) + '\n');
      done.add(w.id);
      return true;
    },
  };
}

// ---- Hán-Việt ----

const SYLLABLE = /^[a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+$/;

/** Unihan's kVietnamese readings (Unicode License), downloaded once, for cross-checking. */
async function unihanVietnamese(): Promise<Map<string, string[]>> {
  const path = join(ROOT, 'data/raw/unihan/Unihan_Readings.txt');
  if (!existsSync(path)) {
    const response = await fetch('https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip');
    if (!response.ok) throw new Error(`Unihan.zip: HTTP ${response.status}`);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()), {
      filter: (f) => f.name === 'Unihan_Readings.txt',
    });
    const readings = files['Unihan_Readings.txt'];
    if (!readings) throw new Error('Unihan.zip: no Unihan_Readings.txt');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, readings);
  }
  const map = new Map<string, string[]>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [code, field, value] = line.split('\t');
    if (field !== 'kVietnamese' || !code || !value) continue;
    map.set(String.fromCodePoint(parseInt(code.slice(2), 16)), value.split(' '));
  }
  return map;
}

async function hanvietJob(): Promise<Job<{ char: string; syllable: string; words: string[] }>> {
  const unihan = await unihanVietnamese();
  const table: Record<string, string | null> = existsSync(DATA.hanviet)
    ? (JSON.parse(readFileSync(DATA.hanviet, 'utf8')) as Record<string, string | null>)
    : {};
  // Every character with each reading it has in the path and the readers, and a few words.
  const uses = new Map<string, { char: string; syllable: string; words: string[] }>();
  const add = (text: string, pinyin: string) => {
    const chars = [...text];
    const syllables = splitSyllables(pinyin);
    if (chars.length !== syllables.length) return;
    chars.forEach((char, i) => {
      const syllable = (syllables[i] ?? '').toLowerCase();
      if (!/\p{Script=Han}/u.test(char) || /5$/.test(syllable)) return; // neutral: falls back
      const key = `${char}|${syllable}`;
      const use = uses.get(key) ?? { char, syllable, words: [] };
      if (use.words.length < 3 && !use.words.includes(text)) use.words.push(text);
      uses.set(key, use);
    });
  };
  for (const w of words) add(w.hanzi, w.pinyin);
  for (const r of readers) for (const p of r.paragraphs) for (const t of p) if (t.p) add(t.t, t.p);
  // A neutral tone reads like the same syllable in a full tone (朋友's you5 → you3); one with
  // none (著 zhe5 beside zhuó and zháo; 們, 嗎) needs an entry of its own.
  const toneless = (syllable: string) => syllable.replace(/[1-5]$/, '');
  const toned = new Set([...uses.values()].map((u) => `${u.char}|${toneless(u.syllable)}`));
  for (const w of words) {
    const syllables = splitSyllables(w.pinyin);
    [...w.hanzi].forEach((char, i) => {
      const syllable = (syllables[i] ?? '').toLowerCase();
      const key = `${char}|${toneless(syllable)}`;
      if (!/\p{Script=Han}/u.test(char) || toned.has(key)) return;
      uses.set(`${char}|${syllable}`, { char, syllable, words: [w.hanzi] });
      toned.add(key);
    });
  }

  const known = (char: string, syllable: string) => `${char}|${syllable}` in table || char in table;
  const items = [...uses.values()].filter((u) => !known(u.char, u.syllable));
  const diffs: string[] = [];
  const save = () => {
    writeFileSync(
      join(ROOT, 'data/generated/hanviet-unihan-diffs.txt'),
      "# Hán-Việt readings that differ from Unihan's kVietnamese (which also lists Nôm readings)\n" +
        [...new Set(diffs)].sort().join('\n') +
        '\n',
    );
    // One key per character when its readings agree, one per reading when they don't.
    const byChar = new Map<string, [string, string | null][]>();
    for (const [key, reading] of Object.entries(table)) {
      const char = key.split('|')[0] ?? '';
      byChar.set(char, [...(byChar.get(char) ?? []), [key, reading]]);
    }
    const out: Record<string, string | null> = {};
    for (const [char, entries] of [...byChar].sort(([a], [b]) => a.localeCompare(b))) {
      const values = new Set(entries.map(([, r]) => r));
      if (values.size === 1) out[char] = entries[0]?.[1] ?? null;
      else for (const [key, reading] of entries.sort()) out[key] = reading;
    }
    writeFileSync(
      DATA.hanviet,
      '{\n' +
        Object.entries(out)
          .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
          .join(',\n') +
        '\n}\n',
    );
  };
  return {
    label: 'hanviet',
    items,
    instructions: `You give the Sino-Vietnamese reading (âm Hán Việt) of Chinese characters, for Vietnamese learners of Taiwan Mandarin. Each line is "number | character | Mandarin reading | words it appears in".

- The standard Hán-Việt syllable for the character in that Mandarin reading (好 hǎo → hảo, 好 hào → hiếu; 行 xíng → hành, 行 háng → hàng; 樂 lè → lạc, 樂 yuè → nhạc), as in Thiều Chửu's dictionary. Lowercase, one syllable.
- Not a Nôm reading and not a translation.
- null when the character has no established Hán-Việt reading (some particles and interjections such as 喔 欸 囉, Taiwanese dialect characters).
Answer every number.`,
    line: (u) => `${u.char} | ${toToneMarked(u.syllable)} | ${u.words.join(' ')}`,
    keep: (u, reading) => {
      const value = reading?.toLowerCase().normalize('NFC') ?? null;
      if (value !== null && (value === 'null' || !SYLLABLE.test(value))) return false;
      table[`${u.char}|${u.syllable}`] = value;
      const listed = unihan.get(u.char);
      if (value && listed && !listed.includes(value))
        diffs.push(`${u.char}\t${u.syllable}\t${value}\tUnihan: ${listed.join(' ')}`);
      return true;
    },
    save,
  };
}

if (mode === 'examples') await runJob(examplesJob());
else if (mode === 'glosses') await runJob(glossesJob());
else await runJob(await hanvietJob());
console.log(
  `Tokens: in ${tokens.input} (cached ${tokens.cached}), out ${tokens.output} ` +
    `(reasoning ${tokens.reasoning}).`,
);
console.log('Now rebuild: npm run build -w @taiwan-mandarin/content');
