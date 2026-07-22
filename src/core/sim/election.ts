import { BOUNDS } from '../model/constants';
import type { Campaign, ElectionResult } from '../model/schemas';
import { addLog } from './log';
import { computeShares } from './opinion';
import type { Rng } from './rng';

/** Simulate the final vote: derived shares plus small election-day noise. */
export function computeElectionResult(campaign: Campaign, rng: Rng): ElectionResult {
  const shares = computeShares(campaign, rng, BOUNDS.electionNoise);
  const ordering = Object.entries(shares.national)
    .sort((a, b) => b[1] - a[1])
    .map(([candidateId]) => candidateId);
  const winnerId = ordering[0];
  const winner = campaign.candidates.find((c) => c.id === winnerId);
  addLog(campaign, {
    kind: 'system',
    text: winner
      ? `Election day: ${winner.name} wins the presidency with ${(shares.national[winnerId] * 100).toFixed(1)}% of the national vote.`
      : 'Election day concluded.',
    candidateId: winnerId,
  });
  return {
    stateResults: shares.byState,
    national: shares.national,
    ordering,
    winnerId,
  };
}
