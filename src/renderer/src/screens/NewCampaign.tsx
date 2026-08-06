import { useEffect, useState } from 'react';
import { isCoreSetupReady } from '@core/campaign/status';
import { COUNCILOR_POSITION_BY_ID, TOPIC_AREA_BY_ID } from '@core/model/constants';
import type { Campaign, CouncilorPositionId } from '@core/model/schemas';
import { COUNCILOR_POSITION_IDS } from '@core/model/schemas';
import { positionCouncilors } from '@core/model/queries';
import { isCandidateSeeded } from '@core/sim/opinion';
import { invoke } from '../api';
import { FailedJobs, Pending, Section, Spinner, partyOf } from '../components/common';
import { useStore } from '../store';

interface CandidateForm {
  name: string;
  age: string;
  gender: string;
  bio: string;
}
interface PartyForm {
  name: string;
  code: string;
  main: string;
  secondary: string;
  publicAgenda: string;
  hiddenAgenda: string;
}

function CandidateStep({ onNext }: { onNext: (form: CandidateForm) => void }): JSX.Element {
  const [form, setForm] = useState<CandidateForm>({ name: '', age: '45', gender: '', bio: '' });
  const valid = form.name.trim() && form.gender.trim() && form.bio.trim() && Number(form.age) >= 18;
  return (
    <Section title="Step 1 — Your Candidate">
      <p className="muted">
        You <em>are</em> the candidate. Everything the world writes about you grows from this.
      </p>
      <div className="form-grid">
        <label>
          Full name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Age
          <input
            type="number"
            min={18}
            max={99}
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
        </label>
        <label>
          Gender
          <input
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            placeholder="free text"
          />
        </label>
        <label className="span-2">
          Short bio <span className="muted">(who are you, before politics?)</span>
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="A harbor-town schoolteacher who sued the water company and won…"
          />
        </label>
      </div>
      <button className="btn primary" disabled={!valid} onClick={() => onNext(form)}>
        Continue → Found your party
      </button>
    </Section>
  );
}

function PartyStep({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (form: PartyForm) => void;
}): JSX.Element {
  const [form, setForm] = useState<PartyForm>({
    name: '',
    code: '',
    main: '#c9a227',
    secondary: '#1d3557',
    publicAgenda: '',
    hiddenAgenda: '',
  });
  const valid =
    form.name.trim() &&
    /^\d{2}$/.test(form.code) &&
    form.publicAgenda.trim() &&
    form.hiddenAgenda.trim();
  return (
    <Section title="Step 2 — Your Party">
      <div className="form-grid">
        <label>
          Party name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. UPF — Union for Progress"
          />
        </label>
        <label>
          Ballot code <span className="muted">(two digits)</span>
          <input
            value={form.code}
            maxLength={2}
            onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
            placeholder="27"
          />
        </label>
        <label>
          Main color
          <input
            type="color"
            value={form.main}
            onChange={(e) => setForm({ ...form, main: e.target.value })}
          />
        </label>
        <label>
          Secondary color
          <input
            type="color"
            value={form.secondary}
            onChange={(e) => setForm({ ...form, secondary: e.target.value })}
          />
        </label>
        <label className="span-2">
          Public agenda <span className="muted">(what you promise the nation)</span>
          <textarea
            rows={3}
            value={form.publicAgenda}
            onChange={(e) => setForm({ ...form, publicAgenda: e.target.value })}
            placeholder="Honest budgets, strong schools, and a government that answers its phone."
          />
        </label>
        <label className="span-2">
          Hidden agenda <span className="muted">(what you actually want — only you know this)</span>
          <textarea
            rows={3}
            value={form.hiddenAgenda}
            onChange={(e) => setForm({ ...form, hiddenAgenda: e.target.value })}
            placeholder="Quietly dismantle the port monopoly that ruined my family."
          />
        </label>
      </div>
      <div className="wizard-actions">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" disabled={!valid} onClick={() => onSubmit(form)}>
          Found the party → Generate the world
        </button>
      </div>
    </Section>
  );
}

const TIPS = [
  'Your hidden agenda is your real score. The epilogue judges how far you advanced what you actually want — winning the presidency while abandoning it counts for little.',
  'Approval lives per state and per topic. A message that lands in one region can fall flat in another — watch each state’s top concern.',
  'Councilors are force multipliers. Assign them a mission every day: campaign in a state, promote a topic, court an influencer, or prep you for the debates.',
  'Debates reward consistency. The analysts remember your past statements — contradicting yourself on stage costs approval.',
  'Breaking stories demand a response before the day can end. The safe option is rarely the best one — but the bold one can backfire.',
];

/** Something to read while the first (and slowest) generation runs. */
function TipsCarousel(): JSX.Element {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), 9000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="tips-carousel">
      <p className="tip-kicker">While the ink dries — tips from the trail</p>
      <p className="tip-text">{TIPS[index]}</p>
      <div className="tip-dots">
        {TIPS.map((tip, i) => (
          <button
            key={tip}
            className={`tip-dot ${i === index ? 'active' : ''}`}
            aria-label={`Tip ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

function NationCard({ nation }: { nation: NonNullable<Campaign['nation']> }): JSX.Element {
  return (
    <div className="setup-block">
      <h3>🏛 {nation.name}</h3>
      <p>{nation.description}</p>
      <ul className="state-list">
        {nation.states.map((state) => (
          <li key={state.id}>
            <strong>{state.name}</strong> <span className="muted">— {state.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Inline hiring for one position; options appear as the engine writes them. */
function CouncilorPick({
  positionId,
  generating,
}: {
  positionId: CouncilorPositionId;
  generating: boolean;
}): JSX.Element {
  const { campaign, command } = useStore();
  if (!campaign) return <></>;
  const position = COUNCILOR_POSITION_BY_ID[positionId];
  const hired = campaign.councilors.hired[positionId];
  const pool = campaign.councilors.pool[positionId] ?? [];

  return (
    <div className="councilor-pick">
      <h4>
        {position.title} <span className="muted">— {position.description}</span>
      </h4>
      {hired ? (
        <p className="picked">
          ✓ {hired.name} joined the campaign. <span className="muted">{hired.bio}</span>
        </p>
      ) : (
        <div className="pool-grid">
          {pool.map((applicant) => (
            <article key={applicant.id} className="person-card">
              <header>
                <strong>{applicant.name}</strong>
                <span className="muted">
                  {applicant.age}, {applicant.gender}
                </span>
              </header>
              <p>{applicant.bio}</p>
              <p className="muted">
                <em>Views:</em> {applicant.politicalViews} · <em>Personality:</em>{' '}
                {applicant.personality}
              </p>
              <footer className="person-actions">
                <button
                  className="btn small primary"
                  onClick={() =>
                    void command({ type: 'hireCouncilor', positionId, councilorId: applicant.id })
                  }
                >
                  Hire
                </button>
              </footer>
            </article>
          ))}
          {pool.length < campaign.settings.councilorPoolSize &&
            (generating ? (
              <Pending label="Applications coming in…" />
            ) : (
              <p className="muted queued-note">◦ Applications open once the engine gets here.</p>
            ))}
        </div>
      )}
    </div>
  );
}

function WorldStep(): JSX.Element {
  const { campaign, queue, command, navigate } = useStore();
  if (!campaign) return <Pending label="Preparing…" />;
  const ready = isCoreSetupReady(campaign);
  const settings = campaign.settings;
  const rivals = campaign.candidates.filter((c) => c.id !== campaign.playerCandidateId);
  const playerParty = campaign.parties.find((p) => p.id === campaign.playerPartyId);
  const seededCount = campaign.candidates.filter((c) => isCandidateSeeded(campaign, c.id)).length;
  const candidateTotal = settings.rivalCount + 1;
  const rivalsDone = rivals.length >= settings.rivalCount;
  const opinionDone = seededCount >= candidateTotal;
  // A position's assessments are done only once its applicants exist: the pool
  // is at full size (or someone was hired, which stops pool generation) and
  // everyone attached to it — hired included — has an agenda fit.
  const matchesDone = COUNCILOR_POSITION_IDS.every((id) => {
    const poolFilled =
      Boolean(campaign.councilors.hired[id]) ||
      (campaign.councilors.pool[id]?.length ?? 0) >= settings.councilorPoolSize;
    return poolFilled && positionCouncilors(campaign, id).every((c) => c.agendaMatch);
  });
  const influencersDone = campaign.influencers.length >= settings.influencerCount;

  const working =
    queue.find((j) => j.status === 'running') ?? queue.find((j) => j.status === 'pending');
  const workingPoolPosition =
    working?.type === 'councilor.pool'
      ? COUNCILOR_POSITION_IDS.find((id) => working.key.includes(id))
      : undefined;
  // Councilor sections appear one by one, as the engine reaches each position.
  const visiblePositions = COUNCILOR_POSITION_IDS.filter(
    (id) =>
      campaign.councilors.hired[id] ||
      (campaign.councilors.pool[id]?.length ?? 0) > 0 ||
      id === workingPoolPosition,
  );

  const item = (
    state: 'done' | 'active' | 'queued',
    label: string,
    detail?: string,
  ): JSX.Element => (
    <li className={`gen-item ${state === 'done' ? 'done' : ''}`}>
      {state === 'done' ? '✓' : state === 'active' ? <Spinner /> : '◦'} <span>{label}</span>
      {detail && <em className="muted"> — {detail}</em>}
    </li>
  );
  const stateOf = (done: boolean, activeTypes: string[]): 'done' | 'active' | 'queued' =>
    done ? 'done' : working && activeTypes.includes(working.type) ? 'active' : 'queued';

  return (
    <Section title="Step 3 — The World Takes Shape">
      <p className="muted">
        The world is written one piece at a time — read each part as it arrives. You can start as
        soon as the essentials are in; everything else keeps arriving in the background, even after
        the campaign begins.
      </p>
      {working && !ready && (
        <div className="now-line">
          <Spinner /> <span>{working.label}</span>
        </div>
      )}
      <FailedJobs jobs={queue} />

      {campaign.nation ? <NationCard nation={campaign.nation} /> : <TipsCarousel />}

      {campaign.nation && (
        <div className="setup-block">
          <h3>🤝 Your council</h3>
          <p className="muted">
            Three applicants per position. Hire now, later, or never — the campaign can start
            without them. Agenda-fit assessments arrive in the background.
          </p>
          {visiblePositions.map((positionId) => (
            <CouncilorPick
              key={positionId}
              positionId={positionId}
              generating={positionId === workingPoolPosition}
            />
          ))}
          {visiblePositions.length === 0 && <Pending label="Opening the applications book…" />}
        </div>
      )}

      {rivals.length > 0 && (
        <div className="setup-block">
          <h3>
            ⚔ Your rivals ({rivals.length}/{settings.rivalCount})
          </h3>
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
                    {rival.age}, {party?.name} ({party?.code})
                  </span>
                </header>
                <p className="muted">{rival.bio}</p>
                <p>Stands for: {party?.publicAgenda}</p>
              </article>
            );
          })}
          {!rivalsDone && <Pending label="The next rival steps forward…" />}
        </div>
      )}

      {rivalsDone && !opinionDone && (
        <Pending
          label={`Pollsters take the nation's temperature (${seededCount}/${candidateTotal} candidates polled)…`}
        />
      )}

      <div className="setup-summary">
        <p className="muted">
          <strong>Essentials</strong> (needed before the campaign starts):
        </p>
        <ul className="gen-list">
          {item(stateOf(Boolean(campaign.nation), ['world.generate']), 'Nation')}
          {item(
            stateOf(rivalsDone, ['rival.generate']),
            `Rival candidates (${rivals.length}/${settings.rivalCount})`,
          )}
          {item(
            stateOf(opinionDone, ['opinion.seed']),
            `Initial public opinion (${seededCount}/${candidateTotal} candidates polled)`,
          )}
        </ul>
        <p className="muted">
          <strong>Arriving in the background</strong> — placeholders until then; no need to wait:
        </p>
        <ul className="gen-list">
          {item(
            stateOf(matchesDone, ['councilor.match']),
            'Agenda-fit assessments of your applicants',
          )}
          {item(
            stateOf((playerParty?.policies.length ?? 0) > 0, ['party.policies']),
            'Party platform',
            (playerParty?.policies.length ?? 0) > 0
              ? playerParty?.policies.map((p) => TOPIC_AREA_BY_ID[p.topicAreaId].name).join(', ')
              : 'drafted while you campaign',
          )}
          {item(
            stateOf(influencersDone, ['influencers.generate']),
            `Influencer scene (${campaign.influencers.length}/${settings.influencerCount} scouted)`,
          )}
        </ul>
      </div>

      {playerParty && playerParty.policies.length > 0 && (
        <details className="platform-preview">
          <summary>Review your generated platform</summary>
          <ul>
            {playerParty.policies.map((p) => (
              <li key={p.topicAreaId}>
                <strong>
                  {TOPIC_AREA_BY_ID[p.topicAreaId].name} — {p.title}.
                </strong>{' '}
                <span className="muted">{p.summary}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="wizard-actions">
        <button className="btn" onClick={() => navigate({ name: 'councilors' })}>
          Review councilor applicants
        </button>
        <button
          className="btn primary big"
          disabled={!ready}
          onClick={() => {
            void command({ type: 'startCampaign' }).then((ok) => ok && navigate({ name: 'hub' }));
          }}
        >
          {ready ? 'Start the campaign!' : 'Waiting for the essentials…'}
        </button>
      </div>
    </Section>
  );
}

export function NewCampaign(): JSX.Element {
  const { campaign, showError } = useStore();
  const [step, setStep] = useState<'candidate' | 'party'>('candidate');
  const [candidate, setCandidate] = useState<CandidateForm | null>(null);

  // A campaign in setup already exists → jump straight to the world step.
  if (campaign && campaign.phase === 'setup') return <WorldStep />;
  if (campaign && campaign.phase !== 'setup') {
    return (
      <Section title="A campaign is already running">
        <p className="muted">
          Close or finish the current campaign before starting a new one (Menu → Load, or save
          first).
        </p>
      </Section>
    );
  }

  const create = async (party: PartyForm): Promise<void> => {
    if (!candidate) return;
    const reply = await invoke('campaign.new', {
      candidate: {
        name: candidate.name.trim(),
        age: Number(candidate.age),
        gender: candidate.gender.trim(),
        bio: candidate.bio.trim(),
      },
      party: {
        name: party.name.trim(),
        code: party.code,
        colors: { main: party.main, secondary: party.secondary },
        publicAgenda: party.publicAgenda.trim(),
        hiddenAgenda: party.hiddenAgenda.trim(),
      },
    });
    if (!reply.ok) showError(reply.error);
  };

  return (
    <div className="wizard-screen">
      {step === 'candidate' && (
        <CandidateStep
          onNext={(form) => {
            setCandidate(form);
            setStep('party');
          }}
        />
      )}
      {step === 'party' && (
        <PartyStep onBack={() => setStep('candidate')} onSubmit={(form) => void create(form)} />
      )}
    </div>
  );
}
