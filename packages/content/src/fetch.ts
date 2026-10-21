// Downloads the content sources into data/raw (gitignored). Run: npm run fetch -w @taiwan-mandarin/content
// Needs `bunzip2` on PATH for the Tatoeba exports.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { unzipSync } from 'fflate';
import { RAW } from './paths.ts';

const SOURCES = {
  tocfl: 'https://tocfl.edu.tw/tocfl/assets/files/vocabulary/8000zhuyin_202409.zip',
  naer: 'https://coct.naer.edu.tw/file/files/14452%E8%A9%9E%E8%AA%9E%E8%A1%A8202504.xlsx',
  frequency:
    'https://coct.naer.edu.tw/file/files/%E9%80%9A%E7%94%A8%E8%A9%9E%E9%A0%BB%E8%A1%A8%20-%20%E5%AE%9A%E7%A8%BF1141208.xlsx',
  cedict: 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz',
  tatoebaCmn: 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2',
  tatoebaEng: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
  tatoebaLinks: 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn-eng_links.tsv.bz2',
} satisfies Record<keyof typeof RAW, string>;

const force = process.argv.includes('--force');

for (const [name, url] of Object.entries(SOURCES) as [keyof typeof RAW, string][]) {
  const target = RAW[name];
  if (existsSync(target) && !force) {
    console.log(`= ${name} (already downloaded)`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  process.stdout.write(`↓ ${name} … `);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const body = new Uint8Array(await response.arrayBuffer());

  if (url.endsWith('.zip')) {
    // The TOCFL archive has Big5 file names and Zhuyin fonts; keep only the word list.
    const files = unzipSync(body, { filter: (f) => f.name.endsWith('.xlsx') });
    const xlsx = Object.values(files)[0];
    if (!xlsx) throw new Error(`${url}: no .xlsx inside`);
    writeFileSync(target, xlsx);
  } else if (url.endsWith('.gz')) {
    writeFileSync(target, gunzipSync(body));
  } else if (url.endsWith('.bz2')) {
    writeFileSync(target, execFileSync('bunzip2', ['-c'], { input: body, maxBuffer: 1 << 30 }));
  } else {
    writeFileSync(target, body);
  }
  console.log(`${Math.round(body.length / 1024)} KB`);
}
