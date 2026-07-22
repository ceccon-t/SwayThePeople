# Sway The People! — MVP Scope

**Status:** Agreed v1
**Stage:** 3 of 4 (PRD → Technical Specification → **MVP Scope** → Implementation)
**Companions:** `PRD.md` (full product vision), `TECHSPEC.md` (how it's built). This document fixes the finite scope of the first playable version: the gameplay quantities, which features ship at full strength, which ship thinned, and which are explicitly deferred.

Guiding rule: **every PRD success criterion must be provable in a single 1–2 sitting playthrough**, with a total LLM call count that keeps the game fluid even on a local 8B model.

---

## 1. Gameplay Quantities

| Parameter           | Value                                                                    | Notes                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign length     | **14 days**                                                              | Deliberately short for MVP iteration speed — lets us run many full campaigns to tune what works. Full-length campaigns are a post-MVP change; the value lives in `CampaignSettings` so extending it later is data, not code. |
| Debates             | **2** — days 5 and 12                                                    | Early debate to learn the system; late debate as the climax, with history to weaponize.                                                                                                                                      |
| Rival candidates    | **3** (4 candidates total)                                               |                                                                                                                                                                                                                              |
| States              | **5**, 2–3 flavor cities each                                            |                                                                                                                                                                                                                              |
| Topic areas         | **6, fixed**: Economy, Security, Health, Education, Culture, Environment | Fixed across campaigns in MVP (not generated): stable schemas, comparable campaigns.                                                                                                                                         |
| Councilor positions | **3**: Campaign Manager, Communications Chief, Policy Advisor            | One hire per position; pool of 3 curriculums per position, topped up in background by the queue.                                                                                                                             |
| Influencers         | **6** per campaign                                                       | Mix of alignments so some are contestable.                                                                                                                                                                                   |
| Surveys             | Day-1 baseline, then **every 3 days**, plus eve of election              |                                                                                                                                                                                                                              |
| Events              | **~2 of every 3 non-debate days** (seeded chance)                        | Event-free days keep event days feeling like news.                                                                                                                                                                           |

## 2. In — Full Strength

- Candidate creation (name, age, gender, bio).
- Party creation: name, two-digit code, main + secondary colors, public and hidden agendas.
- Generated party platform (policies per topic area) — reviewable, not editable.
- Procedural world: nation, 5 states with topic weights and flavor cities, 3 rival parties + candidates (with their own generated hidden agendas).
- Councilor hiring/firing from generated curriculums, with agenda-match commentary (public + discreet hidden-agenda fit).
- Councilor chat: free-form, in-character, auto-saved, self-contained.
- Debates: suggestions + always-available free text, LLM refereeing with visible rationales, persistent campaign memory (rivals can quote your past statements and vice versa).
- Per-state public opinion across the 6 topic areas; derived voting intentions; periodic surveys.
- Random events with generated response options + free text, LLM-evaluated impact.
- Election night: per-state results, national ordering, small seeded noise.
- Hidden-agenda epilogue: end-only LLM evaluation → advancement score (0–100) with justification + narrative epilogue.
- Save/load, unlimited slots, full-snapshot saves (pending generation jobs included).
- LLM providers: Ollama + OpenRouter + Mock (dev/test), configurable at any time.

## 3. In — Thinned

### Missions

Each day the player assigns each hired councilor (up to 3) one mission from a fixed menu:

1. **Campaign in state X** — boost player approval in that state.
2. **Promote topic Y** — boost player approval on that topic nationally.
3. **Court influencer Z** — attempt to earn their support (deterministic alignment score decides).
4. **Debate prep** — bonus modifier to the player's next debate evaluations.

Mission outcomes are **deterministic baseline effects ± a small seeded random swing** (no per-mission LLM call). One LLM call per day generates the **daily campaign report**, narrating all mission outcomes and rival activity in-fiction.

### Influencers

- **Earned support only** — courting via mission; success from deterministic agenda/profile alignment.
- Commitment (the 0–100 affinity toward the player's party) keeps being tracked after an endorsement: courting a supporter again deepens it toward 100. Past a threshold, a supporter's content may carry a subtle, seeded-random hint of the player's hidden agenda — the deeper the commitment, the likelier the hint.
- A supporting influencer produces one content item every 2–3 days (1 LLM call each): textual description of a post/mention/rant, moving opinion with their audience.
- Content feed screen shows the player's supporters' content and notable rival-aligned content.

### Debates (cost shape)

- 2 rounds per debate; every candidate asks 1 question per round → 8 exchanges per debate.
- Player-involved exchanges: full treatment (generated question/answer suggestion lists, free text allowed, separate evaluation call).
- Rival-only exchanges: **one LLM call per exchange** (question + answer + impact together).
- ≈16 LLM calls per debate; next content prefetched while the player reads.

### Rival simulation (per TECHSPEC §9.2)

One abstract heuristic action per rival per day (seeded, agenda-weighted); full LLM treatment only in debates. Notable rival actions surface in the daily report.

## 4. Cut — Explicitly Deferred

- **Any monetary mechanics**: campaign funds, buying influencer support, paid propaganda.
- Policy editing after generation.
- Alliances with rival candidates (hidden-agenda alignment still matters via councilors and the epilogue).
- Mid-campaign hidden-agenda progress tracking (end-only evaluation).
- City-level mechanics (cities are flavor text).
- Scandals/leaks, image/audio generation, multiplayer, non-Linux platforms, auto-update (per PRD non-goals).

## 5. Defaults & Tuning Values

- **Model selection UI:** the model field is a **filterable list populated from the provider's list-models API** (Ollama `/api/tags`, OpenRouter `/v1/models`) — typing filters by case-insensitive substring (e.g., "llama"). No free-text model entry; a model must come from the provider's list. The UI shows recommended picks for reference: Ollama → `llama3.1:8b`, `qwen2.5:7b-instruct`; OpenRouter → a couple of mid-tier instruct models, marked in the list when present.
- **Temperatures:** creative content ≈ 0.9 · referee/evaluation ≈ 0.3 · structured world-gen ≈ 0.7.
- **Opinion bounds (TECHSPEC §5.2):** per-topic deltas clamped to [−8, +8]; regional multipliers [0.5, 2.0]; mission baselines small (≈1–3 points) ± seeded swing (≈±1).
- **Starting-field fairness:** once every candidate's initial opinion is seeded, per-candidate approvals are uniformly shifted so the spread in weighted national approval between the strongest and weakest candidate is at most **10 points** (`initialApprovalGapMax`) — a 14-day campaign cannot recover a runaway head start. Revisit when campaign-length options land.
- **Councilor fit floor:** agenda-match scores (public and hidden) are floored at **50** (`councilorMatchFloor`) — applicants are presented as pre-screened. Provisional; likely revisited.
- **Influencer commitment:** courting an already-supporting influencer deepens commitment by **10** per mission (`courtSupporterGain`); above commitment **70** (`influencerHintThreshold`) each new content item hints at the hidden agenda with probability rising linearly to 1 at commitment 100.
- **Epilogue rubric:** LLM receives hidden agenda + compact campaign log + election result + the player's day-1 → election-day national standing → `{ advancementScore: 0–100, justification, epilogue }`; the hidden agenda is judged as a _post-election_ design (how well positioned it now is), and the epilogue must address the campaign's public-opinion arc; all shown on the final screen.

## 6. LLM Call Budget (per full campaign)

Setup ~12–15 · ordinary day ~2–3 · debate ~16 each · endgame ~2 → **≈90–110 calls total**. At ~15 s/call (local 8B) ≈ 25 min of generation spread across the playthrough, mostly hidden by the queue; negligible time/cost on OpenRouter.

## 7. Definition of Done (MVP)

1. A full campaign — creation → 14 days → 2 debates → election night → epilogue — is playable end-to-end on Ollama and OpenRouter, and completes automatically over the MockAdapter (smoke test).
2. Save/load round-trips at any point, including with pending generation jobs.
3. Surveys visibly respond to debates, events, missions, and influencer content, with rationales traceable in the campaign log.
4. Hiring shows agenda-match commentary; the epilogue's hidden-agenda judgment reflects the campaign actually played.
5. Every screen with pending content shows the house async pattern (skeleton / progress / blocking wait) — no dead ends, no silent freezes.
6. `README.md`, `AGENTS.md`, `ARCHITECTURE.md` exist and match reality; lint, typecheck, and tests pass; `npm run dev` and the Linux AppImage build work from a clean clone with only project-local state.
