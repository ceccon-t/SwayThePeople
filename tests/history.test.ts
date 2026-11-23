/** Debate history retrieval must preserve relevant public evidence within bounded prompts. */
import { describe, expect, it } from 'vitest';
import { buildRequest } from '@core/generation/builders';
import { estimateTokens } from '@core/generation/budget';
import { candidateStatements, debateTranscript } from '@core/generation/history';
import type { Campaign, CampaignEvent, DebateExchange } from '@core/model/schemas';
import { makeMinimalCampaign } from './helpers';

function statement(
  campaign: Campaign,
  text: string,
  overrides: Partial<DebateExchange> = {},
): DebateExchange {
  return {
    id: text,
    round: 1,
    questionerId: campaign.playerCandidateId,
    targetId: 'rival-1',
    topicAreaId: 'health',
    question: 'What will you do?',
    answer: text,
    evaluation: { impacts: [], commentary: 'Pundit commentary is not candidate speech.' },
    ...overrides,
  };
}

function addDebate(campaign: Campaign, exchanges: DebateExchange[], day = 5, id = 'debate'): void {
  campaign.debates.push({
    id,
    day,
    rounds: 1,
    order: exchanges.map((exchange) => exchange.questionerId),
    status: 'active',
    exchanges,
  });
}

function event(overrides: Partial<CampaignEvent> = {}): CampaignEvent {
  return {
    id: 'event',
    day: 4,
    title: 'Clinic closures',
    description: 'Some clinics are closing.',
    topicAreaId: 'health',
    options: ['An unchosen suggestion.'],
    response: { text: 'I will fund rural clinics.', custom: true },
    ...overrides,
  };
}

function answers(history: string): string[] {
  return history.split('\n').map((line) => line.split(' — ')[1]);
}

describe('candidate statements', () => {
  it('prefers matching topics, then fills with recent other entries without duplicates', () => {
    const campaign = makeMinimalCampaign();
    addDebate(campaign, [
      statement(campaign, 'older health'),
      statement(campaign, 'older economy', { topicAreaId: 'economy' }),
      statement(campaign, 'newer health'),
      statement(campaign, 'newer economy', { topicAreaId: 'economy' }),
      statement(campaign, 'newest security', { topicAreaId: 'security' }),
      statement(campaign, 'other candidate', {
        targetId: campaign.playerCandidateId,
        questionerId: 'rival-1',
      }),
    ]);
    const originalCampaign = structuredClone(campaign);

    expect(answers(candidateStatements(campaign, 'rival-1', 'health', 4))).toEqual([
      'Rex Rival: "newer health"',
      'Rex Rival: "older health"',
      'Rex Rival: "newest security"',
      'Rex Rival: "newer economy"',
    ]);
    expect(campaign).toEqual(originalCampaign);
  });

  it('takes the newest matching entries when they fill every slot', () => {
    const campaign = makeMinimalCampaign();
    addDebate(
      campaign,
      ['old', 'middle', 'new'].map((text) => statement(campaign, text)),
    );

    expect(answers(candidateStatements(campaign, 'rival-1', 'health', 2))).toEqual([
      'Rex Rival: "new"',
      'Rex Rival: "middle"',
    ]);
  });

  it('falls back to newest entries when no topic matches and handles empty history', () => {
    const campaign = makeMinimalCampaign();
    addDebate(
      campaign,
      ['old', 'middle', 'new'].map((text) => statement(campaign, text)),
    );

    expect(answers(candidateStatements(campaign, 'rival-1', 'economy', 2))).toEqual([
      'Rex Rival: "new"',
      'Rex Rival: "middle"',
    ]);
    expect(candidateStatements(campaign, 'rival-1', 'health', 0)).toBe('');
    expect(candidateStatements(campaign, campaign.playerCandidateId, 'health', 6)).toBe('');
  });

  it('preserves the newest matching evidence when the token budget truncates history', () => {
    const campaign = makeMinimalCampaign();
    addDebate(campaign, [
      statement(campaign, 'old health'),
      statement(campaign, 'new health'),
      statement(campaign, 'new economy', { topicAreaId: 'economy' }),
    ]);
    const firstEntry = candidateStatements(campaign, 'rival-1', 'health', 1);
    const history = candidateStatements(
      campaign,
      'rival-1',
      'health',
      3,
      estimateTokens(firstEntry) + 1,
    );
    expect(history).toContain('new health');
    expect(history).not.toContain('old health');
    expect(history).not.toContain('new economy');
  });

  it('retrieves actual speech and context, excluding verdicts, suggestions and log prose', () => {
    const campaign = makeMinimalCampaign();
    addDebate(campaign, [
      statement(campaign, 'I will hire nurses.', {
        targetId: campaign.playerCandidateId,
        questionerId: 'rival-1',
        question: 'How will you staff hospitals?',
        questionOptions: ['An unchosen question.'],
        answerOptions: ['An unchosen answer.'],
        evaluation: {
          commentary: 'A pundit verdict.',
          impacts: [
            {
              targetCandidateId: campaign.playerCandidateId,
              deltas: [],
              rationale: 'A scoring rationale.',
            },
          ],
        },
      }),
    ]);
    campaign.events = [
      event({
        evaluation: {
          commentary: 'An event verdict.',
          impact: {
            targetCandidateId: campaign.playerCandidateId,
            deltas: [],
            rationale: 'An event rationale.',
          },
        },
      }),
    ];
    campaign.log = [
      {
        id: 'log',
        day: 5,
        kind: 'event',
        candidateId: campaign.playerCandidateId,
        topicAreaId: 'health',
        text: 'Public verdict from the log.',
      },
    ];

    const history = candidateStatements(campaign, campaign.playerCandidateId, 'health', 6);
    expect(history).toContain('How will you staff hospitals?');
    expect(history).toContain('I will hire nurses.');
    expect(history).toContain('Responding to “Clinic closures”: I will fund rural clinics.');
    expect(history).not.toMatch(/verdict|rationale|unchosen|log/);
    expect(history.split('\n')).toHaveLength(2);
    // Being the questioner does not make the answer part of this rival's record.
    expect(candidateStatements(campaign, 'rival-1', 'health', 6)).toBe('');
  });

  it('orders event responses and debate answers by day, then later exchanges first', () => {
    const campaign = makeMinimalCampaign();
    addDebate(campaign, [
      statement(campaign, 'earlier debate answer', {
        targetId: campaign.playerCandidateId,
        questionerId: 'rival-1',
      }),
      statement(campaign, 'later debate answer', {
        targetId: campaign.playerCandidateId,
        questionerId: 'rival-1',
      }),
    ]);
    campaign.events = [
      event(),
      event({ id: 'new-event', day: 6, response: { text: 'A newer response.', custom: false } }),
    ];

    const lines = candidateStatements(campaign, campaign.playerCandidateId, 'health', 6).split(
      '\n',
    );
    expect(lines[0]).toContain('Day 6:');
    expect(lines[1]).toContain('later debate answer');
    expect(lines[2]).toContain('earlier debate answer');
    expect(lines[3]).toContain('Day 4:');
  });

  it('excludes unanswered events and unevaluated debate answers from past statements', () => {
    const campaign = makeMinimalCampaign();
    addDebate(campaign, [
      statement(campaign, 'Current answer awaiting judgment.', { evaluation: undefined }),
      statement(campaign, 'No answer yet.', { answer: undefined, evaluation: undefined }),
    ]);
    campaign.events = [event({ response: undefined })];

    expect(candidateStatements(campaign, 'rival-1', 'health', 6)).toBe('');
    expect(candidateStatements(campaign, campaign.playerCandidateId, 'health', 6)).toBe('');
  });
});

describe('debate transcript', () => {
  it('keeps recent whole exchanges within budget in chronological order', () => {
    const campaign = makeMinimalCampaign();
    addDebate(
      campaign,
      ['old answer', 'mid answer', 'new answer'].map((text) => statement(campaign, text)),
    );
    const fullLines = debateTranscript(campaign, 'debate').split('\n');
    const expected = fullLines.slice(-2).join('\n');
    const budget = estimateTokens(expected);
    const originalCampaign = structuredClone(campaign);

    expect(debateTranscript(campaign, 'debate', budget)).toBe(expected);
    expect(estimateTokens(debateTranscript(campaign, 'debate', budget))).toBeLessThanOrEqual(
      budget,
    );
    expect(campaign).toEqual(originalCampaign);
  });

  it('omits incomplete or oversized exchanges without cutting questions or answers', () => {
    const campaign = makeMinimalCampaign();
    addDebate(campaign, [statement(campaign, 'A short answer.')]);
    const expected = debateTranscript(campaign, 'debate');
    campaign.debates[0].exchanges.push(
      statement(campaign, 'A very long answer. '.repeat(100)),
      statement(campaign, 'Pending', { answer: undefined, evaluation: undefined }),
      statement(campaign, 'No question', { question: undefined, evaluation: undefined }),
    );

    expect(debateTranscript(campaign, 'debate', estimateTokens(expected))).toBe(expected);
    expect(debateTranscript(campaign, 'debate', 1)).toBe('');
    expect(debateTranscript(campaign, 'debate', 0)).toBe('');
    expect(debateTranscript(campaign, 'missing')).toBe('');
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
    addDebate(
      campaign,
      [
        statement(campaign, 'A prior promise to fund rural clinics.', { targetId, questionerId }),
        ...Array.from({ length: 7 }, (_, index) =>
          statement(campaign, `Unrelated economy statement ${index}.`, {
            targetId,
            questionerId,
            topicAreaId: 'economy',
          }),
        ),
      ],
      5,
      'previous-debate',
    );
    addDebate(
      campaign,
      [{ id: 'exchange', round: 1, topicAreaId: 'health', questionerId, targetId }],
      12,
    );

    const request = buildRequest(campaign, {
      key: type,
      type,
      priority: 'interactive',
      payload: { debateId: 'debate', exchangeId: 'exchange' },
    });
    expect(request.system).toContain('A prior promise to fund rural clinics.');
    expect(request.system).toContain('Unrelated economy statement 6.');
    expect(request.system).not.toContain('Unrelated economy statement 0.');
    expect(request.system).not.toContain('Pundit commentary');
  });
});
