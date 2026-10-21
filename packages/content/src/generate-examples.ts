// Writes Taiwan-style example sentences for study-path words that have none, with the Claude
// Message Batches API (asynchronous, half price). Validated results are appended to
// data/generated/examples-ai.jsonl; rebuild content afterwards (npm run build -w …/content).
//
//   ANTHROPIC_API_KEY=… node --conditions=source src/generate-examples.ts --levels L3,L4 --limit 500
//   … --resume msgbatch_…        (collect a batch that was already submitted)

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { LEVELS, type ContentManifest, type Level, type Word } from '@taiwan-mandarin/shared';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import { z } from 'zod';
import { DATA, OUT } from './paths.ts';

const { values: args } = parseArgs({
  options: {
    levels: { type: 'string', default: 'L3,L4,L5,L6' },
    limit: { type: 'string', default: '1000' },
    resume: { type: 'string' },
    model: { type: 'string', default: process.env['ANTHROPIC_MODEL'] ?? 'claude-opus-5-5' },
  },
});

const BATCH_WORDS = 50;
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

function system(level: Level): string {
  const info = LEVELS.find((l) => l.id === level);
  return `You write example sentences for learners of Taiwan Mandarin (臺灣華語) at TOCFL ${info?.en} (${info?.cefr}).

- Traditional characters in Taiwan forms, Taiwan vocabulary (捷運, 計程車, 機車, 便利商店, 網路, 冷氣, 腳踏車, 影片, 軟體, 品質) and natural Taiwan phrasing. Never Mainland words.
- One sentence per word, 8 to 20 characters, showing the word's most common meaning in everyday Taiwan life (school, work, food, transport, family, news).
- Apart from the target word, use only common words a learner at this level knows.
- Use the target word exactly as given (same characters).
- en: a natural English translation.
Return one example for every id you are given.`;
}

async function submit(client: Anthropic): Promise<string> {
  const wanted = (args.levels ?? '').split(',') as Level[];
  const todo = words
    .filter((w) => wanted.includes(w.level) && !w.examples?.length && !done.has(w.id))
    .slice(0, Number(args.limit));
  if (!todo.length) {
    console.log('Every word in those levels has an example.');
    process.exit(0);
  }
  const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = [];
  for (const level of wanted) {
    const group = todo.filter((w) => w.level === level);
    for (let i = 0; i < group.length; i += BATCH_WORDS) {
      const chunk = group.slice(i, i + BATCH_WORDS);
      requests.push({
        custom_id: `${level}-${i / BATCH_WORDS}`,
        params: {
          model: args.model ?? 'claude-opus-5-5',
          max_tokens: 16_000,
          system: [{ type: 'text', text: system(level), cache_control: { type: 'ephemeral' } }],
          messages: [
            {
              role: 'user',
              content: chunk.map((w) => `${w.id} | ${w.hanzi} | ${w.pinyin} | ${w.en}`).join('\n'),
            },
          ],
          output_config: { effort: 'medium', format: zodOutputFormat(Output) },
        },
      });
    }
  }
  const batch = await client.messages.batches.create({ requests });
  console.log(`Submitted ${batch.id}: ${todo.length} words in ${requests.length} requests.`);
  console.log(`Resume later with: --resume ${batch.id}`);
  return batch.id;
}

async function collect(client: Anthropic, id: string): Promise<void> {
  for (;;) {
    const batch = await client.messages.batches.retrieve(id);
    if (batch.processing_status === 'ended') break;
    console.log(`… ${batch.request_counts.processing} requests still processing`);
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
  let kept = 0;
  let rejected = 0;
  for await (const result of await client.messages.batches.results(id)) {
    if (result.result.type !== 'succeeded') {
      console.warn(`${result.custom_id}: ${result.result.type}`);
      continue;
    }
    const text = result.result.message.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('');
    const parsed = Output.safeParse(JSON.parse(text || '{}'));
    if (!parsed.success) {
      console.warn(`${result.custom_id}: unexpected output`);
      continue;
    }
    for (const example of parsed.data.examples) {
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
  }
  console.log(
    `Kept ${kept} examples, rejected ${rejected}. Now rebuild: npm run build -w @taiwan-mandarin/content`,
  );
}

const client = new Anthropic();
await collect(client, args.resume ?? (await submit(client)));
