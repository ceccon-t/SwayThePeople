import { useState } from 'react';
// The packaged-app icon doubles as the in-game one, so it is imported straight
// from build/ (electron-builder needs it there) rather than duplicated here.
import gameIcon from '../../../build/icon.png';
import authorIcon from './assets/icon_author.svg';
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

function GitHubIcon(): JSX.Element {
  return (
    <svg className="about-link-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
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
        <img className="about-icon" src={gameIcon} alt="Sway The People! icon" />
        <p>
          A political simulation game about running for president of a fictional nation — where a
          large language model generates the world, the rivals, the debates and the consequences.
        </p>
        <p>
          <em>Sway The People!</em> is an open source game, created by Tiago Ceccon and released
          under the MIT license.
        </p>
        <div className="about-footer">
          <nav className="about-links">
            <a
              className="about-link"
              href="https://github.com/ceccon-t/SwayThePeople"
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              Project repository
            </a>
            <a className="about-link" href="https://ceccon.dev" target="_blank" rel="noreferrer">
              <img className="about-link-icon" src={authorIcon} alt="" />
              Author&apos;s webpage
            </a>
          </nav>
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
