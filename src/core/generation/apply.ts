/**
 * Applies parsed job outputs to campaign state. Every apply is idempotent and
 * stale-safe: if the state no longer expects the content, it is dropped.
 * All numbers are clamped here regardless of schema validation ("the LLM
 * proposes, the core disposes").
 */
import { BOUNDS, TOPIC_AREAS } from '../model/constants';
import { newId } from '../model/ids';
import { clamp, findByName, getNationStates, getPlayerCandidate } from '../model/queries';
import type { Campaign, OpinionImpact, TopicAreaId, TopicNumbers } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import { addLog } from '../sim/log';
import { rollHiddenAgendaHint } from '../sim/influencers';
import {
  applyImpact,
  compressInitialApproval,
  seedCandidateApproval,
  isCandidateSeeded,
} from '../sim/opinion';
import type { Rng } from '../sim/rng';
import type { JobPayloads, JobType } from './jobs';
import type { RawImpact } from './outputs';
import {
  councilorMatchOutputSchema,
  councilorPoolOutputSchema,
  debateEvalOutputSchema,
  epilogueOutputSchema,
  eventEvalOutputSchema,
  eventGenOutputSchema,
  influencerContentOutputSchema,
  influencersOutputSchema,
  answerOutputSchema,
  opinionSeedOutputSchema,
  optionsOutputSchema,
  policiesOutputSchema,
  questionOutputSchema,
  rivalExchangeOutputSchema,
  rivalGenOutputSchema,
  worldGenOutputSchema,
} from './outputs';

// ---------------------------------------------------------------------------
// Lenient reference mapping (LLMs speak in names, the core speaks in ids)
// ---------------------------------------------------------------------------

function mapTopic(name: string, rng: Rng): TopicAreaId {
  const needle = name.trim().toLowerCase();
  const match = TOPIC_AREAS.find(
    (t) => t.id === needle || t.name.toLowerCase() === needle || needle.includes(t.id),
  );
  return match?.id ?? rng.pick(TOPIC_AREA_IDS);
}

function mapStateId(campaign: Campaign, name: string): string | undefined {
  return findByName(getNationStates(campaign), name)?.id;
}

/** Convert a raw LLM impact to a bounded OpinionImpact aimed at a known candidate. */
function toImpact(
  campaign: Campaign,
  rng: Rng,
  raw: RawImpact,
  fallbackTargetId: string,
  allowedTargetIds?: string[],
): OpinionImpact {
  let targetId = fallbackTargetId;
  if (raw.target) {
    const found = findByName(campaign.candidates, raw.target);
    if (found && (!allowedTargetIds || allowedTargetIds.includes(found.id))) {
      targetId = found.id;
    }
  }
  const seenTopics = new Set<string>();
  const deltas = raw.deltas
    .map((d) => ({
      topicAreaId: mapTopic(d.topic, rng),
      delta: clamp(d.delta, -BOUNDS.topicDeltaMax, BOUNDS.topicDeltaMax),
    }))
    .filter((d) => {
      if (seenTopics.has(d.topicAreaId)) return false;
      seenTopics.add(d.topicAreaId);
      return true;
    });
  const regionalEmphasis = (raw.statesEmphasis ?? [])
    .map((e) => ({ stateId: mapStateId(campaign, e.state), multiplier: e.multiplier }))
    .filter((e): e is { stateId: string; multiplier: number } => e.stateId !== undefined)
    .map((e) => ({
      stateId: e.stateId,
      multiplier: clamp(e.multiplier, BOUNDS.regionalMultiplierMin, BOUNDS.regionalMultiplierMax),
    }));
  return {
    targetCandidateId: targetId,
    deltas,
    regionalEmphasis: regionalEmphasis.length > 0 ? regionalEmphasis : undefined,
    rationale: raw.rationale,
  };
}

function normalizeWeights(values: number[]): number[] {
  const positive = values.map((v) => Math.max(v, 0.01));
  const total = positive.reduce((sum, v) => sum + v, 0);
  return positive.map((v) => v / total);
}

function uniquePartyCode(campaign: Campaign, proposed: string, rng: Rng): string {
  const taken = new Set(campaign.parties.map((p) => p.code));
  const cleaned = proposed.replace(/\D/g, '').padStart(2, '0').slice(0, 2);
  if (cleaned.length === 2 && !taken.has(cleaned)) return cleaned;
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(rng.int(10, 99));
    if (!taken.has(code)) return code;
  }
  return '99';
}

function clampAge(age: number): number {
  return Math.round(clamp(age, 18, 99));
}

// ---------------------------------------------------------------------------
// Application per job type
// ---------------------------------------------------------------------------

export function applyJobResult(
  campaign: Campaign,
  rng: Rng,
  jobType: JobType,
  payload: unknown,
  output: unknown,
): void {
  switch (jobType) {
    case 'world.generate': {
      if (campaign.nation) return;
      const data = worldGenOutputSchema.parse(output);
      const states = data.states.slice(0, campaign.settings.stateCount);
      const popWeights = normalizeWeights(states.map((s) => s.populationWeight));
      campaign.nation = {
        name: data.nationName,
        description: data.nationDescription,
        states: states.map((s, i) => {
          const weightValues = normalizeWeights(TOPIC_AREA_IDS.map((t) => s.topicWeights[t]));
          const topicWeights = Object.fromEntries(
            TOPIC_AREA_IDS.map((t, j) => [t, weightValues[j]]),
          ) as TopicNumbers;
          return {
            id: newId('state'),
            name: s.name,
            description: s.description,
            cities: s.cities.slice(0, 3),
            populationWeight: popWeights[i],
            topicWeights,
          };
        }),
      };
      addLog(campaign, {
        kind: 'system',
        text: `The nation of ${data.nationName} takes shape: ${states.map((s) => s.name).join(', ')}.`,
      });
      return;
    }

    case 'rival.generate': {
      if (campaign.parties.length >= campaign.settings.rivalCount + 1) return;
      const data = rivalGenOutputSchema.parse(output);
      const partyId = newId('party');
      campaign.parties.push({
        id: partyId,
        name: data.party.name,
        code: uniquePartyCode(campaign, data.party.code, rng),
        colors: { main: data.party.colors.main, secondary: data.party.colors.secondary },
        publicAgenda: data.party.publicAgenda,
        hiddenAgenda: data.party.hiddenAgenda,
        policies: [],
      });
      campaign.candidates.push({
        id: newId('cand'),
        partyId,
        name: data.candidate.name,
        age: clampAge(data.candidate.age),
        gender: data.candidate.gender,
        bio: data.candidate.bio,
      });
      addLog(campaign, {
        kind: 'system',
        text: `${data.candidate.name} (${data.party.name}) enters the race.`,
      });
      return;
    }

    case 'party.policies': {
      const { partyId } = payload as JobPayloads['party.policies'];
      const party = campaign.parties.find((p) => p.id === partyId);
      if (!party || party.policies.length >= TOPIC_AREA_IDS.length) return;
      const data = policiesOutputSchema.parse(output);
      const byTopic = new Map<TopicAreaId, { title: string; summary: string }>();
      for (const policy of data.policies) {
        const topicId = mapTopic(policy.topic, rng);
        if (!byTopic.has(topicId)) {
          byTopic.set(topicId, { title: policy.title, summary: policy.summary });
        }
      }
      party.policies = TOPIC_AREA_IDS.map((topicId) => {
        const generated = byTopic.get(topicId);
        return {
          topicAreaId: topicId,
          title: generated?.title ?? `Our stance on ${topicId}`,
          summary:
            generated?.summary ??
            `The party approaches ${topicId} guided by its core promise: ${party.publicAgenda}`,
        };
      });
      addLog(campaign, { kind: 'system', text: `${party.name} publishes its official platform.` });
      return;
    }

    case 'opinion.seed': {
      const { candidateId } = payload as JobPayloads['opinion.seed'];
      if (!campaign.candidates.some((c) => c.id === candidateId)) return;
      if (isCandidateSeeded(campaign, candidateId)) return;
      const data = opinionSeedOutputSchema.parse(output);
      const topicScores = Object.fromEntries(
        TOPIC_AREA_IDS.map((t) => [t, clamp(data.topicScores[t], 0, 100)]),
      ) as TopicNumbers;
      const stateAffinity: Record<string, number> = {};
      for (const entry of data.stateAffinities) {
        const stateId = mapStateId(campaign, entry.state);
        if (stateId) stateAffinity[stateId] = clamp(entry.affinity, 0, 100);
      }
      seedCandidateApproval(campaign, candidateId, topicScores, stateAffinity);
      // Once the whole field is polled, cap the starting spread so no race is
      // decided before day 1 (see BOUNDS.initialApprovalGapMax).
      const fieldComplete =
        campaign.candidates.length >= campaign.settings.rivalCount + 1 &&
        campaign.candidates.every((c) => isCandidateSeeded(campaign, c.id));
      if (fieldComplete) compressInitialApproval(campaign);
      return;
    }

    case 'councilor.pool': {
      const { positionId, count } = payload as JobPayloads['councilor.pool'];
      const pool = (campaign.councilors.pool[positionId] ??= []);
      if (pool.length >= campaign.settings.councilorPoolSize) return;
      const data = councilorPoolOutputSchema.parse(output);
      for (const applicant of data.candidates.slice(0, count)) {
        if (pool.length >= campaign.settings.councilorPoolSize) break;
        pool.push({
          id: newId('coun'),
          name: applicant.name,
          age: clampAge(applicant.age),
          gender: applicant.gender,
          bio: applicant.bio,
          politicalViews: applicant.politicalViews,
          personality: applicant.personality,
          positionId,
        });
      }
      return;
    }

    case 'councilor.match': {
      const { positionId, councilorIds } = payload as JobPayloads['councilor.match'];
      const pool = campaign.councilors.pool[positionId] ?? [];
      const targets = pool.filter((c) => councilorIds.includes(c.id) && !c.agendaMatch);
      if (targets.length === 0) return;
      const data = councilorMatchOutputSchema.parse(output);
      for (const [index, councilor] of targets.entries()) {
        const evaluation =
          data.evaluations.find((e) => findByName([councilor], e.name) !== undefined) ??
          data.evaluations[index];
        if (!evaluation) continue;
        // Applicants are presented as pre-screened: never below the fit floor.
        councilor.agendaMatch = {
          publicScore: clamp(evaluation.publicScore, BOUNDS.councilorMatchFloor, 100),
          hiddenScore: clamp(evaluation.hiddenScore, BOUNDS.councilorMatchFloor, 100),
          commentary: evaluation.commentary,
        };
      }
      return;
    }

    case 'influencers.generate': {
      if (campaign.influencers.length >= campaign.settings.influencerCount) return;
      const data = influencersOutputSchema.parse(output);
      for (const raw of data.influencers) {
        if (campaign.influencers.length >= campaign.settings.influencerCount) break;
        if (findByName(campaign.influencers, raw.name)) continue;
        const partyAffinity: Record<string, number> = {};
        for (const party of campaign.parties) {
          const entry = raw.partyAffinities.find((a) => findByName([party], a.party));
          partyAffinity[party.id] = clamp(entry?.affinity ?? 50, 0, 100);
        }
        campaign.influencers.push({
          id: newId('infl'),
          name: raw.name,
          age: clampAge(raw.age),
          gender: raw.gender,
          bio: raw.bio,
          domain: raw.domain,
          audience: raw.audience,
          reach: clamp(raw.reach, 1, 100),
          partyAffinity,
          contentLog: [],
        });
      }
      return;
    }

    case 'event.generate': {
      const { day } = payload as JobPayloads['event.generate'];
      const record = campaign.days.find((d) => d.day === day);
      if (!record || !record.eventPlanned || record.eventId) return;
      const data = eventGenOutputSchema.parse(output);
      const event = {
        id: newId('event'),
        day,
        title: data.title,
        description: data.description,
        topicAreaId: mapTopic(data.topic, rng),
        stateId: data.state ? mapStateId(campaign, data.state) : undefined,
        options: data.options.slice(0, 3),
      };
      campaign.events.push(event);
      record.eventId = event.id;
      addLog(campaign, {
        kind: 'event',
        day,
        text: `Breaking: ${data.title}`,
        topicAreaId: event.topicAreaId,
      });
      return;
    }

    case 'event.evaluate': {
      const { eventId } = payload as JobPayloads['event.evaluate'];
      const event = campaign.events.find((e) => e.id === eventId);
      if (!event || !event.response || event.evaluation) return;
      const data = eventEvalOutputSchema.parse(output);
      const player = getPlayerCandidate(campaign);
      // Events always judge the player's response — ignore any other target.
      const impact = toImpact(campaign, rng, data.impact, player.id, [player.id]);
      applyImpact(campaign, impact, rng);
      event.evaluation = { impact, commentary: data.commentary };
      const record = campaign.days.find((d) => d.day === event.day);
      record?.outcomes.push(`Verdict on “${event.title}”: ${impact.rationale}`);
      addLog(campaign, {
        kind: 'event',
        day: event.day,
        text: `Public verdict on “${event.title}”: ${impact.rationale}`,
        topicAreaId: event.topicAreaId,
        candidateId: player.id,
      });
      return;
    }

    case 'day.report': {
      const { day } = payload as JobPayloads['day.report'];
      const record = campaign.days.find((d) => d.day === day);
      if (!record || record.reportText) return;
      record.reportText = String(output).trim();
      return;
    }

    case 'chat.reply': {
      const { councilorId } = payload as JobPayloads['chat.reply'];
      const thread = campaign.chats[councilorId];
      if (!thread || !thread.pendingReply) return;
      thread.messages.push({ role: 'councilor', text: String(output).trim(), day: campaign.day });
      thread.pendingReply = false;
      return;
    }

    case 'influencer.content': {
      const { influencerId } = payload as JobPayloads['influencer.content'];
      const influencer = campaign.influencers.find((i) => i.id === influencerId);
      if (!influencer?.endorsement) return;
      if ((influencer.nextContentDay ?? Infinity) > campaign.day) return;
      const data = influencerContentOutputSchema.parse(output);
      const endorsedId = influencer.endorsement.candidateId;
      const impact = toImpact(campaign, rng, data.impact, endorsedId, [endorsedId]);
      // Influencer content is soft power: positive only, scaled by reach.
      const reachScale =
        (0.5 + influencer.reach / 200) * (BOUNDS.influencerImpactMax / BOUNDS.topicDeltaMax);
      impact.deltas = impact.deltas.map((d) => ({
        topicAreaId: d.topicAreaId,
        delta: clamp(Math.abs(d.delta) * reachScale, 0, BOUNDS.influencerImpactMax),
      }));
      applyImpact(campaign, impact, rng);
      influencer.contentLog.push({
        id: newId('cont'),
        day: campaign.day,
        medium: data.medium,
        text: data.text,
      });
      influencer.nextContentDay = campaign.day + rng.int(2, 3);
      influencer.nextContentHintsHidden = rollHiddenAgendaHint(campaign, influencer, rng);
      const endorsed = campaign.candidates.find((c) => c.id === endorsedId);
      addLog(campaign, {
        kind: 'influencer',
        text: `${influencer.name} (${data.medium}) boosts ${endorsed?.name}: ${data.text}`,
        candidateId: endorsedId,
      });
      return;
    }

    case 'debate.playerQuestionOptions': {
      const exchange = findExchange(campaign, payload);
      if (!exchange || exchange.question || exchange.questionOptions) return;
      exchange.questionOptions = optionsOutputSchema.parse(output).options.slice(0, 3);
      return;
    }

    case 'debate.rivalQuestion': {
      const exchange = findExchange(campaign, payload);
      if (!exchange || exchange.question) return;
      exchange.question = questionOutputSchema.parse(output).question;
      return;
    }

    case 'debate.playerAnswerOptions': {
      const exchange = findExchange(campaign, payload);
      if (!exchange || !exchange.question || exchange.answer || exchange.answerOptions) return;
      exchange.answerOptions = optionsOutputSchema.parse(output).options.slice(0, 3);
      return;
    }

    case 'debate.rivalAnswer': {
      const exchange = findExchange(campaign, payload);
      if (!exchange || !exchange.question || exchange.answer) return;
      exchange.answer = answerOutputSchema.parse(output).answer;
      return;
    }

    case 'debate.evaluate': {
      const exchange = findExchange(campaign, payload);
      if (!exchange || !exchange.question || !exchange.answer || exchange.evaluation) return;
      const data = debateEvalOutputSchema.parse(output);
      applyExchangeEvaluation(
        campaign,
        rng,
        payload as JobPayloads['debate.evaluate'],
        data.impacts,
        data.commentary,
      );
      return;
    }

    case 'debate.rivalExchange': {
      const exchange = findExchange(campaign, payload);
      if (!exchange || exchange.question || exchange.evaluation) return;
      const data = rivalExchangeOutputSchema.parse(output);
      exchange.question = data.question;
      exchange.answer = data.answer;
      applyExchangeEvaluation(
        campaign,
        rng,
        payload as JobPayloads['debate.rivalExchange'],
        data.impacts,
        data.commentary,
      );
      return;
    }

    case 'election.epilogue': {
      if (!campaign.result || campaign.result.epilogue) return;
      const data = epilogueOutputSchema.parse(output);
      campaign.result.epilogue = {
        advancementScore: clamp(data.advancementScore, 0, 100),
        justification: data.justification,
        text: data.epilogue,
      };
      return;
    }
  }
}

function findExchange(campaign: Campaign, payload: unknown) {
  const { debateId, exchangeId } = payload as { debateId: string; exchangeId: string };
  const debate = campaign.debates.find((d) => d.id === debateId);
  return debate?.exchanges.find((e) => e.id === exchangeId);
}

function applyExchangeEvaluation(
  campaign: Campaign,
  rng: Rng,
  payload: { debateId: string; exchangeId: string },
  rawImpacts: RawImpact[],
  commentary: string,
): void {
  const exchange = findExchange(campaign, payload);
  if (!exchange) return;
  const involved = [exchange.questionerId, exchange.targetId];
  const playerId = campaign.playerCandidateId;
  const prepBonus = campaign.missions.debatePrepBonus;
  const impacts: OpinionImpact[] = [];
  for (const raw of rawImpacts.slice(0, 2)) {
    const impact = toImpact(campaign, rng, raw, exchange.targetId, involved);
    const positiveScale =
      impact.targetCandidateId === playerId && involved.includes(playerId)
        ? 1 + prepBonus * BOUNDS.debatePrepBonusPerPoint
        : 1;
    applyImpact(campaign, impact, rng, { positiveScale });
    impacts.push(impact);
  }
  exchange.evaluation = { impacts, commentary };
  const questioner = campaign.candidates.find((c) => c.id === exchange.questionerId);
  const target = campaign.candidates.find((c) => c.id === exchange.targetId);
  addLog(campaign, {
    kind: 'debate',
    text: `Debate — ${questioner?.name} to ${target?.name}: "${exchange.question}" ${target?.name}: "${exchange.answer}" Verdict: ${impacts.map((i) => i.rationale).join(' ')}`,
    topicAreaId: exchange.topicAreaId,
    candidateId: exchange.targetId,
  });
}
