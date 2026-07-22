/**
 * Lightweight rival simulation: one abstract action per rival per day, chosen
 * by seeded heuristics. Rivals get full LLM treatment only in debates.
 */
import { BOUNDS, TOPIC_AREA_BY_ID } from '../model/constants';
import { clamp, getNationStates, rivalCandidates } from '../model/queries';
import type { Campaign } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import { addLog } from './log';
import { addApproval, nationalTopicApproval } from './opinion';
import type { Rng } from './rng';

/** Each rival shores up their nationally weakest topic or works a big state. */
export function resolveRivalActions(campaign: Campaign, rng: Rng): string[] {
  const outcomes: string[] = [];
  const topicApproval = nationalTopicApproval(campaign);
  for (const rival of rivalCandidates(campaign)) {
    const amount = clamp(
      BOUNDS.rivalActionBase + rng.range(-BOUNDS.rivalActionSwing, BOUNDS.rivalActionSwing),
      0.2,
      3,
    );
    if (rng.chance(0.5)) {
      const weakestTopic = [...TOPIC_AREA_IDS].sort(
        (a, b) => (topicApproval[a]?.[rival.id] ?? 0) - (topicApproval[b]?.[rival.id] ?? 0),
      )[0];
      addApproval(campaign, rival.id, weakestTopic, amount);
      if (rng.chance(0.5)) {
        const line = `${rival.name} spent the day defending their record on ${TOPIC_AREA_BY_ID[weakestTopic].name.toLowerCase()}.`;
        outcomes.push(line);
        addLog(campaign, { kind: 'rival', text: line, candidateId: rival.id });
      }
    } else {
      const states = getNationStates(campaign);
      if (states.length === 0) continue;
      const state = rng.chance(0.6)
        ? [...states].sort((a, b) => b.populationWeight - a.populationWeight)[0]
        : rng.pick(states);
      const topTopic = [...TOPIC_AREA_IDS].sort(
        (a, b) => state.topicWeights[b] - state.topicWeights[a],
      )[0];
      addApproval(campaign, rival.id, topTopic, amount, [state.id]);
      if (rng.chance(0.5)) {
        const line = `${rival.name} toured ${state.name}, hammering on ${TOPIC_AREA_BY_ID[topTopic].name.toLowerCase()}.`;
        outcomes.push(line);
        addLog(campaign, { kind: 'rival', text: line, candidateId: rival.id });
      }
    }
  }
  return outcomes;
}
