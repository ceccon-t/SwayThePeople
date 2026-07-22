# Sway The People!

A political simulation game about running for president of a fictional nation — where a large
language model generates the world, the rivals, the debates and the consequences. Create a
candidate, found a party with a public _and a hidden_ agenda, hire councilors, fight for public
opinion across states and topics, and face the vote after a 14-day campaign.

Design documents: [`PRD.md`](docs/PRD.md) (product) · [`TECHSPEC.md`](docs/TECHSPEC.md) (technical) ·
[`MVP_SCOPE.md`](docs/MVP_SCOPE.md) (current scope) · [`ARCHITECTURE.md`](ARCHITECTURE.md) (invariants)
· [`AGENTS.md`](AGENTS.md) (contributor/agent guide).

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
npm run build:appimage # Linux AppImage into dist/
node scripts/generate-icon.mjs   # regenerate build/icon.png
```

## Where data lives

- **Development**: everything stays in the repo — saves and settings in `.dev-data/`,
  package/binary caches in `.cache/`.
- **Packaged app**: standard Electron `userData` (`~/.config/SwayThePeople/`), with saves under
  `saves/`. Save files are full campaign snapshots; the save list shows their size.
- The OpenRouter API key is stored in `settings.json` only — never in save files.
