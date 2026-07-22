import { isEngineConfiguredView } from './Settings';
import { useStore } from '../store';

export function MainMenu(): JSX.Element {
  const { campaign, settings, navigate } = useStore();
  const engineReady = settings ? isEngineConfiguredView(settings) : false;

  return (
    <div className="menu-screen">
      <div className="menu-hero">
        <h1 className="menu-title">
          Sway <em>The</em> People!
        </h1>
        <p className="menu-tagline">
          Found a party. Hide an agenda. Win a nation that never existed.
        </p>
      </div>
      <div className="menu-actions">
        {campaign && (
          <button
            className="btn primary big"
            onClick={() => navigate({ name: campaign.phase === 'setup' ? 'wizard' : 'hub' })}
          >
            Continue Campaign
          </button>
        )}
        <button
          className="btn primary big"
          disabled={!engineReady}
          onClick={() => navigate({ name: 'wizard' })}
        >
          New Campaign
        </button>
        <button className="btn big" onClick={() => navigate({ name: 'saves', savesMode: 'load' })}>
          Load Campaign
        </button>
        <button className="btn big" onClick={() => navigate({ name: 'settings' })}>
          AI Engine Settings
        </button>
        {!engineReady && (
          <p className="menu-hint">
            Configure an AI engine first — the campaign world is generated live. (The offline Mock
            engine works without any setup.)
          </p>
        )}
      </div>
    </div>
  );
}
