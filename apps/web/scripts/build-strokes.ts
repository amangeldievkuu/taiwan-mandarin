// Bundles hanzi-writer stroke data for every vocabulary character into src/lib/strokes.json
// (so stroke order works offline) and draws public/icon.svg from the strokes of 華.
// Run with: node scripts/build-strokes.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { VOCAB } from '@taiwan-mandarin/shared';

interface CharData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

const root = join(import.meta.dirname, '..');
const dataDir = dirname(createRequire(import.meta.url).resolve('hanzi-writer-data/package.json'));

const chars = [...new Set(VOCAB.flatMap((w) => [...w.hanzi]))].sort();
const strokes: Record<string, CharData> = {};
const missing: string[] = [];

for (const char of chars) {
  const file = join(dataDir, `${char}.json`);
  if (existsSync(file)) strokes[char] = JSON.parse(readFileSync(file, 'utf8')) as CharData;
  else missing.push(char);
}

writeFileSync(join(root, 'src/lib/strokes.json'), JSON.stringify(strokes));
console.log(`strokes.json: ${Object.keys(strokes).length}/${chars.length} characters`);
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
