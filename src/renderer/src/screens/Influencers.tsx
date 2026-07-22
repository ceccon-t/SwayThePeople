import { Pending, Section, partyOf } from '../components/common';
import { useStore } from '../store';

export function Influencers(): JSX.Element {
  const { campaign } = useStore();
  if (!campaign) return <Pending label="No campaign." />;
  const playerPartyId = campaign.playerPartyId;
  const contentFeed = campaign.influencers
    .flatMap((influencer) => influencer.contentLog.map((content) => ({ influencer, content })))
    .sort((a, b) => b.content.day - a.content.day);

  return (
    <div className="influencers-screen">
      <Section title="The Influencer Scene">
        {campaign.influencers.length === 0 && <Pending label="Scouting influencers…" />}
        <div className="influencer-grid">
          {campaign.influencers.map((influencer) => {
            const endorsedCandidate = influencer.endorsement
              ? campaign.candidates.find((c) => c.id === influencer.endorsement?.candidateId)
              : null;
            const endorsedParty = endorsedCandidate
              ? partyOf(campaign, endorsedCandidate.id)
              : null;
            const affinity = influencer.partyAffinity[playerPartyId] ?? 50;
            return (
              <article key={influencer.id} className="person-card">
                <header>
                  <strong>{influencer.name}</strong>
                  <span className="muted">
                    {influencer.domain} · reach {influencer.reach}
                  </span>
                </header>
                <p className="muted">{influencer.bio}</p>
                <p className="muted">Audience: {influencer.audience}</p>
                {endorsedCandidate ? (
                  <>
                    <p className="endorsement" style={{ color: endorsedParty?.colors.main }}>
                      ★ Endorses {endorsedCandidate.name}
                    </p>
                    {endorsedCandidate.id === campaign.playerCandidateId && (
                      <p className="muted">
                        Commitment: {Math.round(affinity)}/100
                        {Math.round(affinity) < 100 && (
                          <>
                            <br />
                            <em>(keep courting them to deepen their commitment)</em>
                          </>
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Uncommitted — warmth toward your party: {Math.round(affinity)}/100
                    <br />
                    <em>(assign a councilor to court them from The Trail)</em>
                  </p>
                )}
              </article>
            );
          })}
        </div>
        {campaign.influencers.length > 0 &&
          campaign.influencers.length < campaign.settings.influencerCount && (
            <Pending label="More influencers being scouted…" />
          )}
      </Section>

      <Section title="Content Feed">
        {contentFeed.length === 0 && (
          <p className="muted">
            No influencer content yet. Win endorsements and their posts will appear here.
          </p>
        )}
        <ul className="content-feed">
          {contentFeed.map(({ influencer, content }) => (
            <li key={content.id} className="content-item">
              <header>
                <strong>{influencer.name}</strong>
                <span className="muted">
                  {content.medium} · day {content.day}
                </span>
              </header>
              <p>{content.text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
