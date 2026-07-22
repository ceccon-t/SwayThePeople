import type { ReactNode } from 'react';
import type { Campaign } from '@core/model/schemas';
import type { JobSnapshot } from '@core/generation/jobs';
import { invoke } from '../api';

export function Spinner(): JSX.Element {
  return <span className="spinner" aria-label="working" />;
}

/** House async pattern: something is being generated for this spot. */
export function Pending({ label }: { label: string }): JSX.Element {
  return (
    <div className="pending-card">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Section({
  title,
  children,
  actions,
  className,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={`section ${className ?? ''}`}>
      <header className="section-header">
        <h2>{title}</h2>
        {actions && <div className="section-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function formatPct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

export function partyOf(campaign: Campaign, candidateId: string) {
  const candidate = campaign.candidates.find((c) => c.id === candidateId);
  return campaign.parties.find((p) => p.id === candidate?.partyId);
}

/** Horizontal share bars for standings (sorted, party-colored). */
export function ShareBars({
  campaign,
  shares,
  compact,
}: {
  campaign: Campaign;
  shares: Record<string, number>;
  compact?: boolean;
}): JSX.Element {
  const sorted = Object.entries(shares).sort((a, b) => b[1] - a[1]);
  return (
    <div className={`share-bars ${compact ? 'compact' : ''}`}>
      {sorted.map(([candidateId, share]) => {
        const candidate = campaign.candidates.find((c) => c.id === candidateId);
        const party = partyOf(campaign, candidateId);
        const isPlayer = candidateId === campaign.playerCandidateId;
        return (
          <div key={candidateId} className={`share-row ${isPlayer ? 'is-player' : ''}`}>
            <span className="share-name">
              {candidate?.name ?? '?'}
              {party && (
                <span className="party-code" style={{ background: party.colors.main }}>
                  {party.code}
                </span>
              )}
            </span>
            <span className="share-track">
              <span
                className="share-fill"
                style={{ width: `${Math.min(100, share * 100)}%`, background: party?.colors.main }}
              />
            </span>
            <span className="share-value">{formatPct(share)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Failed generation jobs with retry buttons (rendered wherever relevant). */
export function FailedJobs({ jobs }: { jobs: JobSnapshot[] }): JSX.Element | null {
  const failed = jobs.filter((j) => j.status === 'failed');
  if (failed.length === 0) return null;
  return (
    <div className="failed-jobs">
      {failed.map((jobItem) => (
        <div key={jobItem.key} className="failed-job">
          <span>
            ⚠ {jobItem.label} <em>({jobItem.error})</em>
          </span>
          <button
            className="btn small"
            onClick={() => void invoke('generation.retry', { key: jobItem.key })}
          >
            Retry
          </button>
        </div>
      ))}
    </div>
  );
}
