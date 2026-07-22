/**
 * Debate structure and progression. A debate is a fixed speaking order of
 * questioners (each candidate once per round); exchanges are created one at a
 * time. Rival questioners get their exchange created automatically (seeded
 * target choice); when it is the player's turn, the exchange waits for the
 * player to choose a target.
 */
import { newId } from '../model/ids';
import { getNationStates } from '../model/queries';
import type { Campaign, Debate, DebateExchange } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import { computeShares } from './opinion';
import type { Rng } from './rng';

export function createDebate(campaign: Campaign, rng: Rng, day: number): Debate {
  const candidateIds = campaign.candidates.map((c) => c.id);
  const order: string[] = [];
  for (let round = 0; round < campaign.settings.debateRounds; round++) {
    order.push(...rng.shuffle(candidateIds));
  }
  const debate: Debate = {
    id: newId('debate'),
    day,
    rounds: campaign.settings.debateRounds,
    order,
    exchanges: [],
    status: 'active',
  };
  campaign.debates.push(debate);
  ensureDebateProgress(campaign, debate, rng);
  return debate;
}

export function activeDebate(campaign: Campaign): Debate | undefined {
  return campaign.debates.find((d) => d.status === 'active');
}

export function currentExchange(debate: Debate): DebateExchange | undefined {
  const last = debate.exchanges[debate.exchanges.length - 1];
  return last && !last.evaluation ? last : undefined;
}

/** Whose turn is it to open the next exchange (undefined = debate complete). */
export function nextQuestionerId(debate: Debate): string | undefined {
  if (currentExchange(debate)) return undefined;
  return debate.order[debate.exchanges.length];
}

export function roundOfExchange(debate: Debate, exchangeIndex: number): number {
  return Math.floor(exchangeIndex / (debate.order.length / debate.rounds)) + 1;
}

function pickRivalTarget(campaign: Campaign, rng: Rng, questionerId: string): string {
  const others = campaign.candidates.filter((c) => c.id !== questionerId);
  if (rng.chance(0.6)) {
    const { national } = computeShares(campaign, null, 0);
    return others.sort((a, b) => (national[b.id] ?? 0) - (national[a.id] ?? 0))[0].id;
  }
  return rng.pick(others).id;
}

export function createExchange(
  debate: Debate,
  rng: Rng,
  questionerId: string,
  targetId: string,
): DebateExchange {
  const exchange: DebateExchange = {
    id: newId('xchg'),
    round: roundOfExchange(debate, debate.exchanges.length),
    topicAreaId: rng.pick(TOPIC_AREA_IDS),
    questionerId,
    targetId,
  };
  debate.exchanges.push(exchange);
  return exchange;
}

/**
 * Advance the debate as far as deterministic rules allow: auto-create the
 * next exchange while the next questioner is a rival; finish the debate when
 * all exchanges are evaluated.
 */
export function ensureDebateProgress(campaign: Campaign, debate: Debate, rng: Rng): void {
  if (debate.status !== 'active') return;
  if (currentExchange(debate)) return;
  if (debate.exchanges.length >= debate.order.length) {
    debate.status = 'finished';
    // Debate prep is spent once the debate it prepared for is over.
    campaign.missions.debatePrepBonus = 0;
    return;
  }
  const questionerId = debate.order[debate.exchanges.length];
  if (questionerId === campaign.playerCandidateId) return; // wait for target choice
  const targetId = pickRivalTarget(campaign, rng, questionerId);
  createExchange(debate, rng, questionerId, targetId);
}

/** True if debates scheduled for today are all finished (or none exist yet). */
export function debateBlocksDayEnd(campaign: Campaign): boolean {
  if (!campaign.settings.debateDays.includes(campaign.day)) return false;
  const debate = campaign.debates.find((d) => d.day === campaign.day);
  return !debate || debate.status !== 'finished';
}

/** Reach is unused here — kept simple; noise on states covers spread. */
export function nationStateIds(campaign: Campaign): string[] {
  return getNationStates(campaign).map((s) => s.id);
}
