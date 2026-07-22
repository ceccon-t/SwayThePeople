/**
 * Screen-render suite: every renderer screen must render (renderToString)
 * without crashing against real campaign states produced by the mock engine —
 * setup, mid-campaign, live debate, and finished/epilogue.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LLM_SETTINGS } from '@core/generation/engine';
import type { Campaign } from '@core/model/schemas';
import { COUNCILOR_POSITION_IDS } from '@core/model/schemas';
import { activeDebate } from '@core/sim/debates';
import { StoreContext, type Screen, type Store } from '../src/renderer/src/store';
import { Chat } from '../src/renderer/src/screens/Chat';
import { Councilors } from '../src/renderer/src/screens/Councilors';
import { Debate } from '../src/renderer/src/screens/Debate';
import { Election } from '../src/renderer/src/screens/Election';
import { Hub } from '../src/renderer/src/screens/Hub';
import { Influencers } from '../src/renderer/src/screens/Influencers';
import { MainMenu } from '../src/renderer/src/screens/MainMenu';
import { NewCampaign } from '../src/renderer/src/screens/NewCampaign';
import { Saves } from '../src/renderer/src/screens/Saves';
import { Settings } from '../src/renderer/src/screens/Settings';
import { Surveys } from '../src/renderer/src/screens/Surveys';
import { World } from '../src/renderer/src/screens/World';
import { driveUntil, makeHost, sendCommand, setupCampaign } from './helpers';

const ALL_SCREENS = {
  MainMenu,
  Settings,
  NewCampaign,
  Hub,
  Councilors,
  Chat,
  Debate,
  Surveys,
  Influencers,
  World,
  Election,
  Saves,
};

function renderScreen(
  component: () => JSX.Element,
  campaign: Campaign | null,
  screen: Screen = { name: 'hub' },
): string {
  const store: Store = {
    campaign,
    queue: [],
    settings: DEFAULT_LLM_SETTINGS,
    screen,
    error: null,
    navigate: () => {},
    command: async () => true,
    refreshSettings: async () => {},
    showError: () => {},
  };
  return renderToString(
    createElement(StoreContext.Provider, { value: store }, createElement(component)),
  );
}

describe('all screens render against real campaign states', () => {
  let setup: Campaign;
  let running: Campaign;
  let debating: Campaign;
  let finished: Campaign;

  beforeAll(async () => {
    const host = makeHost();
    setup = await setupCampaign(host);
    for (const positionId of COUNCILOR_POSITION_IDS) {
      const applicant = host.getCampaign()!.councilors.pool[positionId][0];
      await sendCommand(host, { type: 'hireCouncilor', positionId, councilorId: applicant.id });
    }
    await sendCommand(host, { type: 'startCampaign' });
    await sendCommand(host, {
      type: 'chatSend',
      councilorId: host.getCampaign()!.councilors.hired[COUNCILOR_POSITION_IDS[0]]!.id,
      text: 'Hello there.',
    });
    running = await driveUntil(host, (c) => c.phase === 'running' && c.day >= 2);
    debating = await driveUntil(host, (c) => activeDebate(c) !== undefined);
    finished = await driveUntil(host, (c) => c.phase === 'finished' && Boolean(c.result?.epilogue));
  }, 60_000);

  it('renders every screen with no campaign', () => {
    for (const [name, component] of Object.entries(ALL_SCREENS)) {
      expect(() => renderScreen(component, null), name).not.toThrow();
    }
  });

  it('renders every screen across campaign phases', () => {
    for (const campaign of [() => setup, () => running, () => debating, () => finished]) {
      for (const [name, component] of Object.entries(ALL_SCREENS)) {
        const chatId = Object.values(campaign().councilors.hired).find(Boolean)?.id;
        const html = renderScreen(component, campaign(), { name: 'chat', councilorId: chatId });
        expect(html.length, name).toBeGreaterThan(0);
      }
    }
  });

  it('shows the live debate stage with player actions or wait states', () => {
    const html = renderScreen(Debate, debating);
    expect(html).toContain('National Debate');
  });

  it('shows the epilogue on the election screen', () => {
    const html = renderScreen(Election, finished);
    expect(html).toContain('Hidden agenda advancement');
  });
});
