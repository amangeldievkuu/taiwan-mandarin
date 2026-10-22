// Writes Taiwan-style example sentences for study-path words that have none, with OpenAI
// (structured outputs, 50 words per request, a few requests at a time). Validated results are
// appended to data/generated/examples-ai.jsonl, so an interrupted run just continues next time;
// rebuild content afterwards (npm run build -w @taiwan-mandarin/content).
//
//   npm run examples -w @taiwan-mandarin/content -- --levels L3,L4 --limit 500
//
// The key comes from apps/api/.env (or the environment). The model is --model, else
// OPENAI_EXAMPLES_MODEL, else OPENAI_MODEL; the reasoning effort --effort, else
// OPENAI_EXAMPLES_EFFORT, else medium: a batch job, so quality matters more than speed.

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { LEVELS, type ContentManifest, type Level, type Word } from '@taiwan-mandarin/shared';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import { z } from 'zod';
import { DATA, OUT, ROOT } from './paths.ts';

// Same settings as the API: apps/api/.env, where variables already set in the shell win.
const apiEnv = join(ROOT, 'apps/api/.env');
if (existsSync(apiEnv)) process.loadEnvFile(apiEnv);
if (!process.env['OPENAI_API_KEY']) {
  console.error('Set OPENAI_API_KEY (in apps/api/.env or the environment).');
  process.exit(1);
}
const setting = (name: string) => process.env[name]?.trim() || undefined;

const { values: args } = parseArgs({
  options: {
    levels: { type: 'string', default: 'L3,L4,L5,L6' },
    limit: { type: 'string', default: '1000' },
    model: {
      type: 'string',
      default: setting('OPENAI_EXAMPLES_MODEL') ?? setting('OPENAI_MODEL') ?? 'gpt-6-luna',
    },
    effort: { type: 'string', default: setting('OPENAI_EXAMPLES_EFFORT') ?? 'medium' },
    concurrency: { type: 'string', default: '4' },
  },
});
const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
const effort = EFFORTS.find((e) => e === args.effort?.toLowerCase());
if (!effort) {
  console.error(`Unknown reasoning effort "${args.effort}"; use one of ${EFFORTS.join(', ')}.`);
  process.exit(1);
}

const CHUNK = 50;
const Output = z.object({
  examples: z.array(z.object({ id: z.string(), zh: z.string(), en: z.string() })),
});

const manifest = JSON.parse(
  readFileSync(join(OUT.content, 'manifest.json'), 'utf8'),
) as ContentManifest;
const words = manifest.levels.flatMap(
  (l) => JSON.parse(readFileSync(join(OUT.content, l.file), 'utf8')) as Word[],
);
const byId = new Map(words.map((w) => [w.id, w]));
const done = new Set(
  existsSync(DATA.aiExamples)
    ? readFileSync(DATA.aiExamples, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => (JSON.parse(line) as { id: string }).id)
    : [],
);

function instructions(level: Level): string {
  const info = LEVELS.find((l) => l.id === level);
  return `You write example sentences for learners of Taiwan Mandarin (臺灣華語) at TOCFL ${info?.en} (${info?.cefr}).

- Traditional characters in Taiwan forms, Taiwan vocabulary (捷運, 計程車, 機車, 便利商店, 網路, 冷氣, 腳踏車, 影片, 軟體, 品質) and natural Taiwan phrasing. Never Mainland words.
- One sentence per word, 8 to 20 characters, showing the word's most common meaning in everyday Taiwan life (school, work, food, transport, family, news).
- Apart from the target word, use only common words a learner at this level knows.
- Use the target word exactly as given (same characters).
- en: a natural English translation.
Return one example for every id you are given.`;
}

const wanted = (args.levels ?? '').split(',') as Level[];
const todo = words
  .filter((w) => wanted.includes(w.level) && !w.examples?.length && !done.has(w.id))
  .slice(0, Number(args.limit));
if (!todo.length) {
  console.log('Every word in those levels has an example.');
  process.exit(0);
}
const chunks: { level: Level; words: Word[] }[] = [];
for (const level of wanted) {
  const group = todo.filter((w) => w.level === level);
  for (let i = 0; i < group.length; i += CHUNK)
    chunks.push({ level, words: group.slice(i, i + CHUNK) });
}
console.log(`${todo.length} words in ${chunks.length} requests (${args.model}, effort ${effort})`);

const client = new OpenAI();
let kept = 0;
let rejected = 0;
/** Requests that came back cut off or without an answer; their words are tried again next run. */
let failed = 0;
const tokens = { input: 0, cached: 0, output: 0, reasoning: 0 };

async function run(chunk: (typeof chunks)[number]): Promise<void> {
  const response = await client.responses.parse({
    model: args.model ?? 'gpt-6-luna',
    instructions: instructions(chunk.level),
    input: chunk.words.map((w) => `${w.id} | ${w.hanzi} | ${w.pinyin} | ${w.en}`).join('\n'),
    reasoning: { effort },
    text: { format: zodTextFormat(Output, 'examples') },
    store: false,
  });
  const usage = response.usage;
  tokens.input += usage?.input_tokens ?? 0;
  tokens.cached += usage?.input_tokens_details?.cached_tokens ?? 0;
  tokens.output += usage?.output_tokens ?? 0;
  tokens.reasoning += usage?.output_tokens_details?.reasoning_tokens ?? 0;
  if (response.status === 'incomplete' || !response.output_parsed) {
    failed++;
    const why = response.incomplete_details?.reason ?? 'no answer (refused)';
    console.warn(`  ${chunk.level}: ${chunk.words.length} words not written: ${why}`);
    return;
  }
  for (const example of response.output_parsed.examples) {
    const word = byId.get(example.id);
    const han = [...example.zh].filter((c) => /\p{Script=Han}/u.test(c)).length;
    const ok =
      word &&
      !done.has(word.id) &&
      example.zh.includes(word.hanzi) &&
      han >= 5 &&
      han <= 30 &&
      checkText({ text: example.zh, where: `ai-example:${word.id}` }).length === 0;
    if (!ok) {
      rejected++;
      continue;
    }
    appendFileSync(
      DATA.aiExamples,
      JSON.stringify({ id: example.id, zh: example.zh, en: example.en }) + '\n',
    );
    done.add(example.id);
    kept++;
  }
  console.log(`  ${chunk.level}: ${kept} kept, ${rejected} rejected so far`);
}

// A small worker pool.
const queue = [...chunks];
await Promise.all(
  Array.from({ length: Number(args.concurrency) }, async () => {
    for (let chunk = queue.shift(); chunk; chunk = queue.shift()) {
      await run(chunk).catch((e: unknown) =>
        console.warn(`  ${chunk?.level}: ${e instanceof Error ? e.message : e}`),
      );
    }
  }),
);
console.log(
  `Kept ${kept} examples, rejected ${rejected}` +
    (failed ? `, ${failed} requests failed (their words are retried next run)` : '') +
    `. Tokens: in ${tokens.input} (cached ${tokens.cached}), out ${tokens.output} ` +
    `(reasoning ${tokens.reasoning}).`,
);
console.log('Now rebuild: npm run build -w @taiwan-mandarin/content');
