import { useState } from 'react';
import { currentDayEvent, dayEndBlocker } from '@core/campaign/status';
import { COUNCILOR_POSITIONS, TOPIC_AREAS, TOPIC_AREA_BY_ID } from '@core/model/constants';
import type { CampaignEvent, MissionAssignment, TopicAreaId } from '@core/model/schemas';
import { activeDebate } from '@core/sim/debates';
import { computeShares } from '@core/sim/opinion';
import { currentDayRecord } from '@core/sim/schedule';
import { FailedJobs, Pending, Section, ShareBars, Spinner } from '../components/common';
import { useStore } from '../store';

function EventCard(): JSX.Element | null {
  const { campaign, command } = useStore();
  const [custom, setCustom] = useState('');
  if (!campaign) return null;
  const record = currentDayRecord(campaign);
  const event = currentDayEvent(campaign);

  if (!record?.eventPlanned) {
    return (
      <div className="event-card quiet">
        <p className="muted">A quiet news day. Use it well.</p>
      </div>
    );
  }
  if (!event) return <Pending label="A story is breaking…" />;

  const respond = (text: string, isCustom: boolean): void => {
    void command({ type: 'respondEvent', eventId: event.id, text, custom: isCustom });
    setCustom('');
  };

  return (
    <div className="event-card">
      <h3 className="event-title">⚡ {event.title}</h3>
      <p>{event.description}</p>
      <p className="muted">
        Topic: {TOPIC_AREA_BY_ID[event.topicAreaId].name}
        {event.stateId &&
          ` · Region: ${campaign.nation?.states.find((s) => s.id === event.stateId)?.name ?? ''}`}
      </p>
      {!event.response && (
        <div className="event-options">
          <p className="prompt-line">How do you respond, candidate?</p>
          {event.options.map((option, index) => (
            <button key={index} className="option-btn" onClick={() => respond(option, false)}>
              {option}
            </button>
          ))}
          <div className="free-text">
            <textarea
              rows={2}
              value={custom}
              placeholder="…or speak in your own words"
              onChange={(e) => setCustom(e.target.value)}
            />
            <button
              className="btn"
              disabled={!custom.trim()}
              onClick={() => respond(custom.trim(), true)}
            >
              Say it
            </button>
          </div>
        </div>
      )}
      {event.response && !event.evaluation && (
        <div className="event-response">
          <p className="quote">“{event.response.text}”</p>
          <Pending label="The public weighs your response…" />
        </div>
      )}
      {event.response && event.evaluation && (
        <div className="event-response">
          <p className="quote">“{event.response.text}”</p>
          <EventVerdict event={event} />
        </div>
      )}
    </div>
  );
}

function EventVerdict({ event }: { event: CampaignEvent }): JSX.Element | null {
  if (!event.evaluation) return null;
  const impact = event.evaluation.impact;
  return (
    <div className="verdict">
      <p>
        <strong>Verdict:</strong> {impact.rationale}
      </p>
      <p className="deltas">
        {impact.deltas.map((delta) => (
          <span key={delta.topicAreaId} className={`delta ${delta.delta >= 0 ? 'up' : 'down'}`}>
            {TOPIC_AREA_BY_ID[delta.topicAreaId].name} {delta.delta >= 0 ? '+' : ''}
            {delta.delta.toFixed(1)}
          </span>
        ))}
      </p>
    </div>
  );
}

function MissionRow({ positionId }: { positionId: string }): JSX.Element | null {
  const { campaign, command } = useStore();
  if (!campaign) return null;
  const councilor = campaign.councilors.hired[positionId];
  const position = COUNCILOR_POSITIONS.find((p) => p.id === positionId);
  if (!councilor || !position) return null;
  const assignment = campaign.missions.assignments[positionId] ?? null;
  const states = campaign.nation?.states ?? [];
  // Uncommitted influencers can be courted; your own supporters can be
  // courted further until their commitment hits 100.
  const courtable = campaign.influencers.filter(
    (i) =>
      !i.endorsement ||
      (i.endorsement.candidateId === campaign.playerCandidateId &&
        (i.partyAffinity[campaign.playerPartyId] ?? 50) < 100),
  );

  const assign = (value: string): void => {
    let missionAssignment: MissionAssignment | null = null;
    const [kind, param] = value.split('|');
    if (kind === 'campaignState' && param)
      missionAssignment = { type: 'campaignState', stateId: param };
    if (kind === 'promoteTopic' && param)
      missionAssignment = { type: 'promoteTopic', topicAreaId: param as TopicAreaId };
    if (kind === 'courtInfluencer' && param)
      missionAssignment = { type: 'courtInfluencer', influencerId: param };
    if (kind === 'debatePrep') missionAssignment = { type: 'debatePrep' };
    void command({ type: 'assignMission', positionId, assignment: missionAssignment });
  };

  const currentValue = assignment
    ? assignment.type === 'campaignState'
      ? `campaignState|${assignment.stateId}`
      : assignment.type === 'promoteTopic'
        ? `promoteTopic|${assignment.topicAreaId}`
        : assignment.type === 'courtInfluencer'
          ? `courtInfluencer|${assignment.influencerId}`
          : 'debatePrep'
    : '';

  return (
    <div className="mission-row">
      <div className="mission-who">
        <strong>{councilor.name}</strong>
        <span className="muted">{position.title}</span>
      </div>
      <select value={currentValue} onChange={(e) => assign(e.target.value)}>
        <option value="">— No mission today —</option>
        <optgroup label="Campaign in a state">
          {states.map((state) => (
            <option key={state.id} value={`campaignState|${state.id}`}>
              Campaign in {state.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Promote a topic nationally">
          {TOPIC_AREAS.map((topic) => (
            <option key={topic.id} value={`promoteTopic|${topic.id}`}>
              Promote {topic.name}
            </option>
          ))}
        </optgroup>
        {courtable.length > 0 && (
          <optgroup label="Court an influencer">
            {courtable.map((influencer) => (
              <option key={influencer.id} value={`courtInfluencer|${influencer.id}`}>
                {influencer.endorsement
                  ? `Deepen ties with ${influencer.name} (${influencer.domain})`
                  : `Court ${influencer.name} (${influencer.domain})`}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Preparation">
          <option value="debatePrep">Debate prep</option>
        </optgroup>
      </select>
    </div>
  );
}

export function Hub(): JSX.Element {
  const { campaign, queue, command, navigate } = useStore();
  if (!campaign) {
    return (
      <Section title="No campaign">
        <p className="muted">Start a new campaign or load one from the menu.</p>
      </Section>
    );
  }
  if (campaign.phase === 'setup') {
    return (
      <Section title="The campaign has not started yet">
        <button className="btn primary" onClick={() => navigate({ name: 'wizard' })}>
          Back to campaign setup
        </button>
      </Section>
    );
  }

  const blocker = dayEndBlocker(campaign);
  const debate = activeDebate(campaign);
  const shares = computeShares(campaign, null, 0);
  const hiredCount = Object.values(campaign.councilors.hired).filter(Boolean).length;
  const yesterday = campaign.days.find((d) => d.day === campaign.day - 1);
  const recentLog = [...campaign.log].slice(-12).reverse();
  const prepBonus = campaign.missions.debatePrepBonus;

  return (
    <div className="hub-screen">
      <div className="hub-col main-col">
        {debate && (
          <div className="debate-banner">
            <span>🎙 The national debate is live.</span>
            <button className="btn primary" onClick={() => navigate({ name: 'debate' })}>
              Take the stage
            </button>
          </div>
        )}
        <Section title={`Day ${campaign.day} — Today's Story`}>
          <EventCard />
        </Section>
        <Section title="Missions for Today">
          {hiredCount === 0 ? (
            <p className="muted">
              No councilors hired.{' '}
              <button className="btn small" onClick={() => navigate({ name: 'councilors' })}>
                Hire your team
              </button>
            </p>
          ) : (
            <>
              {COUNCILOR_POSITIONS.map((position) => (
                <MissionRow key={position.id} positionId={position.id} />
              ))}
              {prepBonus > 0 && (
                <p className="muted">Debate prep stored: +{prepBonus} session(s).</p>
              )}
            </>
          )}
        </Section>
        <div className="day-end">
          <button
            className="btn primary big"
            disabled={Boolean(blocker)}
            onClick={() => void command({ type: 'endDay' })}
          >
            {campaign.day >= campaign.settings.totalDays
              ? 'End final day → Election night'
              : 'End the day →'}
          </button>
          {blocker && (
            <p className="blocker">
              {blocker.reason === 'eventPending' && <Spinner />} {blocker.detail}
            </p>
          )}
        </div>
        <FailedJobs jobs={queue} />
      </div>

      <div className="hub-col side-col">
        <Section title="Standings" className="standings">
          <ShareBars campaign={campaign} shares={shares.national} compact />
          <button className="btn small ghost" onClick={() => navigate({ name: 'surveys' })}>
            Full surveys →
          </button>
        </Section>
        {yesterday && yesterday.outcomes.length > 0 && (
          <Section title={`Yesterday's Briefing (day ${yesterday.day})`}>
            {yesterday.reportText ? (
              <p className="report-text">{yesterday.reportText}</p>
            ) : (
              <Pending label="Writing the daily briefing…" />
            )}
          </Section>
        )}
        <Section title="Campaign Log">
          <ul className="log-list">
            {recentLog.map((entry) => (
              <li key={entry.id} className={`log-entry kind-${entry.kind}`}>
                <span className="log-day">D{entry.day}</span> {entry.text}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
