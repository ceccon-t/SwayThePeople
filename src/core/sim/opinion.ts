/**
 * Public-opinion math. Approval (0–100) per state × topic × candidate is the
 * stored truth; voting-intention shares are always derived, never stored
 * (except as survey/election snapshots).
 */
import { BOUNDS } from '../model/constants';
import { clamp, getNationStates } from '../model/queries';
import type { Campaign, OpinionImpact, TopicNumbers } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import type { Rng } from './rng';

/** Seed one candidate's approval across all states from generated ratings. */
export function seedCandidateApproval(
  campaign: Campaign,
  candidateId: string,
  topicScores: TopicNumbers,
  stateAffinity: Record<string, number>,
): void {
  for (const state of getNationStates(campaign)) {
    const affinity = clamp(stateAffinity[state.id] ?? 50, 0, 100);
    const byTopic = (campaign.opinion.approval[state.id] ??= {});
    for (const topicId of TOPIC_AREA_IDS) {
      const byCandidate = (byTopic[topicId] ??= {});
      const blended = 0.65 * clamp(topicScores[topicId], 0, 100) + 0.35 * affinity;
      byCandidate[candidateId] = clamp(blended, 0, 100);
    }
  }
}

export function isCandidateSeeded(campaign: Campaign, candidateId: string): boolean {
  const states = getNationStates(campaign);
  if (states.length === 0) return false;
  const firstState = campaign.opinion.approval[states[0].id];
  return firstState?.[TOPIC_AREA_IDS[0]]?.[candidateId] !== undefined;
}

/** A candidate's overall standing: population- and topic-weighted approval. */
function weightedNationalApproval(campaign: Campaign, candidateId: string): number {
  const states = getNationStates(campaign);
  const totalPop = states.reduce((sum, s) => sum + s.populationWeight, 0) || 1;
  let score = 0;
  for (const state of states) {
    for (const topicId of TOPIC_AREA_IDS) {
      score +=
        (state.populationWeight / totalPop) *
        state.topicWeights[topicId] *
        (campaign.opinion.approval[state.id]?.[topicId]?.[candidateId] ?? 0);
    }
  }
  return score;
}

/**
 * Compress seeded starting approvals so the spread between the strongest and
 * weakest candidate never exceeds `initialApprovalGapMax`: a short campaign
 * cannot recover a huge head start, and a race decided on day 1 is no game.
 * Each candidate keeps their per-state/per-topic shape; only a uniform offset
 * pulls them toward the field's midpoint.
 */
export function compressInitialApproval(campaign: Campaign): void {
  const strengths = campaign.candidates.map((candidate) => ({
    candidateId: candidate.id,
    strength: weightedNationalApproval(campaign, candidate.id),
  }));
  if (strengths.length < 2) return;
  const values = strengths.map((s) => s.strength);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread <= BOUNDS.initialApprovalGapMax) return;
  const midpoint = (Math.max(...values) + Math.min(...values)) / 2;
  const scale = BOUNDS.initialApprovalGapMax / spread;
  for (const { candidateId, strength } of strengths) {
    const offset = midpoint + (strength - midpoint) * scale - strength;
    for (const state of getNationStates(campaign)) {
      for (const topicId of TOPIC_AREA_IDS) {
        const byCandidate = campaign.opinion.approval[state.id]?.[topicId];
        if (!byCandidate || byCandidate[candidateId] === undefined) continue;
        byCandidate[candidateId] = clamp(byCandidate[candidateId] + offset, 0, 100);
      }
    }
  }
}

/** Direct approval bump (missions, rival actions) — already deterministic. */
export function addApproval(
  campaign: Campaign,
  candidateId: string,
  topicAreaId: string,
  amount: number,
  stateIds?: string[],
): void {
  const targets = stateIds ?? getNationStates(campaign).map((s) => s.id);
  for (const stateId of targets) {
    const byCandidate = campaign.opinion.approval[stateId]?.[topicAreaId];
    if (!byCandidate || byCandidate[candidateId] === undefined) continue;
    byCandidate[candidateId] = clamp(byCandidate[candidateId] + amount, 0, 100);
  }
}

export interface ApplyImpactOptions {
  /** Scale applied to positive deltas (debate-prep bonus). */
  positiveScale?: number;
}

/**
 * Apply an LLM-proposed impact: clamp deltas and multipliers, add small seeded
 * noise per state, clamp resulting approval to 0–100.
 */
export function applyImpact(
  campaign: Campaign,
  impact: OpinionImpact,
  rng: Rng,
  options: ApplyImpactOptions = {},
): void {
  const positiveScale = options.positiveScale ?? 1;
  const emphasis = new Map(
    (impact.regionalEmphasis ?? []).map((entry) => [
      entry.stateId,
      clamp(entry.multiplier, BOUNDS.regionalMultiplierMin, BOUNDS.regionalMultiplierMax),
    ]),
  );
  for (const { topicAreaId, delta } of impact.deltas) {
    let bounded = clamp(delta, -BOUNDS.topicDeltaMax, BOUNDS.topicDeltaMax);
    if (bounded > 0) bounded *= positiveScale;
    for (const state of getNationStates(campaign)) {
      const multiplier = emphasis.get(state.id) ?? 1;
      const noise = rng.range(-BOUNDS.impactNoise, BOUNDS.impactNoise);
      const byCandidate = campaign.opinion.approval[state.id]?.[topicAreaId];
      if (!byCandidate || byCandidate[impact.targetCandidateId] === undefined) continue;
      byCandidate[impact.targetCandidateId] = clamp(
        byCandidate[impact.targetCandidateId] + bounded * multiplier + noise,
        0,
        100,
      );
    }
  }
}

export interface Shares {
  /** stateId → candidateId → share (0–1). */
  byState: Record<string, Record<string, number>>;
  /** candidateId → national share (0–1). */
  national: Record<string, number>;
}

/**
 * Derive voting-intention shares. `noise` (± points on each state score)
 * models polling error / election-day swing; pass 0 for the exact reading.
 */
export function computeShares(campaign: Campaign, rng: Rng | null, noise: number): Shares {
  const byState: Record<string, Record<string, number>> = {};
  const national: Record<string, number> = {};
  const states = getNationStates(campaign);
  const totalPop = states.reduce((sum, s) => sum + s.populationWeight, 0) || 1;

  for (const state of states) {
    const scores: Record<string, number> = {};
    let total = 0;
    for (const candidate of campaign.candidates) {
      let score = 0;
      for (const topicId of TOPIC_AREA_IDS) {
        const approval = campaign.opinion.approval[state.id]?.[topicId]?.[candidate.id] ?? 0;
        score += state.topicWeights[topicId] * approval;
      }
      if (rng && noise > 0) score += rng.range(-noise, noise);
      score = Math.max(score, 0.01);
      scores[candidate.id] = score;
      total += score;
    }
    byState[state.id] = {};
    for (const candidate of campaign.candidates) {
      const share = scores[candidate.id] / total;
      byState[state.id][candidate.id] = share;
      national[candidate.id] =
        (national[candidate.id] ?? 0) + (state.populationWeight / totalPop) * share;
    }
  }
  return { byState, national };
}

/** National approval per topic (population-weighted state average). */
export function nationalTopicApproval(campaign: Campaign): Record<string, Record<string, number>> {
  const states = getNationStates(campaign);
  const totalPop = states.reduce((sum, s) => sum + s.populationWeight, 0) || 1;
  const result: Record<string, Record<string, number>> = {};
  for (const topicId of TOPIC_AREA_IDS) {
    result[topicId] = {};
    for (const candidate of campaign.candidates) {
      let sum = 0;
      for (const state of states) {
        sum +=
          (state.populationWeight / totalPop) *
          (campaign.opinion.approval[state.id]?.[topicId]?.[candidate.id] ?? 0);
      }
      result[topicId][candidate.id] = sum;
    }
  }
  return result;
}
