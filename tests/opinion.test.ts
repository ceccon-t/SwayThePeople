import { describe, expect, it } from 'vitest';
import { BOUNDS } from '@core/model/constants';
import { TOPIC_AREA_IDS } from '@core/model/schemas';
import { applyImpact, compressInitialApproval, computeShares } from '@core/sim/opinion';
import { computeElectionResult } from '@core/sim/election';
import { Rng } from '@core/sim/rng';
import { makeMinimalCampaign } from './helpers';

describe('opinion math', () => {
  it('derived shares sum to 1 per state and nationally', () => {
    const campaign = makeMinimalCampaign();
    const shares = computeShares(campaign, null, 0);
    for (const stateShares of Object.values(shares.byState)) {
      const total = Object.values(stateShares).reduce((sum, v) => sum + v, 0);
      expect(total).toBeCloseTo(1, 6);
    }
    expect(Object.values(shares.national).reduce((sum, v) => sum + v, 0)).toBeCloseTo(1, 6);
  });

  it('clamps LLM-proposed deltas to the bound', () => {
    const campaign = makeMinimalCampaign();
    const playerId = campaign.playerCandidateId;
    const before = campaign.opinion.approval['state-a'].economy[playerId];
    applyImpact(
      campaign,
      {
        targetCandidateId: playerId,
        deltas: [{ topicAreaId: 'economy', delta: 500 }],
        rationale: 'test',
      },
      new Rng(1),
    );
    const after = campaign.opinion.approval['state-a'].economy[playerId];
    // Bound is 8, noise is ±0.5.
    expect(after - before).toBeLessThanOrEqual(8.5);
    expect(after - before).toBeGreaterThanOrEqual(7.5);
  });

  it('clamps approval to 0..100 and respects regional emphasis', () => {
    const campaign = makeMinimalCampaign();
    const playerId = campaign.playerCandidateId;
    campaign.opinion.approval['state-a'].economy[playerId] = 99;
    applyImpact(
      campaign,
      {
        targetCandidateId: playerId,
        deltas: [{ topicAreaId: 'economy', delta: 8 }],
        regionalEmphasis: [{ stateId: 'state-b', multiplier: 0.5 }],
        rationale: 'test',
      },
      new Rng(2),
    );
    expect(campaign.opinion.approval['state-a'].economy[playerId]).toBeLessThanOrEqual(100);
    const bDelta = campaign.opinion.approval['state-b'].economy[playerId] - 50;
    expect(bDelta).toBeLessThan(5); // halved by emphasis (plus small noise)
  });

  it('election is deterministic given identical rng state', () => {
    const a = makeMinimalCampaign();
    const b = structuredClone(a);
    const resultA = computeElectionResult(a, new Rng(42));
    const resultB = computeElectionResult(b, new Rng(42));
    expect(resultA.national).toEqual(resultB.national);
    expect(resultA.winnerId).toBe(resultB.winnerId);
  });

  it('compresses starting approval spread to the configured gap', () => {
    const campaign = makeMinimalCampaign();
    const playerId = campaign.playerCandidateId;
    // Player far ahead everywhere: 80 vs the rival's 40.
    for (const state of ['state-a', 'state-b']) {
      for (const topicId of TOPIC_AREA_IDS) {
        campaign.opinion.approval[state][topicId][playerId] = 80;
        campaign.opinion.approval[state][topicId]['rival-1'] = 40;
      }
    }
    compressInitialApproval(campaign);
    const strength = (candidateId: string): number => {
      let total = 0;
      for (const state of campaign.nation!.states) {
        for (const topicId of TOPIC_AREA_IDS) {
          total +=
            state.populationWeight *
            state.topicWeights[topicId] *
            campaign.opinion.approval[state.id][topicId][candidateId];
        }
      }
      return total;
    };
    const gap = strength(playerId) - strength('rival-1');
    expect(gap).toBeCloseTo(BOUNDS.initialApprovalGapMax, 5);
    // Midpoint preserved: both pulled symmetrically toward 60.
    expect(strength(playerId)).toBeCloseTo(60 + BOUNDS.initialApprovalGapMax / 2, 5);
  });

  it('leaves an already-close starting field untouched', () => {
    const campaign = makeMinimalCampaign(); // everyone at 50
    const before = structuredClone(campaign.opinion);
    compressInitialApproval(campaign);
    expect(campaign.opinion).toEqual(before);
  });

  it('weighted topics move state outcomes', () => {
    const campaign = makeMinimalCampaign();
    const playerId = campaign.playerCandidateId;
    // Alphaland weighs economy at 0.4: an economy edge should matter more there.
    for (const state of ['state-a', 'state-b']) {
      campaign.opinion.approval[state].economy[playerId] = 80;
    }
    const shares = computeShares(campaign, null, 0);
    expect(shares.byState['state-a'][playerId]).toBeGreaterThan(
      shares.byState['state-b'][playerId],
    );
  });
});
