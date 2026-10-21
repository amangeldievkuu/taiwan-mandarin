import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// Use @taiwan-mandarin/shared from source, like the build script (node --conditions=source).
export default defineConfig({
  resolve: { conditions: ['source', ...defaultServerConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
});
