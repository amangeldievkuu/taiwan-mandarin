// Taiwan-standard guard for the whole repo: the generated study-path content (words, examples,
// readers) plus every Chinese string in the UI and API sources. Exits 1 on any Simplified
// character, Mainland word or Mainland reading.
// Run with: node --conditions=source scripts/check-taiwan-standard.ts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TOPICS, type ContentManifest, type Reader, type Word } from '@taiwan-mandarin/shared';
import {
  checkText,
  checkVocab,
  formatIssues,
  type Issue,
} from '@taiwan-mandarin/shared/taiwan-standard';

const root = join(import.meta.dirname, '..');
const SOURCES = [
  'apps/web/src',
  'apps/web/index.html',
  'apps/web/vite.config.ts',
  'apps/api/src',
  'packages/shared/src',
];
const EXTENSIONS = /\.(svelte|ts|html)$/;
/** The guard itself (its lists and tests are Mainland text by design), and the curated words,
 * which checkVocab checks field by field below. */
const SKIP = /^packages\/shared\/src\/(taiwan-standard\/|content\/curated\.ts$)/;
const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff]+/g;

function files(path: string): string[] {
  const full = join(root, path);
  if (!statSync(full, { throwIfNoEntry: false })) return [];
  if (statSync(full).isFile()) return [path];
  return readdirSync(full, { recursive: true, encoding: 'utf8' })
    .filter((f) => EXTENSIONS.test(f))
    .map((f) => join(path, f))
    .filter((f) => !SKIP.test(f));
}

const content = join(root, 'apps/web/public/content');
const json = <T>(file: string) => JSON.parse(readFileSync(join(content, file), 'utf8')) as T;
const manifest = json<ContentManifest>('manifest.json');
// The Vietnamese files are the English ones plus Vietnamese, so they cover everything.
const dir = manifest.languages?.includes('vi') ? 'vi/' : '';
const words = manifest.levels.flatMap((level) => json<Word[]>(dir + level.file));
const readers = json<Reader[]>(dir + 'readers.json');

const issues: Issue[] = checkVocab(words, TOPICS);
for (const reader of readers) {
  const where = `reader:${reader.id}`;
  for (const text of [reader.title, ...reader.paragraphs.map((p) => p.map((t) => t.t).join(''))]) {
    issues.push(...checkText({ text, where }));
  }
}
let scanned = 0;
// Words are checked structurally above, so their labeled Mainland notes are allowed.
for (const file of SOURCES.flatMap(files)) {
  scanned++;
  readFileSync(join(root, file), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const run of line.match(CJK_RUN) ?? []) {
        issues.push(
          ...checkText({ text: run, where: `${relative(root, join(root, file))}:${i + 1}` }),
        );
      }
    });
}

if (issues.length) {
  console.error(`Taiwan-standard guard: ${issues.length} problem(s)\n${formatIssues(issues)}`);
  process.exit(1);
}
console.log(
  `Taiwan-standard guard: ${words.length} words, ${readers.length} readers and ${scanned} source files OK`,
);
