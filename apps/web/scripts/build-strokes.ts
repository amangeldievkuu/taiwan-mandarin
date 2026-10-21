// Bundles hanzi-writer stroke data for every vocabulary character into src/lib/strokes.json
// (so stroke order works offline) and draws public/icon.svg from the strokes of 華.
// Taiwan MOE stroke order comes from data/stroke-order-tw-overrides.json: each character is
// marked tw: true only when verified there; everything else is PRC order, shown with a badge.
// Run with: node --conditions=source scripts/build-strokes.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { VOCAB } from '@taiwan-mandarin/shared';

interface CharData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

type Override =
  | { status: 'same-as-prc'; source: string }
  | { status: 'tw'; source: string; strokes: string[]; medians: number[][][] };

const root = join(import.meta.dirname, '..');
const dataDir = dirname(createRequire(import.meta.url).resolve('hanzi-writer-data/package.json'));

const overrides = (
  JSON.parse(readFileSync(join(root, '../../data/stroke-order-tw-overrides.json'), 'utf8')) as {
    characters: Record<string, Override>;
  }
).characters;

for (const [char, o] of Object.entries(overrides)) {
  if (!o.source) throw new Error(`Override for ${char} needs a source`);
  if (o.status === 'tw' && (!o.strokes.length || o.strokes.length !== o.medians.length)) {
    throw new Error(`Override for ${char} needs matching strokes and medians`);
  }
}

const chars = [...new Set(VOCAB.flatMap((w) => [...w.hanzi]))].sort();
const strokes: Record<string, CharData & { tw: boolean }> = {};
const missing: string[] = [];

for (const char of chars) {
  const override = overrides[char];
  const file = join(dataDir, `${char}.json`);
  if (override?.status === 'tw') {
    strokes[char] = { strokes: override.strokes, medians: override.medians, tw: true };
  } else if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as CharData;
    strokes[char] = { ...data, tw: override?.status === 'same-as-prc' };
  } else {
    missing.push(char);
  }
}

writeFileSync(join(root, 'src/lib/strokes.json'), JSON.stringify(strokes));
const verified = Object.values(strokes).filter((s) => s.tw).length;
console.log(
  `strokes.json: ${Object.keys(strokes).length}/${chars.length} characters, ` +
    `${verified} verified Taiwan order`,
);
if (missing.length) console.warn(`No stroke data for: ${missing.join(' ')}`);

// Icon: white 華 on the accent blue. Stroke data uses a 1024 box with y pointing up.
const icon = JSON.parse(readFileSync(join(dataDir, '華.json'), 'utf8')) as CharData;
const paths = icon.strokes.map((d) => `<path d="${d}"/>`).join('');
writeFileSync(
  join(root, 'public/icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#0071E3"/>
<g fill="#FFFFFF" transform="translate(96 96) scale(0.3125) translate(0 900) scale(1 -1)">${paths}</g>
</svg>
`,
);
console.log('icon.svg written');
