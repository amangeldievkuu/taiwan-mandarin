import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 doesn't read .env itself.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` needs no database (e.g. in a Docker build); migrations do.
  ...(process.env['DATABASE_URL'] ? { datasource: { url: env('DATABASE_URL') } } : {}),
});
