import { useState } from 'react';
import { computeShares } from '@core/sim/opinion';
import { activeDebate } from '@core/sim/debates';
import { getPlayerParty } from '@core/model/queries';
import { Spinner, formatPct } from './components/common';
import { Chat } from './screens/Chat';
import { Councilors } from './screens/Councilors';
import { Debate } from './screens/Debate';
import { Election } from './screens/Election';
import { Hub } from './screens/Hub';
import { Influencers } from './screens/Influencers';
import { MainMenu } from './screens/MainMenu';
import { NewCampaign } from './screens/NewCampaign';
import { Saves } from './screens/Saves';
import { Settings } from './screens/Settings';
import { Surveys } from './screens/Surveys';
import { World } from './screens/World';
import { useStore, type Screen, type ScreenName } from './store';

const SCREENS: Record<ScreenName, () => JSX.Element> = {
  menu: MainMenu,
  settings: Settings,
  wizard: NewCampaign,
  hub: Hub,
  councilors: Councilors,
  chat: Chat,
  debate: Debate,
  surveys: Surveys,
  influencers: Influencers,
  world: World,
  election: Election,
  saves: Saves,
};

function QueueIndicator(): JSX.Element | null {
  const { queue } = useStore();
  const active =
    queue.find((j) => j.status === 'running') ?? queue.find((j) => j.status === 'pending');
  const failed = queue.filter((j) => j.status === 'failed').length;
  if (!active && failed === 0) return null;
  return (
    <div
      className="queue-indicator"
      title={queue.map((j) => `${j.label} [${j.status}]`).join('\n')}
    >
      {active && (
        <>
          <Spinner />
          <span className="queue-label">{active.label}</span>
          {queue.length > 1 && <span className="queue-count">+{queue.length - 1}</span>}
        </>
      )}
      {failed > 0 && <span className="queue-failed">⚠ {failed}</span>}
    </div>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <h2>Sway The People!</h2>
          <span className="muted">v{__APP_VERSION__}</span>
        </div>
        <p>
          A political simulation game about running for president of a fictional nation — where a
          large language model generates the world, the rivals, the debates and the consequences.
        </p>
        <p>
          Sway The People! is an open source game, created by Tiago Ceccon and released under the
          MIT license.
        </p>
        <ul className="about-links">
          <li>
            <a href="https://github.com/ceccon-t/SwayThePeople" target="_blank" rel="noreferrer">
              Project repository
            </a>
          </li>
          <li>
            <a href="https://ceccon.dev" target="_blank" rel="noreferrer">
              Author&apos;s webpage
            </a>
          </li>
          <li>
            <a href="https://github.com/ceccon-t" target="_blank" rel="noreferrer">
              Author on GitHub
            </a>
          </li>
        </ul>
        <div className="about-footer">
          <button className="nav-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function TopBar(): JSX.Element {
  const { campaign, screen, navigate } = useStore();
  const [aboutOpen, setAboutOpen] = useState(false);
  const inCampaign = campaign !== null && campaign.phase !== 'setup';
  const player = campaign?.candidates.find((c) => c.id === campaign.playerCandidateId);
  const party = campaign ? getPlayerParty(campaign) : null;
  const shares =
    campaign && campaign.phase === 'running' ? computeShares(campaign, null, 0).national : null;
  const debating = campaign ? activeDebate(campaign) : undefined;

  const navButton = (target: Screen, label: string): JSX.Element => (
    <button
      className={`nav-btn ${screen.name === target.name ? 'active' : ''}`}
      onClick={() => navigate(target)}
    >
      {label}
    </button>
  );

  const aboutButton = (
    <button className={`nav-btn ${aboutOpen ? 'active' : ''}`} onClick={() => setAboutOpen(true)}>
      About
    </button>
  );

  return (
    <header className="topbar">
      <div className="topbar-brand" onClick={() => navigate({ name: inCampaign ? 'hub' : 'menu' })}>
        <span className="brand-title">Sway The People!</span>
      </div>
      {inCampaign && campaign && (
        <>
          <div className="topbar-campaign">
            <span className="party-code" style={{ background: party?.colors.main }}>
              {party?.code}
            </span>
            <span className="topbar-candidate">{player?.name}</span>
            {campaign.phase === 'running' && (
              <span className="topbar-day">
                Day {campaign.day}/{campaign.settings.totalDays}
              </span>
            )}
            {shares && player && (
              <span className="topbar-share">{formatPct(shares[player.id] ?? 0)}</span>
            )}
          </div>
          <nav className="topbar-nav">
            {navButton({ name: 'hub' }, 'The Trail')}
            {debating && navButton({ name: 'debate' }, '🎙 Debate')}
            {navButton({ name: 'councilors' }, 'Team')}
            {navButton({ name: 'world' }, 'The World')}
            {navButton({ name: 'surveys' }, 'Surveys')}
            {navButton({ name: 'influencers' }, 'Influence')}
            {campaign.phase === 'finished' && navButton({ name: 'election' }, 'Results')}
            {navButton({ name: 'saves', savesMode: 'save' }, 'Save')}
            {navButton({ name: 'menu' }, 'Menu')}
            {aboutButton}
          </nav>
        </>
      )}
      {!inCampaign && (
        <nav className="topbar-nav">
          {navButton({ name: 'menu' }, 'Menu')}
          {navButton({ name: 'settings' }, 'AI Engine')}
          {aboutButton}
        </nav>
      )}
      <QueueIndicator />
      <span className="app-version" title="Game version">
        v{__APP_VERSION__}
      </span>
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </header>
  );
}

export function App(): JSX.Element {
  const { campaign, screen, error } = useStore();
  const party = campaign?.parties.find((p) => p.id === campaign.playerPartyId);
  const CurrentScreen = SCREENS[screen.name];
  return (
    <div
      className="app"
      style={
        party
          ? ({
              '--party': party.colors.main,
              '--party-2': party.colors.secondary,
            } as React.CSSProperties)
          : undefined
      }
    >
      <TopBar />
      <main className="screen">
        <CurrentScreen />
      </main>
      {error && <div className="toast">{error}</div>}
    </div>
  );
}
