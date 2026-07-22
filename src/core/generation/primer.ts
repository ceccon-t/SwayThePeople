/**
 * The world primer: a compact standing summary of the campaign included in
 * most prompts. Assembled deterministically from state (no LLM involved).
 */
import { TOPIC_AREA_BY_ID } from '../model/constants';
import { getCandidateParty, getPlayerCandidate } from '../model/queries';
import type { Campaign } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import { truncateToTokens } from './budget';

export function worldPrimer(campaign: Campaign): string {
  const lines: string[] = [];
  if (campaign.nation) {
    lines.push(
      `NATION: ${campaign.nation.name} — ${truncateToTokens(campaign.nation.description, 80)}`,
    );
    lines.push(
      `STATES: ${campaign.nation.states
        .map((s) => `${s.name} (top concern: ${TOPIC_AREA_BY_ID[topTopic(s.topicWeights)].name})`)
        .join('; ')}`,
    );
  }
  lines.push(`TOPIC AREAS: ${TOPIC_AREA_IDS.map((id) => TOPIC_AREA_BY_ID[id].name).join(', ')}`);
  for (const candidate of campaign.candidates) {
    const party = getCandidateParty(campaign, candidate.id);
    const isPlayer = candidate.id === campaign.playerCandidateId ? ' [the player]' : '';
    lines.push(
      `CANDIDATE: ${candidate.name}${isPlayer}, ${candidate.age}, ${party.name} (${party.code}) — stands for: ${truncateToTokens(party.publicAgenda, 40)}`,
    );
  }
  if (campaign.phase === 'running' || campaign.phase === 'finished') {
    lines.push(
      `RACE: day ${campaign.day} of ${campaign.settings.totalDays}.${latestStandings(campaign)}`,
    );
  }
  return lines.join('\n');
}

function topTopic(weights: Record<string, number>): (typeof TOPIC_AREA_IDS)[number] {
  return [...TOPIC_AREA_IDS].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];
}

function latestStandings(campaign: Campaign): string {
  const survey = campaign.surveys[campaign.surveys.length - 1];
  if (!survey) return '';
  const standings = Object.entries(survey.national)
    .sort((a, b) => b[1] - a[1])
    .map(([candidateId, share]) => {
      const name = campaign.candidates.find((c) => c.id === candidateId)?.name ?? '?';
      return `${name} ${(share * 100).toFixed(0)}%`;
    })
    .join(', ');
  return ` Latest survey: ${standings}.`;
}

/** The player candidate + party block used when content speaks for the player. */
export function playerProfileBlock(campaign: Campaign, includeHiddenAgenda: boolean): string {
  const candidate = getPlayerCandidate(campaign);
  const party = getCandidateParty(campaign, candidate.id);
  const lines = [
    `YOUR CANDIDATE: ${candidate.name}, ${candidate.age}, ${candidate.gender}. ${candidate.bio}`,
    `PARTY: ${party.name} (code ${party.code}). Public agenda: ${party.publicAgenda}`,
  ];
  if (party.policies.length > 0) {
    lines.push(
      `PLATFORM: ${party.policies
        .map((p) => `${TOPIC_AREA_BY_ID[p.topicAreaId].name}: ${p.title}`)
        .join('; ')}`,
    );
  }
  if (includeHiddenAgenda) {
    lines.push(
      `HIDDEN AGENDA (known only to the inner circle, never to be stated openly): ${party.hiddenAgenda}`,
    );
  }
  return lines.join('\n');
}
