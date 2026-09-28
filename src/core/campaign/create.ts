import { COUNCILOR_POSITION_IDS } from '../model/schemas';
import type { Campaign } from '../model/schemas';
import { DEFAULT_CAMPAIGN_SETTINGS } from '../model/constants';
import { newId } from '../model/ids';
import { hashSeed, Rng } from '../sim/rng';
import { instantiateNationPackage } from '../nation/package';
import type { NationPackage } from '../nation/package';
import { z } from 'zod';

/**
 * How the campaign gets its nation; absent means 'generate' (back-compat).
 * 'package' names a bundled default; 'imported' names a package file the
 * player opened during this session (a separate namespace, so an exported
 * default can never shadow the bundled one).
 */
export const nationChoiceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('generate') }),
  z.object({ mode: z.literal('package'), packageId: z.string().min(1) }),
  z.object({ mode: z.literal('imported'), packageId: z.string().min(1) }),
]);
export type NationChoice = z.infer<typeof nationChoiceSchema>;

export const newCampaignInputSchema = z.object({
  candidate: z.object({
    name: z.string().min(1),
    age: z.number().int().min(18).max(99),
    gender: z.string().min(1),
    bio: z.string().min(1),
  }),
  party: z.object({
    name: z.string().min(1),
    code: z.string().regex(/^\d{2}$/, 'Party code must be exactly two digits'),
    colors: z.object({ main: z.string(), secondary: z.string() }),
    publicAgenda: z.string().min(1),
    hiddenAgenda: z.string().min(1),
  }),
  nation: nationChoiceSchema.optional(),
});
export type NewCampaignInput = z.infer<typeof newCampaignInputSchema>;

/**
 * Build a new campaign in setup phase. With a nation package the world (and
 * whatever landscape the package carries) exists from the first frame and the
 * queue only generates what is missing; without one, the nation starts null
 * and world.generate invents it around the player's candidacy.
 */
export function createCampaign(input: NewCampaignInput, nationPackage?: NationPackage): Campaign {
  const partyId = newId('party');
  const candidateId = newId('cand');
  const campaignId = newId('camp');
  const campaign: Campaign = {
    id: campaignId,
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    settings: { ...DEFAULT_CAMPAIGN_SETTINGS },
    phase: 'setup',
    day: 0,
    rngState: hashSeed(`${campaignId}:${input.candidate.name}:${input.party.name}`),
    nation: null,
    nationRef: { kind: 'generated' },
    parties: [
      {
        id: partyId,
        name: input.party.name,
        code: input.party.code,
        colors: input.party.colors,
        publicAgenda: input.party.publicAgenda,
        hiddenAgenda: input.party.hiddenAgenda,
        policies: [],
      },
    ],
    candidates: [
      {
        id: candidateId,
        partyId,
        name: input.candidate.name,
        age: input.candidate.age,
        gender: input.candidate.gender,
        bio: input.candidate.bio,
      },
    ],
    playerPartyId: partyId,
    playerCandidateId: candidateId,
    councilors: {
      hired: Object.fromEntries(COUNCILOR_POSITION_IDS.map((id) => [id, null])),
      pool: Object.fromEntries(COUNCILOR_POSITION_IDS.map((id) => [id, []])),
    },
    influencers: [],
    opinion: { approval: {} },
    surveys: [],
    events: [],
    debates: [],
    chats: {},
    missions: { assignments: {}, debatePrepBonus: 0 },
    days: [],
    log: [],
  };
  if (nationPackage) {
    const rng = new Rng(campaign.rngState);
    instantiateNationPackage(campaign, nationPackage, rng);
    campaign.rngState = rng.state;
  }
  return campaign;
}
