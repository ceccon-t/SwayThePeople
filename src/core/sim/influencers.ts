/**
 * Influencer commitment mechanics. An influencer's affinity toward the
 * player's party keeps mattering after they endorse: it becomes their
 * commitment level, courting deepens it, and past a threshold their content
 * may start hinting at the hidden agenda (seeded roll, odds rising with
 * commitment).
 */
import { BOUNDS } from '../model/constants';
import type { Campaign, Influencer } from '../model/schemas';
import type { Rng } from './rng';

/** 0–100 warmth/commitment toward the player's party. */
export function playerCommitment(campaign: Campaign, influencer: Influencer): number {
  return influencer.partyAffinity[campaign.playerPartyId] ?? 50;
}

export function endorsesPlayer(campaign: Campaign, influencer: Influencer): boolean {
  return influencer.endorsement?.candidateId === campaign.playerCandidateId;
}

/**
 * Decide whether this influencer's NEXT content item hints at the player's
 * hidden agenda: impossible below the commitment threshold, then increasingly
 * likely as commitment approaches 100. Call whenever the next content is
 * scheduled, so the decision always reflects current commitment.
 */
export function rollHiddenAgendaHint(
  campaign: Campaign,
  influencer: Influencer,
  rng: Rng,
): boolean {
  if (!endorsesPlayer(campaign, influencer)) return false;
  const threshold = BOUNDS.influencerHintThreshold;
  const commitment = playerCommitment(campaign, influencer);
  if (commitment < threshold) return false;
  return rng.chance((commitment - threshold) / (100 - threshold));
}
