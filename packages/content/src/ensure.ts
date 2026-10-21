// Builds the app content if it isn't there yet (fresh clone): downloads the sources, then runs the
// pipeline. Generated content is not committed (see README › Content and licenses).

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT } from './paths.ts';

if (existsSync(join(OUT.content, 'manifest.json'))) process.exit(0);
console.log('App content missing: downloading sources and building it (about a minute)…');
const run = (script: string) =>
  execFileSync(process.execPath, ['--conditions=source', join(import.meta.dirname, script)], {
    stdio: 'inherit',
  });
run('fetch.ts');
run('build.ts');
