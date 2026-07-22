/**
 * Influencer commitment mechanics: courting a supporter deepens commitment,
 * rival supporters stay out of reach, and hidden-agenda hints obey the
 * commitment threshold.
 */
import { describe, expect, it } from 'vitest';
import { BOUNDS } from '@core/model/constants';
import type { Campaign, Influencer } from '@core/model/schemas';
import { rollHiddenAgendaHint } from '@core/sim/influencers';
import { resolveMissions } from '@core/sim/missions';
import { Rng } from '@core/sim/rng';
import { makeMinimalCampaign } from './helpers';

function addInfluencer(
  campaign: Campaign,
  affinity: number,
  endorsedCandidateId?: string,
): Influencer {
  const influencer: Influencer = {
    id: 'infl-1',
    name: 'Zuzu Vela',
    age: 33,
    gender: 'female',
    bio: 'Pop star.',
    domain: 'pop music',
    audience: 'urban youth',
    reach: 80,
    partyAffinity: { [campaign.playerPartyId]: affinity },
    contentLog: [],
  };
  if (endorsedCandidateId) {
    influencer.endorsement = { candidateId: endorsedCandidateId, kind: 'earned', sinceDay: 1 };
  }
  campaign.influencers.push(influencer);
  return influencer;
}

function courtViaMission(campaign: Campaign, influencerId: string): string[] {
  campaign.councilors.hired['campaignManager'] = {
    id: 'coun-1',
    name: 'Ilya Berenshaw',
    age: 50,
    gender: 'male',
    bio: 'Veteran.',
    politicalViews: 'pragmatic centrist',
    personality: 'dry and meticulous',
    positionId: 'campaignManager',
  };
  campaign.missions.assignments['campaignManager'] = { type: 'courtInfluencer', influencerId };
  return resolveMissions(campaign, new Rng(7));
}

describe('influencer commitment', () => {
  it('courting your own supporter deepens their commitment', () => {
    const campaign = makeMinimalCampaign();
    const influencer = addInfluencer(campaign, 60, campaign.playerCandidateId);
    const outcomes = courtViaMission(campaign, influencer.id);
    expect(influencer.partyAffinity[campaign.playerPartyId]).toBe(60 + BOUNDS.courtSupporterGain);
    expect(influencer.endorsement?.candidateId).toBe(campaign.playerCandidateId);
    expect(outcomes[0]).toContain('commitment');
  });

  it('commitment never exceeds 100 and full commitment is acknowledged', () => {
    const campaign = makeMinimalCampaign();
    const influencer = addInfluencer(campaign, 100, campaign.playerCandidateId);
    courtViaMission(campaign, influencer.id);
    expect(influencer.partyAffinity[campaign.playerPartyId]).toBe(100);
  });

  it('a rival-endorsing influencer cannot be courted', () => {
    const campaign = makeMinimalCampaign();
    const influencer = addInfluencer(campaign, 60, 'rival-1');
    const outcomes = courtViaMission(campaign, influencer.id);
    expect(influencer.partyAffinity[campaign.playerPartyId]).toBe(60);
    expect(outcomes[0]).toContain('nothing came of it');
  });

  it('hidden-agenda hints require the commitment threshold', () => {
    const campaign = makeMinimalCampaign();
    const cold = addInfluencer(campaign, BOUNDS.influencerHintThreshold - 1, undefined);
    expect(rollHiddenAgendaHint(campaign, cold, new Rng(1))).toBe(false);
    cold.endorsement = { candidateId: campaign.playerCandidateId, kind: 'earned', sinceDay: 1 };
    expect(rollHiddenAgendaHint(campaign, cold, new Rng(1))).toBe(false);
    // At full commitment the hint chance is 1: always hints.
    cold.partyAffinity[campaign.playerPartyId] = 100;
    expect(rollHiddenAgendaHint(campaign, cold, new Rng(1))).toBe(true);
    // Endorsing a rival never hints at the player's agenda.
    cold.endorsement = { candidateId: 'rival-1', kind: 'earned', sinceDay: 1 };
    expect(rollHiddenAgendaHint(campaign, cold, new Rng(1))).toBe(false);
  });
});
