/**
 * Runs electron-builder with its cache kept inside the repo (.cache/), per the
 * host-cleanliness rule. ELECTRON_BUILDER_CACHE must be an absolute path —
 * relative values break electron-builder's archive extraction — which a plain
 * npm-script env assignment cannot express portably.
 * Usage: node scripts/package.mjs --linux|--win|--mac
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const builderCli = require.resolve('electron-builder/out/cli/cli.js');

const result = spawnSync(
  process.execPath,
  [builderCli, '--publish', 'never', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_BUILDER_CACHE: resolve('.cache/electron-builder') },
  },
);
process.exit(result.status ?? 1);
