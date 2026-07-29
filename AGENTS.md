# Instructions for Coding Agents (and humans in a hurry)

_Sway The People!_ is an Electron + TypeScript + React political-simulation game whose content is
LLM-generated at runtime. Read `ARCHITECTURE.md` before changing anything structural — it lists
the invariants; this file tells you how to work here.

## Ground rules

- **Never break the layering**: `core` (pure TS, no Electron/DOM/IO) ← `main` / `renderer`.
  `main` and `renderer` never import each other. The IPC contract lives only in
  `src/core/protocol.ts`.
- **State changes only through commands** (`core/commands/`). Never mutate the campaign outside
  `applyCommand`; never write renderer-local game state.
- **All LLM content goes through the generation queue.** To add generated content: add a job type
  in `core/generation/jobs.ts`, an output schema in `outputs.ts`, a context builder in
  `builders.ts`, application logic in `apply.ts` (idempotent, stale-safe, clamp every number), a
  needs rule in `needs.ts`, a label in `jobLabel`, and MockAdapter output in
  `src/main/llm/mock.ts`. All seven, always.
- **Respect the hidden-agenda allowlist** in `builders.ts`'s header comment.
- **Simulation randomness** must come from the threaded `Rng` — never `Math.random` (only
  `newId()` is exempt).
- **Keep the MockAdapter able to play a full game.** `tests/smoke.test.ts` must pass offline.
- **Host cleanliness**: never install global tools or write outside the repo. Dev data belongs in
  `.dev-data/`, caches in `.cache/`.
- If you change an architectural invariant, update `ARCHITECTURE.md` in the same commit.

## Style

- TypeScript strict; types inferred from zod schemas where a schema exists.
- Small modules with a header comment stating their responsibility; descriptive full-word names
  (`jobItem`, not `j` — loop indices excepted).
- Comments explain constraints and intent, not mechanics; keep the existing density.
- Prettier + ESLint are the arbiters: `npm run format && npm run lint`.

## Verify your work

```bash
npm run typecheck && npm run lint && npm test
```

- Tests live in `tests/` (vitest). Core logic is tested directly; game flow is tested by driving
  `GameHost` with the MockAdapter (see `tests/helpers.ts`).
- To see the app: `npm run dev` (or `npm run dev:nosandbox` if the SUID sandbox aborts). For a
  headless render check: `SWAY_SCREENSHOT=/tmp/shot.png npm run dev:nosandbox` captures the window
  to a PNG and exits.
- Full build: `npm run build:linux` (Linux AppImage + deb in `dist/`). `build:win` / `build:mac`
  exist too but must run on their native OS (CI does this).

## Common tasks, briefly

- **New gameplay tuning**: change `DEFAULT_CAMPAIGN_SETTINGS` / `BOUNDS` in
  `core/model/constants.ts` only.
- **New screen**: add to `renderer/src/screens/`, register in `SCREENS` in `App.tsx`, navigate via
  the store. Use the shared async components (`Pending`, `FailedJobs`) for anything generated.
- **New LLM provider**: implement `LlmEngine` in `src/main/llm/`, add it to `factory.ts` and the
  `ProviderId` union in `core/generation/engine.ts`, and extend the Settings screen.
