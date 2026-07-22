import { useState } from 'react';
import { TOPIC_AREAS } from '@core/model/constants';
import { Pending, Section, ShareBars, formatPct, partyOf } from '../components/common';
import { useStore } from '../store';

export function Surveys(): JSX.Element {
  const { campaign } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!campaign) return <Pending label="No campaign." />;
  const surveys = campaign.surveys;
  if (surveys.length === 0) {
    return (
      <Section title="Surveys">
        <p className="muted">No surveys published yet.</p>
      </Section>
    );
  }
  const survey = surveys.find((s) => s.id === selectedId) ?? surveys[surveys.length - 1];
  const states = campaign.nation?.states ?? [];

  return (
    <div className="surveys-screen">
      <Section
        title={`National Survey — Day ${survey.day}`}
        actions={
          <select
            value={survey.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="survey-select"
          >
            {[...surveys].reverse().map((s) => (
              <option key={s.id} value={s.id}>
                Day {s.day}
              </option>
            ))}
          </select>
        }
      >
        <ShareBars campaign={campaign} shares={survey.national} />
        {surveys.length > 1 && (
          <p className="muted trend-line">
            {(() => {
              const previous = surveys.filter((s) => s.day < survey.day).pop();
              if (!previous) return 'First published survey.';
              const playerId = campaign.playerCandidateId;
              const diff = (survey.national[playerId] ?? 0) - (previous.national[playerId] ?? 0);
              return `Your movement since day ${previous.day}: ${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)} points.`;
            })()}
          </p>
        )}
      </Section>

      <Section title="By State">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th>
                {campaign.candidates.map((candidate) => (
                  <th key={candidate.id}>
                    <span
                      className="party-code"
                      style={{ background: partyOf(campaign, candidate.id)?.colors.main }}
                    >
                      {partyOf(campaign, candidate.id)?.code}
                    </span>{' '}
                    {candidate.name.split(' ').slice(-1)[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map((state) => {
                const row = survey.byState[state.id] ?? {};
                const leaderId = Object.entries(row).sort((a, b) => b[1] - a[1])[0]?.[0];
                return (
                  <tr key={state.id}>
                    <td title={state.description}>{state.name}</td>
                    {campaign.candidates.map((candidate) => (
                      <td key={candidate.id} className={candidate.id === leaderId ? 'leading' : ''}>
                        {formatPct(row[candidate.id] ?? 0)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Approval by Topic (national, 0–100)">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Topic</th>
                {campaign.candidates.map((candidate) => (
                  <th key={candidate.id}>{candidate.name.split(' ').slice(-1)[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOPIC_AREAS.map((topic) => {
                const row = survey.topicApproval[topic.id] ?? {};
                return (
                  <tr key={topic.id}>
                    <td>{topic.name}</td>
                    {campaign.candidates.map((candidate) => (
                      <td key={candidate.id}>{Math.round(row[candidate.id] ?? 0)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
