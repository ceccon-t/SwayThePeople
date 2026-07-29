# Sway The People! — Development

## Requirements

- Linux, Node.js ≥ 20 (no global tools; everything installs into the repo).
- An LLM engine, one of:
  - **Ollama** running locally (default `http://localhost:11434`) with an instruct model
    (e.g. `llama3.1:8b`);
  - an **OpenRouter** API key;
  - or the built-in **Mock** engine (offline canned content — good for a first look).

## Run

```bash
npm install
npm run dev            # development app with hot reload
```

If Electron aborts with a SUID sandbox error (common on Ubuntu 23.10+), use:

```bash
npm run dev:nosandbox
```

On first launch, open **AI Engine Settings**, pick a provider, load the model list (filter by
typing, e.g. “llama”), test the connection, and save. Then start a new campaign.

## Other commands

```bash
npm test               # vitest suite, incl. a full-campaign smoke test (offline)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format         # prettier
npm run build:linux    # Linux AppImage + deb into dist/
npm run build:win      # Windows NSIS installer (run on Windows)
npm run build:mac      # macOS dmg, arm64 + x64 (run on macOS)
node scripts/generate-icon.mjs   # regenerate build/icon.png
```

CI (`.github/workflows/build.yml`) builds all three platforms on native runners: manually via
_Run workflow_ (`gh workflow run build.yml`), or by pushing a `v*` tag, which also drafts a
GitHub release with the artifacts.

Linux packages ship a launcher (`scripts/after-pack.cjs`) that keeps Chromium's sandbox when the
system supports one (SUID helper or unprivileged user namespaces) and otherwise falls back to
`--no-sandbox` — without it, AppImages abort on distros that restrict user namespaces
(Ubuntu 23.10+).

## Where data lives

- **Development**: everything stays in the repo — saves and settings in `.dev-data/`,
  package/binary caches in `.cache/`.
- **Packaged app**: standard Electron `userData` (`~/.config/SwayThePeople/`), with saves under
  `saves/`. Save files are full campaign snapshots; the save list shows their size.
- The OpenRouter API key is stored in `settings.json` only — never in save files.
