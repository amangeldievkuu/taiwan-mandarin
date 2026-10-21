// Global setup: a separate test database on the same server as development, created if missing
// and brought up to date with the real migrations (non-destructive; every test uses fresh
// accounts). Set TEST_DATABASE_URL to point elsewhere (e.g. in CI).

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import pg from 'pg';

export default async function setup(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url =
    process.env['TEST_DATABASE_URL'] ??
    (process.env['DATABASE_URL'] ?? '').replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
  if (!url) throw new Error('Set DATABASE_URL or TEST_DATABASE_URL for the API tests');
  process.env['TEST_DATABASE_URL'] = url;

  const target = new URL(url);
  const name = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${name.replace(/"/g, '')}"`);
  await client.end();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
