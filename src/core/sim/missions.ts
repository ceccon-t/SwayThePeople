/**
 * Daily mission resolution: deterministic baselines ± a small seeded swing.
 * No LLM involvement — the daily report narrates these outcomes afterwards.
 */
import { BOUNDS, COUNCILOR_POSITION_BY_ID, TOPIC_AREA_BY_ID } from '../model/constants';
import { clamp, getNationState, getPlayerCandidate } from '../model/queries';
import type { Campaign, CouncilorPositionId, MissionAssignment } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import { addLog } from './log';
import { endorsesPlayer, playerCommitment, rollHiddenAgendaHint } from './influencers';
import { addApproval } from './opinion';
import type { Rng } from './rng';

function swing(rng: Rng): number {
  return rng.range(-BOUNDS.missionSwing, BOUNDS.missionSwing);
}

/** Two topics this state cares most about. */
function topStateTopics(campaign: Campaign, stateId: string): string[] {
  const state = getNationState(campaign, stateId);
  return [...TOPIC_AREA_IDS]
    .sort((a, b) => state.topicWeights[b] - state.topicWeights[a])
    .slice(0, 2);
}

function resolveOne(
  campaign: Campaign,
  rng: Rng,
  positionId: CouncilorPositionId,
  assignment: MissionAssignment,
): string {
  const player = getPlayerCandidate(campaign);
  const councilor = campaign.councilors.hired[positionId];
  const who = councilor ? councilor.name : COUNCILOR_POSITION_BY_ID[positionId].title;

  switch (assignment.type) {
    case 'campaignState': {
      const state = getNationState(campaign, assignment.stateId);
      const amount = clamp(BOUNDS.missionCampaignStateBase + swing(rng), 0.2, 4);
      for (const topicId of topStateTopics(campaign, state.id)) {
        addApproval(campaign, player.id, topicId, amount, [state.id]);
      }
      return `${who} ran ground operations in ${state.name}, lifting the campaign's standing there (+${amount.toFixed(1)} on the state's key topics).`;
    }
    case 'promoteTopic': {
      const topic = TOPIC_AREA_BY_ID[assignment.topicAreaId];
      const amount = clamp(BOUNDS.missionPromoteTopicBase + swing(rng), 0.2, 4);
      addApproval(campaign, player.id, assignment.topicAreaId, amount);
      return `${who} pushed the campaign's message on ${topic.name} nationwide (+${amount.toFixed(1)} across all states).`;
    }
    case 'courtInfluencer': {
      const influencer = campaign.influencers.find((i) => i.id === assignment.influencerId);
      if (!influencer) return `${who} tried to reach an influencer, but the contact fell through.`;
      if (influencer.endorsement) {
        if (!endorsesPlayer(campaign, influencer)) {
          return `${who} met ${influencer.name}, who already backs a rival — nothing came of it.`;
        }
        // A supporter can still be courted: it deepens their commitment.
        const commitment = playerCommitment(campaign, influencer);
        if (commitment >= 100) {
          return `${who} checked in on ${influencer.name}, whose commitment to the campaign could not run deeper (100/100).`;
        }
        const deepened = clamp(commitment + BOUNDS.courtSupporterGain, 0, 100);
        influencer.partyAffinity[campaign.playerPartyId] = deepened;
        return `${who} spent the day deepening ties with ${influencer.name} — their commitment to the campaign rose to ${Math.round(deepened)}/100.`;
      }
      const affinity = influencer.partyAffinity[campaign.playerPartyId] ?? 50;
      const roll = affinity + rng.range(-BOUNDS.courtRollSpread, BOUNDS.courtRollSpread);
      if (roll >= BOUNDS.courtThreshold) {
        influencer.endorsement = { candidateId: player.id, kind: 'earned', sinceDay: campaign.day };
        influencer.nextContentDay = campaign.day + 1;
        influencer.nextContentHintsHidden = rollHiddenAgendaHint(campaign, influencer, rng);
        return `${who} won over ${influencer.name} (${influencer.domain}) — they now openly support the campaign.`;
      }
      influencer.partyAffinity[campaign.playerPartyId] = clamp(
        affinity + BOUNDS.courtFailAffinityGain,
        0,
        100,
      );
      return `${who} courted ${influencer.name} without sealing an endorsement, but left a good impression.`;
    }
    case 'debatePrep': {
      campaign.missions.debatePrepBonus += 1;
      return `${who} ran debate preparation drills — the candidate will be sharper on stage.`;
    }
  }
}

/** Resolve all assigned missions for the current day; returns outcome lines. */
export function resolveMissions(campaign: Campaign, rng: Rng): string[] {
  const outcomes: string[] = [];
  for (const [positionId, assignment] of Object.entries(campaign.missions.assignments)) {
    if (!assignment) continue;
    if (!campaign.councilors.hired[positionId]) continue;
    const outcome = resolveOne(campaign, rng, positionId as CouncilorPositionId, assignment);
    outcomes.push(outcome);
    addLog(campaign, { kind: 'mission', text: outcome });
  }
  campaign.missions.assignments = {};
  return outcomes;
}
