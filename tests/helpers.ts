import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import type { NewCampaignInput } from '@core/campaign/create';
import { createCampaign } from '@core/campaign/create';
import { newId } from '@core/model/ids';
import type { Campaign, TopicNumbers } from '@core/model/schemas';
import { COUNCILOR_POSITION_IDS, TOPIC_AREA_IDS } from '@core/model/schemas';
import type { Reply } from '@core/protocol';
import type { PlayerCommand } from '@core/commands/commands';
import { currentDayEvent, dayEndBlocker } from '@core/campaign/status';
import { activeDebate, currentExchange, nextQuestionerId } from '@core/sim/debates';
import { GameHost } from '../src/main/gameHost';
import { MockAdapter } from '../src/main/llm/mock';

/** Unwrap a Reply, failing the test with the transported error message. */
export function expectOk<T>(reply: Reply<T>): T {
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

/** Test data stays inside the repo (.cache/) — the host machine is untouched. */
export function tempDataDir(): string {
  return mkdtempSync(join(process.cwd(), '.cache', 'test-data-'));
}

export const TEST_INPUT: NewCampaignInput = {
  candidate: {
    name: 'Vera Saltmarsh',
    age: 44,
    gender: 'female',
    bio: 'A harbor-town schoolteacher who sued the water company and won.',
  },
  party: {
    name: 'UPF — Union for Progress',
    code: '27',
    colors: { main: '#c9a227', secondary: '#1d3557' },
    publicAgenda: 'Honest budgets, strong schools, and a government that answers its phone.',
    hiddenAgenda: 'Quietly dismantle the port monopoly that ruined my family.',
  },
};

export function makeHost(): GameHost {
  const host = new GameHost(tempDataDir(), () => {});
  host.setEngineForTesting(new MockAdapter(0));
  return host;
}

/** New campaign with all setup generation completed (via MockAdapter). */
export async function setupCampaign(host: GameHost): Promise<Campaign> {
  const reply = await host.handle('campaign.new', TEST_INPUT);
  if (!reply.ok) throw new Error(reply.error);
  await host.queueIdle();
  const campaign = host.getCampaign();
  if (!campaign) throw new Error('No campaign after setup');
  return campaign;
}

export async function sendCommand(host: GameHost, cmd: PlayerCommand): Promise<void> {
  const reply = await host.handle('campaign.command', cmd);
  if (!reply.ok) throw new Error(`Command ${cmd.type} failed: ${reply.error}`);
}

/**
 * Take one sensible player decision (debate turn, event response, or end the
 * day); returns false when the campaign is waiting on generation instead.
 */
export async function actOnce(host: GameHost, campaign: Campaign): Promise<boolean> {
  const playerId = campaign.playerCandidateId;

  const debate = activeDebate(campaign);
  if (debate) {
    const exchange = currentExchange(debate);
    if (!exchange && nextQuestionerId(debate) === playerId) {
      const target = campaign.candidates.find((c) => c.id !== playerId);
      await sendCommand(host, { type: 'debateChooseTarget', targetId: target!.id });
      return true;
    }
    if (exchange?.questionerId === playerId && !exchange.question && exchange.questionOptions) {
      await sendCommand(host, {
        type: 'debateSubmitQuestion',
        text: exchange.questionOptions[0],
        custom: false,
      });
      return true;
    }
    if (
      exchange?.targetId === playerId &&
      exchange.question &&
      !exchange.answer &&
      exchange.answerOptions
    ) {
      await sendCommand(host, {
        type: 'debateSubmitAnswer',
        text: 'I will answer plainly, in my own words, as always.',
        custom: true,
      });
      return true;
    }
    return false; // waiting on generation within the debate
  }

  const event = currentDayEvent(campaign);
  if (event && !event.response) {
    await sendCommand(host, {
      type: 'respondEvent',
      eventId: event.id,
      text: event.options[0],
      custom: false,
    });
    return true;
  }

  if (!dayEndBlocker(campaign)) {
    // Assign one mission per day to exercise the mission system.
    const hired = campaign.councilors.hired[COUNCILOR_POSITION_IDS[0]];
    if (hired && !campaign.missions.assignments[COUNCILOR_POSITION_IDS[0]]) {
      const stateId = campaign.nation!.states[campaign.day % campaign.nation!.states.length].id;
      await sendCommand(host, {
        type: 'assignMission',
        positionId: COUNCILOR_POSITION_IDS[0],
        assignment: { type: 'campaignState', stateId },
      });
    }
    await sendCommand(host, { type: 'endDay' });
    return true;
  }
  return false;
}

/** Hire the full team, start the campaign, and play until `until` holds. */
export async function driveUntil(
  host: GameHost,
  until: (campaign: Campaign) => boolean,
): Promise<Campaign> {
  for (let guard = 0; guard < 500; guard++) {
    await host.queueIdle();
    const campaign = host.getCampaign();
    if (!campaign) throw new Error('Campaign vanished while driving');
    if (until(campaign)) return campaign;
    if (campaign.phase === 'finished') break;
    const acted = await actOnce(host, campaign);
    if (!acted) await host.queueIdle();
  }
  const campaign = host.getCampaign();
  if (campaign && until(campaign)) return campaign;
  throw new Error('driveUntil: condition never became true');
}

/**
 * A minimal hand-built campaign (2 states, 1 rival) for pure sim unit tests
 * that don't need the host or generation.
 */
export function makeMinimalCampaign(): Campaign {
  const campaign = createCampaign(TEST_INPUT);
  const evenWeights = Object.fromEntries(TOPIC_AREA_IDS.map((t) => [t, 1 / 6])) as TopicNumbers;
  campaign.nation = {
    name: 'Testland',
    description: 'A nation of unit tests.',
    states: [
      {
        id: 'state-a',
        name: 'Alphaland',
        description: 'First state.',
        cities: ['Alpha City'],
        populationWeight: 0.6,
        topicWeights: {
          ...evenWeights,
          economy: 0.4,
          security: 0.1,
          health: 0.1,
          education: 0.1,
          culture: 0.15,
          environment: 0.15,
        },
      },
      {
        id: 'state-b',
        name: 'Betaville',
        description: 'Second state.',
        cities: ['Beta Town'],
        populationWeight: 0.4,
        topicWeights: evenWeights,
      },
    ],
  };
  const rivalPartyId = newId('party');
  campaign.parties.push({
    id: rivalPartyId,
    name: 'Rival Party',
    code: '99',
    colors: { main: '#333333', secondary: '#dddddd' },
    publicAgenda: 'Everything for everyone.',
    hiddenAgenda: 'Nothing for anyone.',
    policies: [],
  });
  campaign.candidates.push({
    id: 'rival-1',
    partyId: rivalPartyId,
    name: 'Rex Rival',
    age: 55,
    gender: 'male',
    bio: 'A rival.',
  });
  for (const state of campaign.nation.states) {
    campaign.opinion.approval[state.id] = {};
    for (const topicId of TOPIC_AREA_IDS) {
      campaign.opinion.approval[state.id][topicId] = {
        [campaign.playerCandidateId]: 50,
        'rival-1': 50,
      };
    }
  }
  return campaign;
}
