// Writes public/strokes-tw.json: stroke data for characters verified against the Taiwan MOE
// standard (data/stroke-order-tw-overrides.json). Every other character is loaded at runtime from
// hanzi-writer-data on jsDelivr and shown with a "may differ from the Taiwan standard" badge.
// Also draws public/icon.svg (a vermilion seal with 華) from the strokes of 華.
// Run with: node --conditions=source scripts/build-strokes.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

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

const verified: Record<string, CharData & { tw: true }> = {};
for (const [char, o] of Object.entries(overrides)) {
  if (!o.source) throw new Error(`Override for ${char} needs a source`);
  if (o.status === 'tw') {
    if (!o.strokes.length || o.strokes.length !== o.medians.length) {
      throw new Error(`Override for ${char} needs matching strokes and medians`);
    }
    verified[char] = { strokes: o.strokes, medians: o.medians, tw: true };
  } else {
    const file = join(dataDir, `${char}.json`);
    if (!existsSync(file)) throw new Error(`No hanzi-writer data for ${char}`);
    verified[char] = { ...(JSON.parse(readFileSync(file, 'utf8')) as CharData), tw: true };
  }
}
writeFileSync(join(root, 'public/strokes-tw.json'), JSON.stringify(verified));
console.log(
  `strokes-tw.json: ${Object.keys(verified).length} characters verified against the Taiwan standard`,
);

// Icon: paper-white 華 on a vermilion seal. Stroke data uses a 1024 box with y pointing up.
const icon = JSON.parse(readFileSync(join(dataDir, '華.json'), 'utf8')) as CharData;
const paths = icon.strokes.map((d) => `<path d="${d}"/>`).join('');
writeFileSync(
  join(root, 'public/icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="104" fill="#C8102E"/>
<rect x="34" y="34" width="444" height="444" rx="78" fill="none" stroke="#FFFAF2" stroke-width="14"/>
<g fill="#FFFAF2" transform="translate(106 106) scale(0.293) translate(0 900) scale(1 -1)">${paths}</g>
</svg>
`,
);
console.log('icon.svg written');
