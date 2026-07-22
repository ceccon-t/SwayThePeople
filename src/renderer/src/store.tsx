/**
 * Renderer store: a mirror of main-process state (campaign, queue, settings)
 * plus purely-local UI state (current screen, error toast). All mutations go
 * through IPC commands; events keep the mirror fresh.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PlayerCommand } from '@core/commands/commands';
import type { LlmSettings } from '@core/generation/engine';
import type { JobSnapshot } from '@core/generation/jobs';
import type { Campaign } from '@core/model/schemas';
import { invoke, on } from './api';

export type ScreenName =
  | 'menu'
  | 'settings'
  | 'wizard'
  | 'hub'
  | 'councilors'
  | 'chat'
  | 'debate'
  | 'surveys'
  | 'influencers'
  | 'world'
  | 'election'
  | 'saves';

export interface Screen {
  name: ScreenName;
  councilorId?: string;
  /** Whether the saves screen was opened to save or to load. */
  savesMode?: 'save' | 'load';
}

export interface Store {
  campaign: Campaign | null;
  queue: JobSnapshot[];
  settings: LlmSettings | null;
  screen: Screen;
  error: string | null;
  navigate: (screen: Screen) => void;
  command: (command: PlayerCommand) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
  showError: (message: string) => void;
}

/** Exported so tests can render screens against synthetic store values. */
export const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [queue, setQueue] = useState<JobSnapshot[]>([]);
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 6000);
  }, []);

  useEffect(() => {
    const offCampaign = on('state:campaign', setCampaign);
    const offQueue = on('state:queue', setQueue);
    void invoke('settings.get').then((reply) => reply.ok && setSettings(reply.data));
    void invoke('campaign.snapshot').then((reply) => reply.ok && setCampaign(reply.data));
    void invoke('queue.status').then((reply) => reply.ok && setQueue(reply.data));
    return () => {
      offCampaign();
      offQueue();
    };
  }, []);

  // When election night arrives, take the player to the results.
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    const phase = campaign?.phase ?? null;
    if (phase === 'finished' && prevPhase.current === 'running') {
      setScreen({ name: 'election' });
    }
    prevPhase.current = phase;
  }, [campaign?.phase]);

  const command = useCallback(
    async (cmd: PlayerCommand) => {
      const reply = await invoke('campaign.command', cmd);
      if (!reply.ok) showError(reply.error);
      return reply.ok;
    },
    [showError],
  );

  const refreshSettings = useCallback(async () => {
    const reply = await invoke('settings.get');
    if (reply.ok) setSettings(reply.data);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        campaign,
        queue,
        settings,
        screen,
        error,
        navigate: setScreen,
        command,
        refreshSettings,
        showError,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore outside StoreProvider');
  return store;
}
