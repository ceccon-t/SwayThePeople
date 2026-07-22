import { COUNCILOR_POSITIONS } from '@core/model/constants';
import type { Councilor } from '@core/model/schemas';
import { FailedJobs, Pending, Section } from '../components/common';
import { useStore } from '../store';

function MatchBar({ label, score }: { label: string; score: number }): JSX.Element {
  return (
    <div className="match-bar">
      <span className="match-label">{label}</span>
      <span className="match-track">
        <span className="match-fill" style={{ width: `${score}%` }} />
      </span>
      <span className="match-value">{Math.round(score)}</span>
    </div>
  );
}

function CouncilorCard({
  councilor,
  hired,
  onHire,
  onFire,
  onChat,
}: {
  councilor: Councilor;
  hired: boolean;
  onHire?: () => void;
  onFire?: () => void;
  onChat?: () => void;
}): JSX.Element {
  return (
    <article className={`person-card ${hired ? 'hired' : ''}`}>
      <header>
        <strong>{councilor.name}</strong>
        <span className="muted">
          {councilor.age}, {councilor.gender}
        </span>
      </header>
      <p>{councilor.bio}</p>
      <p className="muted">
        <em>Views:</em> {councilor.politicalViews} · <em>Personality:</em> {councilor.personality}
      </p>
      {councilor.agendaMatch ? (
        <div className="match-block">
          <MatchBar label="Public fit" score={councilor.agendaMatch.publicScore} />
          <MatchBar label="Hidden fit" score={councilor.agendaMatch.hiddenScore} />
          <p className="muted match-commentary">“{councilor.agendaMatch.commentary}”</p>
        </div>
      ) : (
        <p className="muted">Agenda fit being assessed…</p>
      )}
      <footer className="person-actions">
        {onHire && (
          <button className="btn small primary" onClick={onHire}>
            Hire
          </button>
        )}
        {onChat && (
          <button className="btn small" onClick={onChat}>
            Chat
          </button>
        )}
        {onFire && (
          <button className="btn small danger" onClick={onFire}>
            Fire
          </button>
        )}
      </footer>
    </article>
  );
}

export function Councilors(): JSX.Element {
  const { campaign, queue, command, navigate } = useStore();
  if (!campaign) return <Pending label="No campaign." />;

  return (
    <div className="councilors-screen">
      <FailedJobs jobs={queue.filter((j) => j.type.startsWith('councilor'))} />
      {COUNCILOR_POSITIONS.map((position) => {
        const hired = campaign.councilors.hired[position.id] ?? null;
        const pool = campaign.councilors.pool[position.id] ?? [];
        return (
          <Section key={position.id} title={position.title}>
            <p className="muted">{position.description}</p>
            {hired ? (
              <div className="hired-row">
                <CouncilorCard
                  councilor={hired}
                  hired
                  onChat={() => navigate({ name: 'chat', councilorId: hired.id })}
                  onFire={() => void command({ type: 'fireCouncilor', positionId: position.id })}
                />
              </div>
            ) : (
              <>
                <p className="muted">
                  <strong>Position open.</strong> Applications on file:
                </p>
                <div className="pool-grid">
                  {pool.map((applicant) => (
                    <CouncilorCard
                      key={applicant.id}
                      councilor={applicant}
                      hired={false}
                      onHire={() =>
                        void command({
                          type: 'hireCouncilor',
                          positionId: position.id,
                          councilorId: applicant.id,
                        })
                      }
                    />
                  ))}
                  {pool.length < campaign.settings.councilorPoolSize && (
                    <Pending label="More applications are coming in…" />
                  )}
                </div>
              </>
            )}
          </Section>
        );
      })}
    </div>
  );
}
