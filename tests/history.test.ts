/** Debate history retrieval must preserve relevant evidence within bounded prompts. */
import { describe, expect, it } from 'vitest';
import { buildRequest } from '@core/generation/builders';
import { candidateStatements } from '@core/generation/history';
import type { LogEntry } from '@core/model/schemas';
import { makeMinimalCampaign } from './helpers';

function statement(id: string, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    day: 1,
    kind: 'debate',
    candidateId: 'rival-1',
    topicAreaId: 'health',
    text: id,
    ...overrides,
  };
}

describe('candidate statements', () => {
  it('prefers matching topics, then fills with recent other entries without duplicates', () => {
    const campaign = makeMinimalCampaign();
    campaign.log = [
      statement('older health'),
      statement('older economy', { topicAreaId: 'economy' }),
      statement('newer health', { kind: 'event' }),
      statement('newer economy', { topicAreaId: 'economy' }),
      statement('untagged', { topicAreaId: undefined }),
      statement('other candidate', { candidateId: campaign.playerCandidateId }),
      statement('private mission', { kind: 'mission' }),
    ];
    const originalLog = structuredClone(campaign.log);

    expect(candidateStatements(campaign, 'rival-1', 'health', 4).split('\n')).toEqual([
      'Day 1: newer health',
      'Day 1: older health',
      'Day 1: untagged',
      'Day 1: newer economy',
    ]);
    expect(campaign.log).toEqual(originalLog);
  });

  it('takes the newest matching entries when they fill every slot', () => {
    const campaign = makeMinimalCampaign();
    campaign.log = [statement('old'), statement('middle'), statement('new')];

    expect(candidateStatements(campaign, 'rival-1', 'health', 2)).toBe('Day 1: new\nDay 1: middle');
  });

  it('falls back to newest entries when no topic matches and handles empty history', () => {
    const campaign = makeMinimalCampaign();
    campaign.log = [statement('old'), statement('middle'), statement('new')];

    expect(candidateStatements(campaign, 'rival-1', 'economy', 2)).toBe(
      'Day 1: new\nDay 1: middle',
    );
    expect(candidateStatements(campaign, 'rival-1', 'health', 0)).toBe('');
    expect(candidateStatements(campaign, campaign.playerCandidateId, 'health', 6)).toBe('');
  });

  it('preserves the newest matching evidence when the token budget truncates history', () => {
    const campaign = makeMinimalCampaign();
    campaign.log = [
      statement('old health'),
      statement('new health'),
      statement('new economy', { topicAreaId: 'economy' }),
    ];

    const history = candidateStatements(campaign, 'rival-1', 'health', 3, 5);
    expect(history).toContain('Day 1: new health');
    expect(history).not.toContain('old health');
    expect(history).not.toContain('new economy');
  });
});

describe('debate prompt history', () => {
  it.each([
    'debate.playerQuestionOptions',
    'debate.rivalQuestion',
    'debate.playerAnswerOptions',
    'debate.rivalAnswer',
    'debate.evaluate',
    'debate.rivalExchange',
  ] as const)('%s retrieves relevant evidence beyond the recent-entry window', (type) => {
    const campaign = makeMinimalCampaign();
    const playerAnswers = type === 'debate.rivalQuestion' || type === 'debate.playerAnswerOptions';
    const targetId = playerAnswers ? campaign.playerCandidateId : 'rival-1';
    const questionerId = playerAnswers ? 'rival-1' : campaign.playerCandidateId;
    campaign.debates = [
      {
        id: 'debate',
        day: 5,
        rounds: 1,
        order: [questionerId],
        status: 'active',
        exchanges: [{ id: 'exchange', round: 1, topicAreaId: 'health', questionerId, targetId }],
      },
    ];
    campaign.log = [
      statement('A prior promise to fund rural clinics.', { candidateId: targetId }),
      ...Array.from({ length: 7 }, (_, index) =>
        statement(`Unrelated economy statement ${index}.`, {
          candidateId: targetId,
          topicAreaId: 'economy',
        }),
      ),
    ];

    const request = buildRequest(campaign, {
      key: type,
      type,
      priority: 'interactive',
      payload: { debateId: 'debate', exchangeId: 'exchange' },
    });
    expect(request.system).toContain('A prior promise to fund rural clinics.');
    expect(request.system).toContain('Unrelated economy statement 6.');
    expect(request.system).not.toContain('Unrelated economy statement 0.');
  });
});
