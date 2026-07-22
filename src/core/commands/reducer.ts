/**
 * The single state-transition function: (campaign, command) → new campaign.
 * Works on a structured clone; threads the seeded RNG through and persists
 * its state back, so identical inputs always produce identical campaigns.
 */
import { applyJobResult } from '../generation/apply';
import { getEvent, dayEndBlocker, isCoreSetupReady } from '../campaign/status';
import { getNationState } from '../model/queries';
import type { Campaign, CouncilorPositionId } from '../model/schemas';
import {
  activeDebate,
  createExchange,
  currentExchange,
  ensureDebateProgress,
  nextQuestionerId,
} from '../sim/debates';
import { addLog } from '../sim/log';
import { resolveMissions } from '../sim/missions';
import { resolveRivalActions } from '../sim/rivals';
import { computeElectionResult } from '../sim/election';
import { currentDayRecord, rollDayStart } from '../sim/schedule';
import { Rng } from '../sim/rng';
import { CommandError } from './commands';
import type { Command } from './commands';

export function applyCommand(campaign: Campaign, command: Command): Campaign {
  const draft = structuredClone(campaign);
  const rng = new Rng(draft.rngState);
  handle(draft, rng, command);
  draft.rngState = rng.state;
  return draft;
}

function requireRunning(draft: Campaign): void {
  if (draft.phase !== 'running') throw new CommandError('The campaign is not running.');
}

function handle(draft: Campaign, rng: Rng, command: Command): void {
  switch (command.type) {
    case 'startCampaign': {
      if (draft.phase !== 'setup') throw new CommandError('The campaign has already started.');
      if (!isCoreSetupReady(draft)) {
        throw new CommandError('The world is still being generated — hold on a moment.');
      }
      draft.phase = 'running';
      draft.day = 1;
      addLog(draft, {
        kind: 'system',
        text: 'The campaign begins. Fourteen days to election day.',
      });
      rollDayStart(draft, rng, 1);
      return;
    }

    case 'hireCouncilor': {
      const positionId = command.positionId as CouncilorPositionId;
      if (draft.councilors.hired[positionId]) {
        throw new CommandError(
          'That position is already filled — fire the current councilor first.',
        );
      }
      const pool = draft.councilors.pool[positionId] ?? [];
      const index = pool.findIndex((c) => c.id === command.councilorId);
      if (index === -1) throw new CommandError('That candidate is no longer available.');
      const [councilor] = pool.splice(index, 1);
      draft.councilors.hired[positionId] = councilor;
      draft.chats[councilor.id] ??= {
        councilorId: councilor.id,
        messages: [],
        pendingReply: false,
      };
      addLog(draft, { kind: 'system', text: `${councilor.name} joined the campaign.` });
      return;
    }

    case 'fireCouncilor': {
      const positionId = command.positionId as CouncilorPositionId;
      const councilor = draft.councilors.hired[positionId];
      if (!councilor) throw new CommandError('No one is hired for that position.');
      draft.councilors.hired[positionId] = null;
      draft.missions.assignments[positionId] = null;
      addLog(draft, { kind: 'system', text: `${councilor.name} left the campaign.` });
      return;
    }

    case 'assignMission': {
      requireRunning(draft);
      const positionId = command.positionId as CouncilorPositionId;
      if (!draft.councilors.hired[positionId]) {
        throw new CommandError('No councilor is hired for that position.');
      }
      if (command.assignment) {
        // Validate referenced targets exist.
        if (command.assignment.type === 'campaignState') {
          getNationState(draft, command.assignment.stateId);
        }
        if (command.assignment.type === 'courtInfluencer') {
          const influencerId = command.assignment.influencerId;
          if (!draft.influencers.some((i) => i.id === influencerId)) {
            throw new CommandError('Unknown influencer.');
          }
        }
      }
      draft.missions.assignments[positionId] = command.assignment;
      return;
    }

    case 'endDay': {
      requireRunning(draft);
      const blocker = dayEndBlocker(draft);
      if (blocker) throw new CommandError(blocker.detail);
      const record = currentDayRecord(draft);
      const outcomes = [...resolveMissions(draft, rng), ...resolveRivalActions(draft, rng)];
      if (record) record.outcomes.push(...outcomes);
      const nextDay = draft.day + 1;
      if (nextDay > draft.settings.totalDays) {
        draft.result = computeElectionResult(draft, rng);
        draft.phase = 'finished';
        return;
      }
      draft.day = nextDay;
      rollDayStart(draft, rng, nextDay);
      return;
    }

    case 'respondEvent': {
      requireRunning(draft);
      const event = getEvent(draft, command.eventId);
      if (!event) throw new CommandError('Unknown event.');
      if (event.response) throw new CommandError('You already responded to this event.');
      event.response = { text: command.text, custom: command.custom };
      addLog(draft, {
        kind: 'event',
        text: `Responding to “${event.title}”: ${command.text}`,
        topicAreaId: event.topicAreaId,
        candidateId: draft.playerCandidateId,
      });
      return;
    }

    case 'debateChooseTarget': {
      requireRunning(draft);
      const debate = activeDebate(draft);
      if (!debate) throw new CommandError('There is no active debate.');
      if (nextQuestionerId(debate) !== draft.playerCandidateId) {
        throw new CommandError('It is not your turn to ask a question.');
      }
      if (command.targetId === draft.playerCandidateId) {
        throw new CommandError('You cannot question yourself.');
      }
      if (!draft.candidates.some((c) => c.id === command.targetId)) {
        throw new CommandError('Unknown candidate.');
      }
      createExchange(debate, rng, draft.playerCandidateId, command.targetId);
      return;
    }

    case 'debateSubmitQuestion': {
      requireRunning(draft);
      const debate = activeDebate(draft);
      const exchange = debate && currentExchange(debate);
      if (!debate || !exchange || exchange.questionerId !== draft.playerCandidateId) {
        throw new CommandError('There is no question for you to ask right now.');
      }
      if (exchange.question) throw new CommandError('The question was already asked.');
      exchange.question = command.text;
      return;
    }

    case 'debateSubmitAnswer': {
      requireRunning(draft);
      const debate = activeDebate(draft);
      const exchange = debate && currentExchange(debate);
      if (
        !debate ||
        !exchange ||
        exchange.targetId !== draft.playerCandidateId ||
        !exchange.question
      ) {
        throw new CommandError('There is no question for you to answer right now.');
      }
      if (exchange.answer) throw new CommandError('You already answered.');
      exchange.answer = command.text;
      return;
    }

    case 'chatSend': {
      const councilor = Object.values(draft.councilors.hired).find(
        (c) => c?.id === command.councilorId,
      );
      if (!councilor) throw new CommandError('You can only chat with hired councilors.');
      const thread = (draft.chats[councilor.id] ??= {
        councilorId: councilor.id,
        messages: [],
        pendingReply: false,
      });
      if (thread.pendingReply) throw new CommandError(`${councilor.name} is still typing…`);
      thread.messages.push({ role: 'player', text: command.text, day: draft.day });
      thread.pendingReply = true;
      return;
    }

    case 'applyJobResult': {
      applyJobResult(draft, rng, command.jobType, command.payload, command.output);
      // Generated content can unblock deterministic progress (e.g. a debate
      // evaluation lands → next rival exchange can be created).
      const debate = activeDebate(draft);
      if (debate) ensureDebateProgress(draft, debate, rng);
      return;
    }
  }
}
