import { useState } from 'react';
import { TOPIC_AREA_BY_ID } from '@core/model/constants';
import type { Campaign, DebateExchange } from '@core/model/schemas';
import { activeDebate, currentExchange, nextQuestionerId } from '@core/sim/debates';
import { FailedJobs, Pending, Section, partyOf } from '../components/common';
import { useStore } from '../store';

function name(campaign: Campaign, candidateId: string): string {
  return campaign.candidates.find((c) => c.id === candidateId)?.name ?? '?';
}

function ExchangeVerdict({
  campaign,
  exchange,
}: {
  campaign: Campaign;
  exchange: DebateExchange;
}): JSX.Element | null {
  if (!exchange.evaluation) return null;
  return (
    <div className="verdict">
      {exchange.evaluation.impacts.map((impact, index) => (
        <p key={index}>
          <strong>{name(campaign, impact.targetCandidateId)}:</strong> {impact.rationale}{' '}
          <span className="deltas">
            {impact.deltas.map((delta) => (
              <span key={delta.topicAreaId} className={`delta ${delta.delta >= 0 ? 'up' : 'down'}`}>
                {TOPIC_AREA_BY_ID[delta.topicAreaId].name} {delta.delta >= 0 ? '+' : ''}
                {delta.delta.toFixed(1)}
              </span>
            ))}
          </span>
        </p>
      ))}
      <p className="muted">
        <em>{exchange.evaluation.commentary}</em>
      </p>
    </div>
  );
}

function Transcript({ campaign, debateId }: { campaign: Campaign; debateId: string }): JSX.Element {
  const debate = campaign.debates.find((d) => d.id === debateId);
  if (!debate) return <></>;
  return (
    <div className="debate-transcript">
      {debate.exchanges.map((exchange) => (
        <div key={exchange.id} className="exchange">
          <p className="exchange-topic muted">
            Round {exchange.round} · {TOPIC_AREA_BY_ID[exchange.topicAreaId].name}
          </p>
          {exchange.question && (
            <div
              className={`speech question ${exchange.questionerId === campaign.playerCandidateId ? 'player' : ''}`}
              style={{ borderColor: partyOf(campaign, exchange.questionerId)?.colors.main }}
            >
              <span className="speaker">
                {name(campaign, exchange.questionerId)} asks {name(campaign, exchange.targetId)}
              </span>
              <p>{exchange.question}</p>
            </div>
          )}
          {exchange.answer && (
            <div
              className={`speech answer ${exchange.targetId === campaign.playerCandidateId ? 'player' : ''}`}
              style={{ borderColor: partyOf(campaign, exchange.targetId)?.colors.main }}
            >
              <span className="speaker">{name(campaign, exchange.targetId)}</span>
              <p>{exchange.answer}</p>
            </div>
          )}
          <ExchangeVerdict campaign={campaign} exchange={exchange} />
        </div>
      ))}
    </div>
  );
}

function CurrentAction(): JSX.Element | null {
  const { campaign, queue, command } = useStore();
  const [custom, setCustom] = useState('');
  if (!campaign) return null;
  const debate = activeDebate(campaign);
  if (!debate) return null;
  const playerId = campaign.playerCandidateId;
  const exchange = currentExchange(debate);
  const nextQuestioner = nextQuestionerId(debate);
  const activeJob = queue.find((j) => j.status === 'running' || j.status === 'pending');

  // Player must pick a target to open their exchange.
  if (!exchange && nextQuestioner === playerId) {
    return (
      <div className="debate-action">
        <p className="prompt-line">Your turn. Who do you challenge?</p>
        <div className="target-row">
          {campaign.candidates
            .filter((c) => c.id !== playerId)
            .map((candidate) => (
              <button
                key={candidate.id}
                className="option-btn"
                onClick={() => void command({ type: 'debateChooseTarget', targetId: candidate.id })}
              >
                {candidate.name}
                <span className="muted"> — {partyOf(campaign, candidate.id)?.name}</span>
              </button>
            ))}
        </div>
      </div>
    );
  }

  if (!exchange) return <Pending label={activeJob?.label ?? 'The moderators confer…'} />;

  const submit = (kind: 'question' | 'answer', text: string, isCustom: boolean): void => {
    if (kind === 'question') void command({ type: 'debateSubmitQuestion', text, custom: isCustom });
    else void command({ type: 'debateSubmitAnswer', text, custom: isCustom });
    setCustom('');
  };

  // Player asks: options ready?
  if (!exchange.question && exchange.questionerId === playerId) {
    if (!exchange.questionOptions) return <Pending label="Drafting your question…" />;
    return (
      <div className="debate-action">
        <p className="prompt-line">
          Question {name(campaign, exchange.targetId)} on{' '}
          {TOPIC_AREA_BY_ID[exchange.topicAreaId].name}:
        </p>
        {exchange.questionOptions.map((option, index) => (
          <button
            key={index}
            className="option-btn"
            onClick={() => submit('question', option, false)}
          >
            {option}
          </button>
        ))}
        <div className="free-text">
          <textarea
            rows={2}
            value={custom}
            placeholder="…or ask it your own way"
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn"
            disabled={!custom.trim()}
            onClick={() => submit('question', custom.trim(), true)}
          >
            Ask
          </button>
        </div>
      </div>
    );
  }

  // Player answers a question aimed at them.
  if (exchange.question && !exchange.answer && exchange.targetId === playerId) {
    if (!exchange.answerOptions) {
      return (
        <div className="debate-action">
          <div className="speech question">
            <span className="speaker">{name(campaign, exchange.questionerId)} asks you</span>
            <p>{exchange.question}</p>
          </div>
          <Pending label="Drafting your possible answers…" />
        </div>
      );
    }
    return (
      <div className="debate-action">
        <div className="speech question">
          <span className="speaker">{name(campaign, exchange.questionerId)} asks you</span>
          <p>{exchange.question}</p>
        </div>
        <p className="prompt-line">Your answer:</p>
        {exchange.answerOptions.map((option, index) => (
          <button
            key={index}
            className="option-btn"
            onClick={() => submit('answer', option, false)}
          >
            {option}
          </button>
        ))}
        <div className="free-text">
          <textarea
            rows={2}
            value={custom}
            placeholder="…or answer in your own words"
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className="btn"
            disabled={!custom.trim()}
            onClick={() => submit('answer', custom.trim(), true)}
          >
            Answer
          </button>
        </div>
      </div>
    );
  }

  // Otherwise the stage is waiting on generation (rival lines or the verdict).
  return <Pending label={activeJob?.label ?? 'On stage…'} />;
}

export function Debate(): JSX.Element {
  const { campaign, queue, navigate } = useStore();
  if (!campaign) return <Pending label="No campaign." />;
  const debate =
    activeDebate(campaign) ?? [...campaign.debates].reverse().find((d) => d.status === 'finished');
  if (!debate) {
    return (
      <Section title="Debate stage">
        <p className="muted">
          No debate today. Debates are scheduled for days{' '}
          {campaign.settings.debateDays.join(' and ')}.
        </p>
      </Section>
    );
  }
  const finished = debate.status === 'finished';
  const progress = `${debate.exchanges.filter((e) => e.evaluation).length}/${debate.order.length}`;

  return (
    <div className="debate-screen">
      <Section
        title={`National Debate — Day ${debate.day} ${finished ? '(concluded)' : `· exchange ${progress}`}`}
        actions={
          finished ? (
            <button className="btn primary" onClick={() => navigate({ name: 'hub' })}>
              Return to the trail →
            </button>
          ) : undefined
        }
      >
        <Transcript campaign={campaign} debateId={debate.id} />
        {!finished && <CurrentAction />}
        {finished && (
          <p className="muted">
            The stage lights dim. The analysts' verdicts are in the transcript above — and in the
            polls.
          </p>
        )}
        <FailedJobs jobs={queue.filter((j) => j.type.startsWith('debate'))} />
      </Section>
    </div>
  );
}
