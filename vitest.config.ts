import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { version } from './package.json';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
    },
  },
  // Mirrors the renderer define in electron.vite.config.ts so screen tests compile.
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
