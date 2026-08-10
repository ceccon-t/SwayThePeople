/**
 * Nation packages: the shareable, player-independent description of a nation —
 * the country and its states, plus optionally its political landscape (rival
 * parties and candidates), their baseline public opinion, and its influencer
 * scene. A campaign is created either from a package or with a null nation
 * that the generation queue then fills (world.generate).
 *
 * Sections beyond the nation core are optional: whatever a package omits is
 * simply generated for each campaign, because needs derivation already treats
 * "missing content" as work to do. Packages are untrusted input (bundled
 * today; player-authored and downloaded files later), so instantiation runs
 * every value through the same normalization and clamps as LLM output.
 */
import { z } from 'zod';
import { clamp } from '../model/queries';
import { clampAge, normalizeWeights, uniquePartyCode } from '../model/sanitize';
import type { Campaign, TopicNumbers } from '../model/schemas';
import { TOPIC_AREA_IDS, topicNumbersSchema } from '../model/schemas';
import { seedCandidateApproval } from '../sim/opinion';
import { addLog } from '../sim/log';
import type { Rng } from '../sim/rng';

export const NATION_PACKAGE_FORMAT_VERSION = 1;

const packageStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  cities: z.array(z.string()).default([]),
  /** Relative weight; normalized against the other states at instantiation. */
  populationWeight: z.number().positive(),
  /** Relative per-topic weights; normalized at instantiation. */
  topicWeights: topicNumbersSchema,
});

const packagePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string(),
  colors: z.object({ main: z.string(), secondary: z.string() }),
  publicAgenda: z.string().min(1),
  hiddenAgenda: z.string().min(1),
});

const packageCandidateSchema = z.object({
  id: z.string().min(1),
  partyId: z.string().min(1),
  name: z.string().min(1),
  age: z.number(),
  gender: z.string(),
  bio: z.string(),
});

const packageInfluencerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  age: z.number(),
  gender: z.string(),
  bio: z.string(),
  domain: z.string(),
  audience: z.string(),
  reach: z.number(),
  /** partyId (within this package) → 0–100 affinity. */
  partyAffinity: z.record(z.string(), z.number()).default({}),
});

const packageOpinionEntrySchema = z.object({
  topicScores: topicNumbersSchema,
  /** stateId (within this package) → 0–100 affinity. */
  stateAffinities: z.record(z.string(), z.number()).default({}),
});

export const nationPackageSchema = z
  .object({
    formatVersion: z.literal(NATION_PACKAGE_FORMAT_VERSION),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    states: z.array(packageStateSchema).min(3),
    /** The nation's political landscape: the parties the player will run against. */
    parties: z.array(packagePartySchema).min(1).optional(),
    candidates: z.array(packageCandidateSchema).min(1).optional(),
    /** candidateId → baseline standing; candidates without one get polled. */
    initialOpinion: z.record(z.string(), packageOpinionEntrySchema).optional(),
    influencers: z.array(packageInfluencerSchema).min(1).optional(),
  })
  .superRefine((pkg, ctx) => {
    const seen = new Set<string>();
    const requireUnique = (id: string, what: string): void => {
      if (seen.has(id)) ctx.addIssue({ code: 'custom', message: `Duplicate ${what} id: ${id}` });
      seen.add(id);
    };
    for (const state of pkg.states) requireUnique(state.id, 'state');
    for (const party of pkg.parties ?? []) requireUnique(party.id, 'party');
    for (const candidate of pkg.candidates ?? []) requireUnique(candidate.id, 'candidate');
    for (const influencer of pkg.influencers ?? []) requireUnique(influencer.id, 'influencer');

    // Parties and candidates come as a matched set: one candidate per party.
    const partyIds = new Set((pkg.parties ?? []).map((p) => p.id));
    const candidates = pkg.candidates ?? [];
    if ((pkg.parties === undefined) !== (pkg.candidates === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'parties and candidates must be provided together' });
    }
    if (pkg.parties && candidates.length !== pkg.parties.length) {
      ctx.addIssue({ code: 'custom', message: 'each party must have exactly one candidate' });
    }
    const candidateParties = new Set<string>();
    for (const candidate of candidates) {
      if (!partyIds.has(candidate.partyId)) {
        ctx.addIssue({ code: 'custom', message: `Unknown partyId: ${candidate.partyId}` });
      }
      if (candidateParties.has(candidate.partyId)) {
        ctx.addIssue({ code: 'custom', message: `Two candidates for party ${candidate.partyId}` });
      }
      candidateParties.add(candidate.partyId);
    }

    const candidateIds = new Set(candidates.map((c) => c.id));
    const stateIds = new Set(pkg.states.map((s) => s.id));
    for (const [candidateId, entry] of Object.entries(pkg.initialOpinion ?? {})) {
      if (!candidateIds.has(candidateId)) {
        ctx.addIssue({
          code: 'custom',
          message: `initialOpinion for unknown candidate ${candidateId}`,
        });
      }
      for (const stateId of Object.keys(entry.stateAffinities)) {
        if (!stateIds.has(stateId)) {
          ctx.addIssue({ code: 'custom', message: `stateAffinities for unknown state ${stateId}` });
        }
      }
    }
    for (const influencer of pkg.influencers ?? []) {
      for (const partyId of Object.keys(influencer.partyAffinity)) {
        if (!partyIds.has(partyId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Influencer ${influencer.id} rates unknown party ${partyId}`,
          });
        }
      }
    }
  });
export type NationPackage = z.infer<typeof nationPackageSchema>;

/** Preview shown when choosing a nation (and later in package browsers). */
export interface NationPackageInfo {
  id: string;
  name: string;
  description: string;
  stateNames: string[];
  partyNames: string[];
  influencerCount: number;
}

export function describeNationPackage(pkg: NationPackage): NationPackageInfo {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    stateNames: pkg.states.map((s) => s.name),
    partyNames: (pkg.parties ?? []).map((p) => p.name),
    influencerCount: pkg.influencers?.length ?? 0,
  };
}

/**
 * Materialize a validated package into a freshly created campaign (player
 * party and candidate already present, everything else empty). Derives the
 * settings counts from the package so needs derivation sees provided sections
 * as complete and generates only what the package omitted.
 */
export function instantiateNationPackage(campaign: Campaign, pkg: NationPackage, rng: Rng): void {
  const populationWeights = normalizeWeights(pkg.states.map((s) => s.populationWeight));
  campaign.nation = {
    name: pkg.name,
    description: pkg.description,
    states: pkg.states.map((state, index) => {
      const weightValues = normalizeWeights(TOPIC_AREA_IDS.map((t) => state.topicWeights[t]));
      const topicWeights = Object.fromEntries(
        TOPIC_AREA_IDS.map((t, j) => [t, weightValues[j]]),
      ) as TopicNumbers;
      return {
        id: state.id,
        name: state.name,
        description: state.description,
        cities: state.cities.slice(0, 3),
        populationWeight: populationWeights[index],
        topicWeights,
      };
    }),
  };
  campaign.nationRef = {
    kind: 'package',
    packageId: pkg.id,
    packageFormatVersion: pkg.formatVersion,
  };
  campaign.settings.stateCount = pkg.states.length;

  // The player founded their party knowing nothing of this nation's ballot:
  // on a code collision the package rival is re-coded, the player's stays.
  for (const party of pkg.parties ?? []) {
    campaign.parties.push({
      id: party.id,
      name: party.name,
      code: uniquePartyCode(campaign, party.code, rng),
      colors: { main: party.colors.main, secondary: party.colors.secondary },
      publicAgenda: party.publicAgenda,
      hiddenAgenda: party.hiddenAgenda,
      policies: [],
    });
  }
  for (const candidate of pkg.candidates ?? []) {
    campaign.candidates.push({
      id: candidate.id,
      partyId: candidate.partyId,
      name: candidate.name,
      age: clampAge(candidate.age),
      gender: candidate.gender,
      bio: candidate.bio,
    });
  }
  if (pkg.candidates) campaign.settings.rivalCount = pkg.candidates.length;

  // Package influencers know the package parties; their affinity toward the
  // player's party does not exist yet — the influencers.affinity job fills it.
  for (const influencer of pkg.influencers ?? []) {
    const partyAffinity: Record<string, number> = {};
    for (const [partyId, affinity] of Object.entries(influencer.partyAffinity)) {
      partyAffinity[partyId] = clamp(affinity, 0, 100);
    }
    campaign.influencers.push({
      id: influencer.id,
      name: influencer.name,
      age: clampAge(influencer.age),
      gender: influencer.gender,
      bio: influencer.bio,
      domain: influencer.domain,
      audience: influencer.audience,
      reach: clamp(influencer.reach, 1, 100),
      partyAffinity,
      contentLog: [],
    });
  }
  if (pkg.influencers) campaign.settings.influencerCount = pkg.influencers.length;

  for (const [candidateId, entry] of Object.entries(pkg.initialOpinion ?? {})) {
    if (!campaign.candidates.some((c) => c.id === candidateId)) continue;
    const topicScores = Object.fromEntries(
      TOPIC_AREA_IDS.map((t) => [t, clamp(entry.topicScores[t], 0, 100)]),
    ) as TopicNumbers;
    const stateAffinities: Record<string, number> = {};
    for (const [stateId, affinity] of Object.entries(entry.stateAffinities)) {
      stateAffinities[stateId] = clamp(affinity, 0, 100);
    }
    seedCandidateApproval(campaign, candidateId, topicScores, stateAffinities);
    (campaign.initialOpinion ??= {})[candidateId] = { topicScores, stateAffinities };
  }

  addLog(campaign, {
    kind: 'system',
    text: `The race opens in ${pkg.name}: ${pkg.states.map((s) => s.name).join(', ')}.`,
  });
}
