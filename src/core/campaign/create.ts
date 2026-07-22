import { COUNCILOR_POSITION_IDS } from '../model/schemas';
import type { Campaign } from '../model/schemas';
import { DEFAULT_CAMPAIGN_SETTINGS } from '../model/constants';
import { newId } from '../model/ids';
import { hashSeed } from '../sim/rng';
import { z } from 'zod';

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
});
export type NewCampaignInput = z.infer<typeof newCampaignInputSchema>;

export function createCampaign(input: NewCampaignInput): Campaign {
  const partyId = newId('party');
  const candidateId = newId('cand');
  const campaignId = newId('camp');
  return {
    id: campaignId,
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    settings: { ...DEFAULT_CAMPAIGN_SETTINGS },
    phase: 'setup',
    day: 0,
    rngState: hashSeed(`${campaignId}:${input.candidate.name}:${input.party.name}`),
    nation: null,
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
}
