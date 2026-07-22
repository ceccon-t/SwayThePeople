import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { version } from './package.json';

const coreAlias = { '@core': resolve(__dirname, 'src/core') };

// The game version lives ONLY in package.json: electron-builder stamps the
// packaged binaries from it, and this define injects it into the renderer UI.
const versionDefine = { __APP_VERSION__: JSON.stringify(version) };

// Dependencies are bundled (not externalized): all runtime deps are pure JS,
// which keeps the packaged app free of node_modules.
export default defineConfig({
  main: {
    resolve: { alias: coreAlias },
  },
  preload: {
    resolve: { alias: coreAlias },
  },
  renderer: {
    resolve: { alias: { ...coreAlias, '@renderer': resolve(__dirname, 'src/renderer/src') } },
    plugins: [react()],
    define: versionDefine,
  },
});
