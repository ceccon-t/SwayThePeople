import { invoke } from '../api';
import { FailedJobs, Pending, Section, ShareBars, formatPct, partyOf } from '../components/common';
import { useStore } from '../store';

export function Election(): JSX.Element {
  const { campaign, queue, navigate, showError } = useStore();
  if (!campaign?.result) {
    return (
      <Section title="Election Night">
        <p className="muted">The votes have not been counted yet.</p>
      </Section>
    );
  }
  const result = campaign.result;
  const winner = campaign.candidates.find((c) => c.id === result.winnerId);
  const winnerParty = winner ? partyOf(campaign, winner.id) : null;
  const player = campaign.candidates.find((c) => c.id === campaign.playerCandidateId);
  const playerWon = result.winnerId === campaign.playerCandidateId;
  const placing = result.ordering.indexOf(campaign.playerCandidateId) + 1;
  const states = campaign.nation?.states ?? [];
  const epilogueFailed = queue.some((j) => j.type === 'election.epilogue' && j.status === 'failed');

  const closeCampaign = async (): Promise<void> => {
    const reply = await invoke('campaign.close');
    if (!reply.ok) {
      showError(reply.error);
      return;
    }
    navigate({ name: 'menu' });
  };

  return (
    <div className="election-screen">
      <div className="election-headline" style={{ borderColor: winnerParty?.colors.main }}>
        <p className="election-kicker">The nation has spoken</p>
        <h1>
          {winner?.name} {playerWon ? 'wins the presidency!' : 'takes the presidency.'}
        </h1>
        <p className="muted">
          {playerWon
            ? 'Your name will open the next chapter of the almanacs.'
            : `You placed #${placing} of ${campaign.candidates.length}, with ${formatPct(result.national[campaign.playerCandidateId] ?? 0)} of the national vote.`}
        </p>
      </div>

      <Section title="National Result">
        <ShareBars campaign={campaign} shares={result.national} />
      </Section>

      <Section title="State by State">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Winner</th>
                {campaign.candidates.map((candidate) => (
                  <th key={candidate.id}>{candidate.name.split(' ').slice(-1)[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map((state) => {
                const row = result.stateResults[state.id] ?? {};
                const leaderId = Object.entries(row).sort((a, b) => b[1] - a[1])[0]?.[0];
                const leader = campaign.candidates.find((c) => c.id === leaderId);
                return (
                  <tr key={state.id}>
                    <td>{state.name}</td>
                    <td>
                      <span
                        className="party-code"
                        style={{
                          background: leader
                            ? partyOf(campaign, leader.id)?.colors.main
                            : undefined,
                        }}
                      >
                        {leader ? partyOf(campaign, leader.id)?.code : '—'}
                      </span>{' '}
                      {leader?.name}
                    </td>
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

      <Section title={`The Hidden Ledger — ${player?.name}`}>
        {result.epilogue ? (
          <div className="epilogue">
            <div className="advancement">
              <span className="advancement-score">
                {Math.round(result.epilogue.advancementScore)}
              </span>
              <div>
                <p className="advancement-label">Hidden agenda advancement</p>
                <p className="muted">{result.epilogue.justification}</p>
              </div>
            </div>
            <p className="epilogue-text">{result.epilogue.text}</p>
          </div>
        ) : (
          !epilogueFailed && <Pending label="History is being written…" />
        )}
        <FailedJobs jobs={queue.filter((j) => j.type === 'election.epilogue')} />
      </Section>

      <div className="election-actions">
        <button className="btn" onClick={() => navigate({ name: 'saves', savesMode: 'save' })}>
          Save this campaign for posterity
        </button>
        <button className="btn primary" onClick={() => void closeCampaign()}>
          Return to the main menu
        </button>
      </div>
    </div>
  );
}
