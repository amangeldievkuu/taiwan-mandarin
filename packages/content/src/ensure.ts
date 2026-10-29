// Builds the app content if it isn't there yet (fresh clone) or predates one of its languages'
// files: downloads the sources, then runs the pipeline. Generated content is not committed (see
// README › Content and licenses).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentManifest } from '@taiwan-mandarin/shared';
import { CONTENT_LANGUAGES } from './languages.ts';
import { OUT } from './paths.ts';

const manifestPath = join(OUT.content, 'manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ContentManifest;
  // Content built before a language's files: build again (fetch only downloads what's new).
  const missing = CONTENT_LANGUAGES.filter((l) => !manifest.languages?.includes(l.lang));
  if (missing.length === 0) process.exit(0);
  console.log(
    `App content has no ${missing.map((l) => l.name).join(' or ')} yet: building it again…`,
  );
} else {
  console.log('App content missing: downloading sources and building it (about a minute)…');
}
const run = (script: string) =>
  execFileSync(process.execPath, ['--conditions=source', join(import.meta.dirname, script)], {
    stdio: 'inherit',
  });
run('fetch.ts');
run('build.ts');
