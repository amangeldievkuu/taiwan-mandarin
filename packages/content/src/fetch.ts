// Downloads the content sources into data/raw (gitignored). Run: npm run fetch -w @taiwan-mandarin/content
// Needs `bunzip2` on PATH for the Tatoeba exports.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
  // CVDICT 1.0.1 (CC BY-SA 4.0). Its own repository (github.com/ph0ngp/CVDICT) is gone; this is the
  // unchanged file kept in another project, pinned to a commit and checked against SHA256 below.
  cvdict:
    'https://raw.githubusercontent.com/phucbm/xue-hanzi/c1e7610546454e32db2b3332435902bf78181152/src/data/CVDICT.u8',
  tatoebaCmn: 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2',
  tatoebaEng: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
  tatoebaLinks: 'https://downloads.tatoeba.org/exports/per_language/cmn/cmn-eng_links.tsv.bz2',
} satisfies Record<keyof typeof RAW, string>;

/** Sources that must be exactly this file. */
const SHA256: Partial<Record<keyof typeof RAW, string>> = {
  cvdict: '4dde4b204193efa9c192d7f7daeab1bb579c8ccd7c41ed90d1b6caee22ba0948',
};

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
  const expected = SHA256[name];
  const actual = createHash('sha256').update(body).digest('hex');
  if (expected && actual !== expected) {
    throw new Error(
      `${url}: SHA256 ${actual}, expected ${expected}. If the copy moved or changed, find another ` +
        `copy of the same file (CC BY-SA 4.0 also allows keeping one in this repo) and pin it here.`,
    );
  }

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
