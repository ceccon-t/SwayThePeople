# Sway The People! — Technical Specification

**Status:** Draft v1
**Stage:** 2 of 4 (PRD → **Technical Specification** → MVP Scope → Implementation)
**Companion:** `PRD.md` defines _what_ the game is; this document defines _how_ it is built. Where quantities are gameplay-tunable (days, states, rivals, topic areas), this spec defines the mechanism and leaves the numbers to the MVP Scope document.

---

## 1. Guiding Technical Principles

1. **Pure core.** All game rules, state transitions, simulation math, and prompt construction live in a pure TypeScript domain layer with no Electron, DOM, or I/O dependencies. Everything around it is adapters and views. This makes the game logic trivially testable and portable.
2. **One authoritative state.** The Electron main process owns the single source of truth (the campaign state). The renderer is a projection of that state and mutates it only through explicit commands.
3. **LLM behind an abstraction.** Game code never talks to a provider. It requests _content_ from an internal engine interface; provider adapters (Ollama, OpenRouter) implement the wire details. New providers are new adapters, nothing else changes.
4. **Everything generated goes through the queue.** No ad-hoc LLM calls. Every generation is a typed job with a priority, processed asynchronously, with results applied to state through the same command path as player actions.
5. **The LLM proposes, the core disposes.** LLM outputs that affect the simulation are structured, schema-validated, and bounded. The deterministic core clamps and applies them. Free prose is for humans; numbers are always sanitized.
6. **Context is engineered, not accumulated.** Every job type has an explicit context builder with a token budget (32K-context models assumed). Nothing enters a prompt by accident.
7. **Saves are complete.** A save file is a full snapshot: loading it reproduces the campaign exactly, including pending generation work (re-enqueued on load).
8. **Host stays clean.** Development and builds touch only the project directory: local `node_modules`, project-local caches, project-local runtime data in dev. No global installs, no writes outside the repo.
9. **Readable by agents and humans.** Small modules, explicit types, self-describing names, and living docs (`README.md`, `AGENTS.md`, `ARCHITECTURE.md`). Prefer boring, idiomatic code over cleverness.

---

## 2. Stack & Tooling

| Concern          | Choice                                                   | Rationale                                                                                                                                                        |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell            | **Electron** (current stable)                            | Required by notes; desktop app with Node capabilities for FS/network.                                                                                            |
| Language         | **TypeScript, `strict: true`** everywhere                | Type safety across IPC and LLM schemas; agent-friendly.                                                                                                          |
| Renderer UI      | **React 18 + plain CSS** (custom properties for theming) | Ubiquitous, well-understood by contributors and coding agents; menu-driven UI is a natural fit. No component library — the text-first UI is fully custom-styled. |
| Build            | **electron-vite** (Vite for main/preload/renderer)       | Fast dev loop with HMR, standard modern Electron setup.                                                                                                          |
| Packaging        | **electron-builder**, **Linux AppImage only**            | Per notes; dev + AppImage targets only.                                                                                                                          |
| Validation       | **zod**                                                  | Runtime validation of LLM outputs, save files, and IPC payloads from one schema source.                                                                          |
| Testing          | **vitest**                                               | Fast, Vite-native; used mainly against the pure core.                                                                                                            |
| Lint/format      | **ESLint + Prettier**                                    | Consistency for mixed human/agent contributions.                                                                                                                 |
| State (renderer) | React `useReducer` + context; no state library           | The renderer mirrors main-process state; a store library adds nothing at this scale.                                                                             |

**Runtime dependencies are deliberately minimal:** `react`, `react-dom`, `zod`. Everything else is dev tooling. No game framework — per the notes, this is a menu-driven app and needs nothing beyond ordinary app tooling.

### 2.1 Host-cleanliness measures (development process)

- All installs via `npm install` with the project-local `node_modules/`.
- Electron and electron-builder binary caches redirected into the repo: scripts set `ELECTRON_CACHE=.cache/electron` and `ELECTRON_BUILDER_CACHE=.cache/electron-builder`.
- In development the app redirects Electron's `userData` to `<repo>/.dev-data/` (via `app.setPath('userData', …)` when not packaged), so settings and save files never touch `~/.config`. Packaged builds use the standard `userData` location.
- `.gitignore` covers `node_modules/`, `.cache/`, `.dev-data/`, `dist/`, `out/`.

---

## 3. Process Architecture

```
┌─────────────────────────── Electron main process ───────────────────────────┐
│  GameHost                                                                    │
│  ├── GameEngine        applies commands → new state (uses core reducers)     │
│  ├── GenerationQueue   typed jobs, priorities, single worker                 │
│  ├── LlmService        engine config + adapters (Ollama, OpenRouter, Mock)   │
│  ├── PersistenceService saves/loads campaigns, app settings                  │
│  └── IpcGateway        validated command/query/event surface                 │
│            ▲  commands (invoke)              │ state & queue events (send)   │
└────────────┼─────────────────────────────────┼───────────────────────────────┘
             │            preload (contextBridge, typed API)
┌────────────┴─────────────────────────────────▼───────────────────────────────┐
│  Renderer (React) — pure view: screens render state; user actions → commands │
└───────────────────────────────────────────────────────────────────────────────┘
                    core/ (pure TS) is imported by main; its types by renderer
```

- **Security defaults:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; the preload exposes a small typed API only.
- **LLM calls happen only in main** (no CORS issues; the OpenRouter API key never reaches the renderer).
- **State sync:** after every state change, main broadcasts a fresh campaign snapshot (`campaign:updated`). At MVP scale (tens of KB) full snapshots are simpler and fast enough; patching is a later optimization.

### 3.1 IPC contract

Three channel kinds, all payloads zod-validated at the boundary:

- **Commands** (`invoke`, renderer → main): `campaign.create`, `campaign.save`, `campaign.load`, `campaign.list`, `candidate.set`, `party.set`, `councilor.hire`, `councilor.fire`, `chat.send`, `day.assignMissions`, `day.end`, `event.respond`, `debate.act`, `settings.updateLlm`, `llm.listModels`, `llm.testConnection`, `generation.retry`, …
- **Queries** (`invoke`): `campaign.snapshot`, `settings.get`, `queue.status`.
- **Events** (`send`, main → renderer): `campaign:updated`, `queue:updated` (job started/succeeded/failed), `llm:status`.

A single shared module (`core/protocol.ts`) defines every command/query/event name and payload schema — the one place the contract lives.

---

## 4. Repository Layout

```
swaythepeople/
├── src/
│   ├── core/            # PURE domain: no Electron, no IO, no React
│   │   ├── model/       # entity types + zod schemas (campaign, party, characters…)
│   │   ├── sim/         # opinion math, day resolution, vote simulation, RNG
│   │   ├── commands/    # command handlers: (state, command) → state + effects
│   │   ├── generation/  # job types, context builders, prompt templates, output schemas
│   │   └── protocol.ts  # IPC command/query/event contract
│   ├── main/            # Electron main: GameHost, queue worker, LLM adapters, persistence, IPC
│   ├── preload/         # contextBridge typed API
│   └── renderer/        # React app: screens, components, styles, state mirror
├── tests/               # vitest suites (mostly over core/)
├── PRD.md  TECHSPEC.md  MVP_SCOPE.md (stage 3)
├── README.md  AGENTS.md  ARCHITECTURE.md
└── package.json  electron.vite.config.ts  electron-builder.yml  tsconfig.json …
```

Dependency rule (enforced by review + lint config): `core` imports nothing from the other layers; `main` and `renderer` import from `core`; `main` and `renderer` never import each other.

---

## 5. Domain Model

All entities carry stable `id: string` (nanoid-style, generated in core). Sketches below are illustrative, not exhaustive; zod schemas in `core/model/` are the source of truth.

```ts
interface Campaign {
  id: string;
  schemaVersion: number;
  createdAt: string; // ISO timestamps throughout
  settings: CampaignSettings; // days total, debate days, counts (from MVP scope)
  day: number; // current day, 1-based
  phase: 'setup' | 'running' | 'electionDay' | 'finished';
  nation: Nation;
  parties: Party[]; // player's + rivals
  candidates: Candidate[]; // player's + rivals (playerCandidateId marks the player)
  playerCandidateId: string;
  councilors: CouncilorState; // positions, hired, candidate pool
  publicOpinion: OpinionState;
  surveys: Survey[];
  events: CampaignEvent[]; // incl. responses & applied effects
  debates: Debate[]; // incl. full exchange history
  influencers: Influencer[]; // + endorsements + generated content items
  missions: MissionState;
  chats: Record<string, ChatThread>; // councilorId → thread
  history: CampaignLogEntry[]; // compact chronological log (feeds context & epilogue)
  pendingJobs: GenerationJobDescriptor[]; // re-enqueued on load
  rngSeed: string; // seeded RNG for reproducible randomness
  result?: ElectionResult; // set on finish (incl. hidden-agenda evaluation)
}

interface Nation {
  name: string;
  description: string;
  flavor: string; // generated
  topicAreas: TopicArea[]; // fixed list per campaign
  states: NationState[];
}
interface NationState {
  id: string;
  name: string;
  description: string;
  cities: string[]; // flavor only
  populationWeight: number; // share of national electorate, sums to 1
  topicWeights: Record<TopicAreaId, number>; // how much this state cares, sums to 1
}

interface Party {
  id: string;
  name: string;
  code: string; // two-digit code
  colors: { main: string; secondary: string };
  publicAgenda: string;
  hiddenAgenda?: string; // present for the player; rivals have one too (generated)
  policies: Policy[]; // per topic area, generated from agendas
}
interface Policy {
  topicAreaId: TopicAreaId;
  title: string;
  summary: string;
}

interface Person {
  // base for all characters
  id: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
}
interface Candidate extends Person {
  partyId: string;
}
interface Councilor extends Person {
  politicalViews: string;
  personality: string;
  positionId: CouncilorPositionId;
  agendaMatch?: { publicScore: number; hiddenScore: number; commentary: string }; // generated
}
interface Influencer extends Person {
  domain: string;
  audience: string;
  reach: number; // reach: relative audience size
  stance?: { candidateId: string; kind: 'earned' | 'bought' };
}
```

### 5.1 Public opinion representation

The heart of the simulation. Per state × topic area × candidate, an **approval score** `0–100`:

```ts
interface OpinionState {
  // approval[stateId][topicAreaId][candidateId] = 0..100
  approval: Record<string, Record<string, Record<string, number>>>;
}
```

- **Initialization:** when the world is generated, the LLM rates each party's generated policies against each state's profile → seed approvals (bounded, validated).
- **Voting intention (derived, never stored):** for state `s`, candidate `c`:
  `score(s,c) = Σ_t topicWeights[s][t] × approval[s][t][c]`, then normalized across candidates to shares. National intention = `Σ_s populationWeight[s] × share(s,c)`.
- **Surveys** are snapshots of derived intention plus per-topic standings, with slight seeded sampling noise so consecutive surveys feel like polls, not telemetry.
- **Election day:** same derivation with a final small seeded noise per state (`±` a few points on shares), producing per-state results, national totals, and candidate ordering.

### 5.2 Opinion impacts (LLM as bounded referee)

Every opinion-moving act (debate exchange, event response, mission outcome, influencer content) resolves to a validated `OpinionImpact`:

```ts
interface OpinionImpact {
  targetCandidateId: string;
  deltas: Array<{ topicAreaId: string; delta: number }>; // each clamped to [-8, +8]
  regionalEmphasis?: Array<{ stateId: string; multiplier: number }>; // clamped [0.5, 2.0]
  rationale: string; // shown to the player
}
```

The core applies impacts deterministically: clamp → apply regional multipliers (default 1.0 elsewhere) → add small seeded noise → clamp scores to 0–100 → append a `CampaignLogEntry` with the rationale. **The player can always trace a survey movement to logged rationales** (PRD success criterion 3).

### 5.3 Randomness

A single seeded PRNG (stored `rngSeed` + derived stream positions in state) provides all randomness (event selection, noise, tie-breaks) so that a save reloads into an identical future given identical inputs.

---

## 6. LLM Engine Layer

### 6.1 Abstraction

```ts
interface LlmEngine {
  readonly providerId: 'ollama' | 'openrouter' | 'mock';
  listModels(): Promise<ModelInfo[]>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}
interface CompletionRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  expectJson?: boolean; // adapter may use provider-native JSON mode when available
}
```

### 6.2 Adapters

- **OllamaAdapter** — `POST /api/chat` (stream off), `GET /api/tags` for model listing; configurable base URL (default `http://localhost:11434`); uses Ollama's `format: 'json'` when `expectJson`.
- **OpenRouterAdapter** — OpenAI-compatible `POST /v1/chat/completions`; `GET /v1/models` for listing; requires API key; standard headers.
- **MockAdapter** — deterministic canned/templated outputs per job type. First-class citizen: enables offline development, fast full-game test runs, and CI without any model.

### 6.3 Engine settings

Stored in app settings (never in save files — **API keys must not enter saves**):

```ts
interface LlmSettings {
  activeProvider: 'ollama' | 'openrouter';
  ollama: { baseUrl: string; model: string };
  openrouter: { baseUrl: string; apiKey: string; model: string };
}
```

The Settings screen is reachable from anywhere at any time; the game requires a working configuration (validated via `testConnection`) before starting/continuing content generation, and prompts for it on first launch.

### 6.4 Structured output strategy

For jobs with structured results (impacts, characters, world data, suggestion lists):

1. Prompt includes a compact description of the expected JSON shape and one inline example.
2. `expectJson: true` lets adapters engage provider JSON modes.
3. Response is stripped of code fences, parsed, and **zod-validated**.
4. On failure: one **repair attempt** (re-prompt with the validation error and the invalid output), then one full retry; after that the job is marked `failed` and surfaced in the UI with a retry action.
5. Numeric fields are clamped by the core regardless of what validation passed — bounds live in one place (`core/generation/bounds.ts`).

---

## 7. Generation Queue

```ts
type JobPriority = 'interactive' | 'high' | 'background';
type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface GenerationJobDescriptor {
  id: string;
  type: JobType; // e.g. 'world.generate', 'party.policies', 'councilor.pool',
  // 'debate.question', 'debate.answerOptions', 'debate.evaluate',
  // 'event.generate', 'event.options', 'event.evaluate',
  // 'chat.reply', 'influencer.content', 'election.epilogue', …
  priority: JobPriority;
  payload: unknown; // typed per JobType (zod)
  status: JobStatus;
  attempts: number;
  error?: string;
}
```

- **Single worker, strict priority then FIFO.** One LLM request in flight at a time (local models are effectively serial anyway; keeps context pressure predictable). `interactive` jobs (the player is looking at a spinner, e.g., the debate question they must answer, a chat reply) preempt queue order — they are picked next, never mid-request aborts.
- **Results apply through commands.** A finished job dispatches an internal command (e.g., `applyGeneratedCouncilors`) through the same reducer path as player actions, then the state broadcast informs the UI. No side-channel state writes.
- **Persistence & idempotency.** `pendingJobs` (descriptors of `pending`/`failed` jobs, plus any `running` job re-marked `pending`) are part of the campaign snapshot. On load they are re-enqueued. Job handlers are idempotent with respect to state (applying checks the target still expects the content).
- **UI integration.** `queue:updated` events drive: a global unobtrusive "generating…" indicator, per-screen placeholders ("3 candidate profiles being prepared…"), and hard-wait states only where the PRD demands (debate flow). Failed jobs render with the error and a retry button.

---

## 8. Context Engineering

Every `JobType` has a **ContextBuilder** in `core/generation/`: a pure function `(campaign, payload) → { system, messages }`.

- **Budget:** models are assumed to have **32K-token** contexts. Policy: input ≤ **~12K tokens**, requested output ≤ **~2K** — comfortable margins for weaker local models. Token counts are estimated (`chars / 4` heuristic); builders receive a budget and **must** degrade gracefully (windowing, dropping optional sections) rather than overflow. A dev-mode warning logs any prompt exceeding budget.
- **Composition convention.** Prompts assemble named sections, most-important-first:
  1. **Style contract** — in-universe, grounded-with-satirical-edge tone, fictional-world rules (never reference the real world), output format.
  2. **World primer** — a compact (~200–400 token) standing summary of nation, parties, and race status, **precomputed and cached** in state, refreshed when the world materially changes.
  3. **Task focus** — exactly the entities the task is about (per the notes: a debate answer includes the speaking candidate's full profile + party platform; a councilor-pool job includes only party basics + public agenda — the hidden agenda is _not_ given to candidate-councilor generation, but _is_ given to the separate agenda-match evaluation).
  4. **Relevant memory** — windowed history slices: e.g., for debates, the last N exchanges of this debate + any prior statements by the involved candidates on the question's topic (selected from `history` by topic tag, newest first, budget-capped).
- **Hidden agenda discipline.** The hidden agenda enters a prompt only where the fiction justifies the writer knowing it (agenda-match evaluation, epilogue judgment, the player's own suggestion generation) — a per-JobType allowlist documented in code.

---

## 9. Game Flow Implementation

### 9.1 New campaign pipeline

1. Player writes candidate + party (+ agendas) → stored immediately.
2. Queue: `world.generate` (nation, states, topic weights) → `rivals.generate` (parties + candidates + hidden agendas) → `party.policies` (player's platform) → `opinion.seed` → `councilor.pool` (initial curriculums per position) → `influencers.generate`. Each step's UI shows progress; the player can review results as they land (setup is a natural "generation showcase").
3. Campaign enters `running` at day 1.

### 9.2 Day cycle (`day.end` command)

1. Resolve player mission assignments → per-mission `*.evaluate` jobs → impacts.
2. Rival simulation (lightweight): each rival takes one abstract action per day (chosen by seeded weighted heuristics over their agenda/weak topics); notable rival actions may generate log/news entries. Rivals do **not** get full symmetric LLM simulation per day — cost control; debates are where rivals get full LLM treatment.
3. Possibly spawn a random event (seeded chance) → `event.generate` + `event.options`.
4. If a scheduled survey day: compute + store survey.
5. Advance `day`; if final day → election resolution (§5.1) → `election.epilogue` job (vote result + hidden-agenda evaluation → epilogue text + advancement score).

Debate days insert the debate flow before the day can end.

### 9.3 Debate flow

A state machine on `Debate` (`{ rounds, currentTurn, exchanges }`): moderator topic (generated) → questioner asks (player: suggestions via `debate.question` options + free text; rival: generated, may reference history) → target answers (same duality) → `debate.evaluate` scores the exchange → impact applied + logged → next turn. The UI hard-waits (with clear indication) only on the content the current action needs, per the PRD.

### 9.4 Councilor chat

`chat.send` appends the player message, enqueues `chat.reply` (interactive priority) with a context of: style contract, world primer, councilor full profile, party agendas/policies (chats are the player's inner circle — hidden agenda allowed), campaign status line, and the last N messages of this thread. Threads auto-save with the campaign, and are excluded from all other builders' contexts (per notes: self-contained).

---

## 10. Persistence

- **Format:** one JSON file per save: `{ formatVersion, savedAt, meta: { name, day, candidateName, partyName }, campaign }`. zod-validated on load; unknown `formatVersion` → friendly error (no silent migration in MVP).
- **Location:** `userData/saves/` — which in dev is `<repo>/.dev-data/saves/` (§2.1). Unlimited slots: one file per save, listing = directory scan reading only `meta` cheaply.
- **App settings** (`LlmSettings`, UI prefs) in `userData/settings.json`, separate from saves.
- **Size monitoring:** save/load logs file size; the save list UI displays it. If sizes grow problematic (per notes) compression is a future, isolated change inside `PersistenceService`.

---

## 11. Renderer / UI

- **Structure:** a screen-level state machine (`MainMenu`, `Settings`, `NewCampaignWizard`, `CampaignHub`, `Councilors`, `Chat`, `Debate`, `Events`, `Surveys`, `Influencers`, `ElectionNight`, `Epilogue`) — plain conditional rendering from a `screen` field in the renderer store; no router dependency.
- **Renderer store:** `{ campaign, queue, settings, screen }`, updated exclusively from IPC events/queries; user interactions call the preload API and never mutate locally (optimistic UI unnecessary at this scale).
- **Styling:** handcrafted CSS with custom properties. The player party's `main`/`secondary` colors theme the campaign screens (accents, headers) — the "your campaign brand" feel from the PRD, cheaply. Dark, editorial, text-forward aesthetic; system font stack; generous typography since reading is the core activity.
- **Async affordances (house pattern):** every screen that can have pending content renders one of: inline skeleton + "being prepared" label (browsable lists), a progress panel (setup pipeline), or a blocking wait card with animated indicator (debate). All driven by `queue:updated`, implemented once as shared components.

---

## 12. Testing & Quality

- **Core is the test surface:** opinion math (derivations, clamping, determinism with fixed seed), command reducers, day resolution, debate state machine, vote simulation, context builders (budget respected, hidden-agenda allowlist honored, correct sections present), output schema parsing incl. repair-path fixtures.
- **Queue tests** with a scripted fake engine (ordering, priorities, failure/retry, persistence round-trip).
- **Full-campaign smoke test:** drive a whole campaign programmatically over the MockAdapter — creation → days → debate → election — asserting it reaches `finished` with a valid result. This is the cheap guarantee of PRD success criterion 1.
- **Static gates:** `tsc --noEmit`, ESLint, Prettier check — all runnable via npm scripts; no CI infrastructure in this phase.

---

## 13. Project Documentation (living)

- **README.md** — concise: what the game is, prerequisites, `npm install`, `npm run dev`, `npm run build:appimage`, where dev data lives.
- **AGENTS.md** — instructions for coding agents: layering rules (§4), "everything generated goes through the queue", bounded-LLM-output rule, where schemas/contracts live, style conventions, test expectations, and the host-cleanliness constraint.
- **ARCHITECTURE.md** — the live document of axioms and invariants (essentially §1 plus the state-flow and queue diagrams, kept current as the code evolves). Not a folder-by-folder tour.

Maintenance rule: a change that alters an invariant must update `ARCHITECTURE.md` in the same commit.

---

## 14. Build & Run

```
npm install            # project-local; no global tools
npm run dev            # electron-vite dev with HMR (uses .dev-data/)
npm run test           # vitest
npm run lint / format  # quality gates
npm run build:appimage # electron-builder → dist/ (Linux AppImage only)
```

`electron-builder.yml` targets `AppImage` for `linux` only; no code signing, auto-update, or other platforms in this phase.

---

## 15. Risks & Mitigations

| Risk                                        | Mitigation                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Small local models produce malformed JSON   | JSON mode + repair loop + retry (§6.4); bounded schemas kept small and flat; MockAdapter for structure-independent development.                 |
| Generation latency makes the loop feel dead | Queue + background prefetch (e.g., councilor pool refreshes, next debate question pre-generated while the player reads); honest UI wait states. |
| Context overflow on long campaigns          | Hard budgets per builder with graceful degradation; windowed history; precomputed world primer; dev warnings on overflow.                       |
| LLM referee scores feel arbitrary           | Tight delta bounds, visible rationales in the campaign log, deterministic application — bad calls are at least legible and small.               |
| Save files balloon (chat + debate history)  | Full-snapshot policy kept (per notes), sizes surfaced in UI, compression isolated behind `PersistenceService` if needed later.                  |
| Provider API drift (Ollama/OpenRouter)      | Thin adapters, contract tests with recorded fixtures, everything else provider-agnostic.                                                        |

---

## 16. Deferred to Stage 3 (MVP Scope)

- All gameplay quantities: campaign length, debate count/cadence, states, rivals, topic areas, councilor positions, pool sizes, survey cadence, event frequency.
- Which full-vision features are cut or thinned for MVP (candidates: missions depth, influencer economy, policy editing, rival memory depth).
- Default models to recommend per provider, temperature defaults per job type.
- Exact epilogue scoring rubric.
