/** Read-only lookups and small utilities shared across the core. */
import type { Campaign, Candidate, Councilor, NationState, Party } from './schemas';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getCandidate(campaign: Campaign, candidateId: string): Candidate {
  const candidate = campaign.candidates.find((c) => c.id === candidateId);
  if (!candidate) throw new Error(`Unknown candidate: ${candidateId}`);
  return candidate;
}

export function getParty(campaign: Campaign, partyId: string): Party {
  const party = campaign.parties.find((p) => p.id === partyId);
  if (!party) throw new Error(`Unknown party: ${partyId}`);
  return party;
}

export function getPlayerCandidate(campaign: Campaign): Candidate {
  return getCandidate(campaign, campaign.playerCandidateId);
}

export function getPlayerParty(campaign: Campaign): Party {
  return getParty(campaign, campaign.playerPartyId);
}

export function getCandidateParty(campaign: Campaign, candidateId: string): Party {
  return getParty(campaign, getCandidate(campaign, candidateId).partyId);
}

export function getNationStates(campaign: Campaign): NationState[] {
  return campaign.nation?.states ?? [];
}

export function getNationState(campaign: Campaign, stateId: string): NationState {
  const state = getNationStates(campaign).find((s) => s.id === stateId);
  if (!state) throw new Error(`Unknown state: ${stateId}`);
  return state;
}

export function getHiredCouncilor(campaign: Campaign, positionId: string): Councilor | null {
  return campaign.councilors.hired[positionId] ?? null;
}

export function rivalCandidates(campaign: Campaign): Candidate[] {
  return campaign.candidates.filter((c) => c.id !== campaign.playerCandidateId);
}

/** Case-insensitive, whitespace-tolerant name lookup for LLM-provided names. */
export function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const needle = name.trim().toLowerCase();
  return (
    items.find((item) => item.name.trim().toLowerCase() === needle) ??
    items.find(
      (item) =>
        item.name.toLowerCase().includes(needle) || needle.includes(item.name.toLowerCase()),
    )
  );
}
