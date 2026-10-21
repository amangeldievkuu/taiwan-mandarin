// Taiwan-standard guard for the whole repo: vocabulary data plus every Chinese string in the UI
// and API sources. Exits 1 on any Simplified character, Mainland word or Mainland reading.
// Run with: node --conditions=source scripts/check-taiwan-standard.ts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TOPICS, VOCAB } from '@taiwan-mandarin/shared';
import {
  checkText,
  checkVocab,
  formatIssues,
  type Issue,
} from '@taiwan-mandarin/shared/taiwan-standard';

const root = join(import.meta.dirname, '..');
const SOURCES = ['apps/web/src', 'apps/web/index.html', 'apps/web/vite.config.ts', 'apps/api/src'];
const EXTENSIONS = /\.(svelte|ts|html)$/;
const CJK_RUN = /[\u3400-\u9fff\uf900-\ufaff]+/g;

function files(path: string): string[] {
  const full = join(root, path);
  if (!statSync(full, { throwIfNoEntry: false })) return [];
  if (statSync(full).isFile()) return [path];
  return readdirSync(full, { recursive: true, encoding: 'utf8' })
    .filter((f) => EXTENSIONS.test(f))
    .map((f) => join(path, f));
}

const issues: Issue[] = checkVocab(VOCAB, TOPICS);
let scanned = 0;
// Vocabulary is checked structurally above, so its labeled Mainland notes are allowed.
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
console.log(`Taiwan-standard guard: ${VOCAB.length} words and ${scanned} source files OK`);
