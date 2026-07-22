# Sway The People! — Product Requirements Document

**Status:** Draft v1
**Stage:** 1 of 4 (PRD → Technical Specification → MVP Scope → Implementation)

This document describes _Sway The People!_ as a product: what the game is, who it is for, and what the player experiences. It intentionally avoids technical detail — architecture, data models, and implementation choices belong to the Technical Specification. Where this document describes the full game vision, it does not imply everything ships in the first version; the MVP Scope document will define the initial cut.

---

## 1. Vision

_Sway The People!_ is a single-player political simulation game about running for president of a fictional nation. The player creates a candidate and a party, defines what they publicly stand for — and what they _secretly_ want — assembles a team of councilors, and campaigns against a field of AI-generated rival candidates. Over a turn-based campaign, the player fights for public opinion through debates, staff missions, reactions to unfolding events, and the courting of celebrities and influencers, until election day decides the outcome.

What makes the game distinctive is that **a large language model is the game's content engine**. The country, its states and cities, the rival parties and candidates, the councilors' résumés, the debate questions and answers, the news events, the influencer posts — all of it is generated to fit the specific scenario the player created. No two campaigns tell the same story, and the world reacts in-fiction to whatever agendas, policies, and personalities the player brings to it.

### Design pillars

1. **Your campaign, your story.** Player-authored agendas and characters are the seed of everything; the generated world bends around them rather than slotting them into canned content.
2. **Public opinion is the battlefield.** Every meaningful action exists to move opinion across topic areas and regions; surveys make the fight legible; election day settles it.
3. **Two faces of politics.** The tension between the public platform and the hidden agenda colors who joins you, who allies with you, how content is written, and how the ending judges you.
4. **Grounded, with a satirical edge.** The simulation plays it straight and believable, but the fiction has room for the absurdity of real politics to surface naturally — pompous rivals, opportunistic influencers, events that are funny because they are plausible.

### What the game is not

- Not a governance simulator: the game covers the campaign and ends at the election result (a brief epilogue at most).
- Not tied to real-world politics: all people, parties, and places are fictional and procedurally generated.
- Not a real-time or graphics-driven game: it is menu-driven and text-first, presented with clean, attractive styling.

---

## 2. Player & Experience

### Target player

Fans of political/government strategy and management sims, narrative sims, and emergent-story games — players who enjoy expressive character creation, reading and writing text, and watching systems react to their choices. Comfortable with a text-heavy, menu-driven interface.

### Player fantasy

**You are the candidate.** Not an abstract manager: you write your own bio, you stand at the debate podium, you answer the hostile question in your own words, and the crowd judges _you_. Your staff advises and executes, but the face on the poster is yours.

### Session shape

A campaign is a complete playthrough: setup (candidate, party, team) followed by a fixed-length, turn-based campaign (one turn = one day) ending on election day. Campaigns can be saved and resumed at any point, with unlimited save slots, so a playthrough can span many sessions. Because content is AI-generated and some of it takes time to produce, the game is designed so the player is rarely blocked waiting: pending content is generated in the background and screens indicate when something is still "being prepared."

### Tone & content stance

Grounded political fiction with satirical latitude. Generated content should feel like it belongs in a believable (fictional) democracy — sharp, characterful, occasionally funny — not cartoonish parody, and never referencing real politicians, parties, or countries.

---

## 3. The World

Every campaign takes place in a **procedurally generated fictional nation**: its name, character, states, and notable cities are created for that campaign, along with the field of rival parties and candidates. The nation's flavor (its economy, culture, anxieties) informs generated content everywhere — events feel like _this_ country's news, and regional opinion reflects _these_ states' character.

### Geography and regional opinion

- The nation is divided into a small set of **states** (each with generated identity and a few notable cities as flavor).
- **Public opinion is tracked per state**, across the national topic areas. States differ: an industrial state cares more about the economy; a border state about security.
- The final election aggregates the popular vote across states, so a candidate must think about _where_ their message lands, not only what it is.

### Topic areas

Public opinion is structured around a fixed set of national **topic areas** — e.g., Economy, Security, Health, Education, Culture, Environment (exact list defined during design). Each candidate has a perceived position and strength in each area; each state weighs areas differently. Debates, events, missions, and influencer content all move opinion through these areas.

---

## 4. Core Game Flow

```
Create candidate → Create party & agendas → (World generated) → Hire councilors
        → CAMPAIGN LOOP (one turn = one day) → Election day → Results & epilogue
```

### 4.1 Candidate creation

The player creates their candidate with a **name, age, gender, and short bio**. The bio is free text and is treated as canon: generated content (debate answers offered to the player, how rivals attack them, how the press describes them) reflects who this person is.

### 4.2 Party & agenda creation

The player founds a party with:

- **Name** — free text, often an abbreviation-style name.
- **Code** — a two-digit code that prefixes all of the party's candidates.
- **Colors** — a main and secondary color, used throughout the UI to brand the campaign.
- **Public agenda** — what the party openly stands for, written by the player as free text.
- **Hidden agenda** — what the candidate/party _actually_ wants, also free text, known only to the player (and to those close enough to sense it).

From the agendas, the game generates the party's **official policies** across the topic areas — a fleshed-out platform expanding the player's raw input into a coherent program the player can review (and, in the full vision, edit and refine).

**Hidden agendas matter in three ways:**

1. **Alignment** — potential councilors, and potential allies among rival candidates, fit (or clash with) the hidden agenda; building a team that truly serves your real goal is part of the strategy.
2. **Judgment** — the ending evaluates not only whether you won the vote, but how much the campaign advanced your hidden agenda.
3. **Flavor** — generated content subtly reflects the double game: a careful reader can feel the undercurrent in the campaign's messaging and characters.

### 4.3 Building the team — councilors

Councilors are advisors filling defined **positions** (e.g., Economy Advisor, Communications Chief — exact roster defined during design), one person per position. For each open position the player browses a list of generated **curriculums** — each candidate councilor has a name, age, gender, short bio, political views, and personality — and hires one. Hiring is exclusive: to replace a councilor, the player must fire the current one first. New candidate profiles are generated over time, so the pool refreshes as the campaign progresses.

The game surfaces how well each potential councilor **matches the party's agendas** — including, discreetly, the hidden one — making hiring a judgment call rather than a stat comparison.

### 4.4 Councilor discussions

Any hired councilor can be talked to at any time in a **free-form chat**: the councilor responds in character, informed by their personality and political views, the party's agendas and policies, and the state of the campaign. Discussions are for immersion, advice, and thinking out loud — they are automatically saved per councilor, but self-contained (they don't feed back into other game systems).

### 4.5 The campaign loop

The campaign runs a fixed number of days. Each day, the player:

1. **Reviews the situation** — current surveys, recent events, pending content.
2. **Assigns activities** — directs councilors, party resources, and propaganda efforts on missions (e.g., campaign in a state, court an influencer, shore up a weak topic area).
3. **Reacts to events** — random, scenario-flavored events (news stories, gaffes, crises, opportunities) demand a response; the player picks from generated options or writes their own, and the response's quality and fit move public opinion.
4. **Participates in scheduled debates** — on designated days (see below).
5. **Ends the day** — results resolve; opinion shifts; the world advances. Rival candidates act too: they run their own campaigns, respond to events, and can reference past debates and reactions.

Along the campaign, periodic **surveys** show voting intentions and opinion per topic area and per state — the player's scoreboard and compass.

### 4.6 Debates

Debates are the campaign's marquee events and its biggest opinion movers. A debate is a moderated panel with the player and rival candidates:

- Each candidate gets a set number of **questions to ask** and must **answer questions** directed at them.
- When the player asks or answers, the game offers a list of **generated suggestions** in the candidate's voice — but the player can always write **free text** instead.
- Rivals ask and answer in character, driven by their own agendas and personalities.
- The game **evaluates each exchange** — pointedness of the question, quality and fit of the answer, consistency with the candidate's platform — and shifts public opinion accordingly.
- **Debates have memory.** Questions asked, answers given, and past event reactions are remembered for the rest of the campaign: a rival can quote your own words back at you, and you can do the same to them.

### 4.7 Celebrities & influencers

The nation has generated **celebrities and influencers**, each with their own profile and audience. Candidates can **earn or buy** their support. A supporting figure produces content over time — described textually (an Instagram-style post, a talk-show mention, a podcast rant) — written to fit both the figure's voice and the campaign's message, and moving opinion with their audience. The player can browse all content generated by their supporters (and see notable content from rivals' supporters).

### 4.8 Election day & results

The campaign ends in a **simulated national vote** driven by the final state of public opinion per state, with a small randomized factor — close races can swing. Results show the full ordering of candidates, per-state outcomes, and the winner. The **epilogue** reflects both the electoral result and the hidden agenda: winning the presidency while abandoning what you truly wanted reads differently than losing the vote but bending the national conversation toward your real goal.

---

## 5. AI-Generated Content (as product)

The LLM is not a gimmick bolted on — it is the reason the game exists. As a product requirement:

- **Coverage.** Generated content includes: world/geography flavor, rival parties and candidates, party policies expanded from agendas, councilor curriculums, councilor chat, debate questions/answers/suggestions, event descriptions and response options, evaluation of outcomes (how much an action moves opinion and why), influencer content, survey commentary, and the epilogue.
- **In-universe fidelity.** All content must stay in-fiction: right names, right voices, consistent with established facts of the campaign (agendas, history, prior statements).
- **Judgment, not just prose.** The LLM also acts as referee — scoring debate exchanges and event responses for their effect on opinion — so outcomes reflect what was actually said, not just which button was pressed.
- **Player choice of engine.** The player configures which AI engine powers the game — a local one (their own machine) or a hosted one (their own API key) — before any content is needed, and can change this configuration at any time while playing. The game runs on the player's chosen engine; there is no game-operated content service.
- **Graceful asynchrony.** Content generation can be slow. The game generates in the background and keeps the player informed: screens show when content is still being prepared, and the player is only ever hard-blocked when the next action genuinely requires the pending content (e.g., awaiting the debate question they must answer).

---

## 6. Feature Summary

### Full-vision feature list

| Area      | Feature                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| Setup     | Candidate creation (name, age, gender, bio)                                             |
| Setup     | Party creation (name, code, colors, public & hidden agendas)                            |
| Setup     | Policy generation from agendas, per topic area                                          |
| World     | Procedural nation, states, cities; rival parties & candidates                           |
| Team      | Councilor hiring from generated curriculums, one per position; firing/replacement       |
| Team      | Agenda-match evaluation of potential councilors (incl. hidden agenda)                   |
| Team      | Free-form councilor chat, auto-saved                                                    |
| Loop      | Turn-based days: assign missions, react to events, review surveys                       |
| Loop      | Random scenario-flavored events with generated response options + free text             |
| Loop      | Regional (per-state) public opinion across topic areas; periodic surveys                |
| Debates   | Panel debates: ask & answer, suggestions + free text, LLM refereeing, persistent memory |
| Influence | Celebrities & influencers: earn/buy support, generated content feed                     |
| Endgame   | Simulated vote (per-state, small randomness), results, hidden-agenda-aware epilogue     |
| Meta      | Save/load campaigns, unlimited slots                                                    |
| Meta      | AI engine configuration (local or hosted, player-supplied), changeable anytime          |

### Explicit non-goals (this generation of the product)

- No images, 3D, audio, or AI image generation — text and styled UI only.
- No multiplayer.
- No post-election governance gameplay.
- No real-world political content.
- Desktop only; Linux is the initial platform.

---

## 7. Success Criteria

The product succeeds, at MVP and beyond, if:

1. **A full campaign is playable end-to-end** — from candidate creation to election results — without dead ends.
2. **Two campaigns feel different.** Changing the candidate, agendas, or scenario visibly changes the world, the rivals, the debates, and the story.
3. **Choices legibly matter.** The player can trace a debate answer or event response to a movement in the surveys.
4. **The double game lands.** Players report that the hidden agenda changed how they hired, allied, and played — and that the epilogue's judgment felt earned.
5. **Waiting never feels broken.** Background generation is visible and understandable; the player always knows whether they can act now or are waiting on content.
6. **It reads well.** Generated text consistently feels in-world, in-voice, and worth reading.

---

## 8. Open Questions (to resolve in later stages)

- Campaign length (number of days) and debate cadence — needs playtesting; likely a short default for MVP.
- Exact roster of councilor positions and list of topic areas.
- Number of states and rival candidates per campaign (balance between richness and generation cost).
- How "earning vs. buying" influencer support is resourced (campaign funds? actions?) — the economy of the campaign is intentionally under-specified here.
- Whether policies are player-editable after generation in the MVP or fixed once generated.
- How much rival-candidate simulation happens per day (full symmetric simulation vs. lightweight approximation).
