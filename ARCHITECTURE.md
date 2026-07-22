# Architecture

Living document of the axioms and invariants of _Sway The People!_. A change that alters one of
these must update this file in the same commit. For folder-level detail, read the module doc
comments — this file is about the rules that hold the system together.

## Axioms

1. **Pure core.** `src/core/` contains all game rules, state transitions, simulation math, prompt
   construction and the IPC contract — with no Electron, DOM, or I/O imports. `src/main/` and
   `src/renderer/` depend on `core`; never the reverse, and never on each other (they meet only
   through the preload bridge and the shared protocol types).

2. **One authoritative state.** The main process (`GameHost`) owns the single `Campaign` value.
   The renderer is a projection: it mirrors state received over `state:campaign` events and
   mutates nothing locally — every change is a command sent over IPC.

3. **Commands are the only state transitions.** `applyCommand(campaign, command) → campaign`
   (`core/commands/reducer.ts`) is the sole way a campaign changes, for player actions and for
   generated content alike (`applyJobResult` is itself a command). Reducers work on a clone;
   invalid commands throw `CommandError`.

4. **Determinism via one seeded RNG.** All simulation randomness flows through the `Rng` whose
   state lives in `campaign.rngState` and is threaded through every reducer. Identical state +
   identical inputs ⇒ identical outcomes. Entity ids are the only non-deterministic values (they
   never affect outcomes).

5. **Everything generated goes through the queue.** No ad-hoc LLM calls. Every piece of generated
   content is a typed job (`core/generation/jobs.ts`), executed by the single-worker
   `GenerationQueue` (strict priority: interactive → high → background, FIFO within).

6. **The queue's contents are derived, never stored.** `deriveNeededJobs(campaign)`
   (`core/generation/needs.ts`) computes what must be generated from state alone; after every
   state change the host reconciles the queue against it. Save files therefore need no job list —
   loading a save re-derives pending work. Corollary: every job's _application_ must record its
   effect in state in a way that removes the need (and application must run before the finished
   job could shadow a still-needed key — see `queue.ts`). During **setup**, derivation is
   deliberately sequential: it yields at most one world-building job at a time, in a fixed
   narrative order (nation → councilor options per role → rivals → opinion → extras), so slow
   local engines are never buried in queued work and the player watches the world assemble piece
   by piece. Starting the campaign requires only the essentials (nation, rivals, initial
   opinion); the platform, agenda fits and influencers keep generating in the background and show
   as placeholders until they land.

7. **The LLM proposes, the core disposes.** Structured outputs are zod-validated
   (`core/generation/outputs.ts`), entity references arrive as _names_ and are leniently mapped to
   ids, and every number is clamped in `core/generation/apply.ts` against `BOUNDS`
   (`core/model/constants.ts`). Failed parses get one repair re-prompt, then one fresh retry, then
   surface in the UI with a manual retry.

8. **Applies are idempotent and stale-safe.** If state no longer expects a job's content (the
   player acted meanwhile, a save was loaded), the result is silently dropped.

9. **Context is engineered, not accumulated.** Each job type has a dedicated context builder
   (`core/generation/builders.ts`) assembling exactly the sections that task needs, within a
   ~12K-token input budget (32K-context models assumed; `core/generation/budget.ts`).
   **Hidden-agenda allowlist:** the player's hidden agenda may enter prompts only for councilor
   matching, the epilogue, councilor chat, generation of the player's own suggestions/platform,
   and content by a player-endorsing influencer whose seeded hint roll hit
   (`nextContentHintsHidden`, rolled from commitment in `core/sim/influencers.ts`). A rival's own
   hidden agenda may inform content voiced by that rival. Nothing else sees hidden agendas.

10. **Opinion is the battlefield.** Stored truth is approval (0–100) per state × topic ×
    candidate. Voting-intention shares are always derived (`core/sim/opinion.ts`), never stored —
    except as immutable survey/election snapshots. Every opinion movement leaves a rationale in
    `campaign.log`, so survey changes are traceable.

11. **Saves are complete snapshots.** A save file is `{ formatVersion, savedAt, name, campaign }`,
    validated against the campaign schema on load. API keys live in app settings, never in saves.

12. **Zod schemas are the source of truth** for the domain model (`core/model/schemas.ts`), LLM
    outputs, IPC payloads (`core/protocol.ts`), and save files. Types are inferred from schemas.

13. **The host stays clean.** Development touches only the repo: `node_modules/`, `.cache/`
    (npm/electron/builder caches), `.dev-data/` (dev userData). No global installs.

14. **MockAdapter is a first-class engine.** The whole game must remain playable and testable
    offline through it; the full-campaign smoke test (`tests/smoke.test.ts`) is the standing proof
    and must keep passing.

## State flow

```
renderer command ──IPC──▶ GameHost ──▶ applyCommand ──▶ new Campaign
                                            │
                    broadcast state:campaign│  reconcile queue ◀─ deriveNeededJobs
                                            ▼        │
                                       renderer   worker: buildRequest → engine →
                                                  parse/repair → applyJobResult (command) ─┐
                                                                                           │
                                        └──────────────── loops back to state change ◀────┘
```

## Tuning values

All gameplay numbers (campaign length, debate days, bounds, mission strengths) live in
`core/model/constants.ts` (`DEFAULT_CAMPAIGN_SETTINGS`, `BOUNDS`) and in `MVP_SCOPE.md`. Change
them there, nowhere else.
