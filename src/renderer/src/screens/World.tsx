/**
 * The World screen: in-campaign reference for everything created during world
 * building — the nation and its states, the opponent candidates, and the
 * player's own party platform. Read-only; hidden agendas of rivals stay hidden.
 */
import { useState } from 'react';
import { TOPIC_AREAS, TOPIC_AREA_BY_ID } from '@core/model/constants';
import type { Campaign, NationState } from '@core/model/schemas';
import { Pending, Section, formatPct, partyOf } from '../components/common';
import { useStore } from '../store';

type WorldTab = 'nation' | 'rivals' | 'party';

function StateCard({ state }: { state: NationState }): JSX.Element {
  const topics = [...TOPIC_AREAS].sort(
    (a, b) => state.topicWeights[b.id] - state.topicWeights[a.id],
  );
  // Bars are scaled to the state's top concern so differences stay readable.
  const topWeight = state.topicWeights[topics[0].id] || 1;
  return (
    <article className="person-card state-card">
      <header>
        <strong>{state.name}</strong>
        <span className="muted">{formatPct(state.populationWeight)} of voters</span>
      </header>
      <p className="muted">{state.description}</p>
      <p className="muted">
        <em>Cities:</em> {state.cities.join(', ')}
      </p>
      <div className="match-block">
        {topics.map((topic) => (
          <div key={topic.id} className="match-bar">
            <span className="match-label">{topic.name}</span>
            <span className="match-track">
              <span
                className="match-fill"
                style={{ width: `${(state.topicWeights[topic.id] / topWeight) * 100}%` }}
              />
            </span>
            <span className="match-value">{Math.round(state.topicWeights[topic.id] * 100)}%</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function NationTab({ campaign }: { campaign: Campaign }): JSX.Element {
  const nation = campaign.nation;
  if (!nation) return <Pending label="Shaping the nation…" />;
  return (
    <>
      <Section title={`🏛 ${nation.name}`}>
        <p>{nation.description}</p>
      </Section>
      <Section title="States & Regions">
        <p className="muted">
          Each state's concerns weigh its vote: strong approval on the topics a state cares about is
          what carries it.
        </p>
        <div className="state-grid">
          {nation.states.map((state) => (
            <StateCard key={state.id} state={state} />
          ))}
        </div>
      </Section>
    </>
  );
}

function RivalsTab({ campaign }: { campaign: Campaign }): JSX.Element {
  const rivals = campaign.candidates.filter((c) => c.id !== campaign.playerCandidateId);
  if (rivals.length === 0) return <Pending label="The rivals are stepping forward…" />;
  return (
    <Section title="Opponent Candidates">
      {rivals.map((rival) => {
        const party = partyOf(campaign, rival.id);
        return (
          <article
            key={rival.id}
            className="rival-card"
            style={{ borderLeftColor: party?.colors.main }}
          >
            <header>
              <strong>{rival.name}</strong>{' '}
              <span className="muted">
                {rival.age}, {rival.gender} —{' '}
                <span className="party-code" style={{ background: party?.colors.main }}>
                  {party?.code}
                </span>{' '}
                {party?.name}
              </span>
            </header>
            <p className="muted">{rival.bio}</p>
            <p>Stands for: {party?.publicAgenda}</p>
          </article>
        );
      })}
      {rivals.length < campaign.settings.rivalCount && (
        <Pending label="The next rival steps forward…" />
      )}
    </Section>
  );
}

function PartyTab({ campaign }: { campaign: Campaign }): JSX.Element {
  const party = campaign.parties.find((p) => p.id === campaign.playerPartyId);
  if (!party) return <Pending label="No party." />;
  return (
    <>
      <Section title={`${party.name} (${party.code})`}>
        <p>
          <strong>Public agenda:</strong> {party.publicAgenda}
        </p>
        <p className="muted">
          <strong>Hidden agenda</strong> <em>(only you can see this)</em>: {party.hiddenAgenda}
        </p>
      </Section>
      <Section title="Official Platform">
        {party.policies.length === 0 ? (
          <Pending label="Writing the party platform…" />
        ) : (
          <ul className="platform-list">
            {party.policies.map((policy) => (
              <li key={policy.topicAreaId}>
                <strong>
                  {TOPIC_AREA_BY_ID[policy.topicAreaId].name} — {policy.title}.
                </strong>{' '}
                <span className="muted">{policy.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

export function World(): JSX.Element {
  const { campaign } = useStore();
  const [tab, setTab] = useState<WorldTab>('nation');
  if (!campaign) return <Pending label="No campaign." />;

  const tabs: Array<{ id: WorldTab; label: string }> = [
    { id: 'nation', label: '🏛 Nation & States' },
    { id: 'rivals', label: '⚔ Rivals' },
    { id: 'party', label: '★ Your Party' },
  ];

  return (
    <div className="world-screen">
      <div className="view-tabs">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            className={`view-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'nation' && <NationTab campaign={campaign} />}
      {tab === 'rivals' && <RivalsTab campaign={campaign} />}
      {tab === 'party' && <PartyTab campaign={campaign} />}
    </div>
  );
}
