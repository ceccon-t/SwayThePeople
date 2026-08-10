/**
 * Nation-package suite: packages are untrusted input (bundled today, shared
 * files later), so the schema must reject inconsistent data and instantiation
 * must normalize and clamp everything. A package-born campaign must reach
 * startability after a single generation job (the player's opinion seed) and
 * remain fully playable offline through the MockAdapter.
 */
import { describe, expect, it } from 'vitest';
import { createCampaign } from '@core/campaign/create';
import { isCoreSetupReady } from '@core/campaign/status';
import { deriveNeededJobs } from '@core/generation/needs';
import { TOPIC_AREA_IDS } from '@core/model/schemas';
import type { NationPackage } from '@core/nation/package';
import { NATION_PACKAGE_FORMAT_VERSION, nationPackageSchema } from '@core/nation/package';
import { isCandidateSeeded } from '@core/sim/opinion';
import { DEFAULT_NATION_PACKAGES } from '../src/main/nations/defaults';
import { TEST_INPUT, driveUntil, expectOk, makeHost, sendCommand } from './helpers';

const evenTopicWeights = Object.fromEntries(TOPIC_AREA_IDS.map((t) => [t, 10]));

/** A minimal but full-featured package for unit-level tests. */
function makeTestPackage(): unknown {
  return {
    formatVersion: NATION_PACKAGE_FORMAT_VERSION,
    id: 'test-nation',
    name: 'Testonia',
    description: 'A nation assembled by a test.',
    states: [1, 2, 3].map((i) => ({
      id: `st-${i}`,
      name: `State ${i}`,
      description: `The ${i}th state.`,
      cities: [`City ${i}A`, `City ${i}B`, `City ${i}C`, `City ${i}D`],
      populationWeight: 10 * i,
      topicWeights: evenTopicWeights,
    })),
    parties: [
      {
        id: 'pt-1',
        // Deliberately collides with the player's code in TEST_INPUT.
        code: '27',
        name: 'Old Guard',
        colors: { main: '#111111', secondary: '#eeeeee' },
        publicAgenda: 'Keep everything exactly as it is.',
        hiddenAgenda: 'Keep everything exactly as it is, but for money.',
      },
    ],
    candidates: [
      {
        id: 'cd-1',
        partyId: 'pt-1',
        name: 'Incumbent Ivo',
        age: 150, // clamped at instantiation
        gender: 'male',
        bio: 'Has been running for office since before the office existed.',
      },
    ],
    initialOpinion: {
      'cd-1': {
        topicScores: Object.fromEntries(TOPIC_AREA_IDS.map((t) => [t, 250])), // clamped
        stateAffinities: { 'st-1': 80, 'st-2': -40 }, // clamped
      },
    },
    influencers: [
      {
        id: 'in-1',
        name: 'Testfluencer',
        age: 30,
        gender: 'female',
        bio: 'Famous for tests.',
        domain: 'testing',
        audience: 'testers',
        reach: 900, // clamped
        partyAffinity: { 'pt-1': 70 },
      },
    ],
  };
}

describe('nationPackageSchema', () => {
  it('accepts a well-formed package (and all bundled defaults)', () => {
    expect(() => nationPackageSchema.parse(makeTestPackage())).not.toThrow();
    expect(DEFAULT_NATION_PACKAGES.length).toBe(3);
  });

  function mutated(change: (pkg: Record<string, unknown>) => void): unknown {
    const pkg = makeTestPackage() as Record<string, unknown>;
    change(pkg);
    return pkg;
  }

  it('rejects duplicate ids', () => {
    const pkg = mutated((p) => {
      const states = p.states as { id: string }[];
      states[1].id = states[0].id;
    });
    expect(() => nationPackageSchema.parse(pkg)).toThrow(/Duplicate state id/);
  });

  it('rejects a candidate pointing at an unknown party', () => {
    const pkg = mutated((p) => {
      (p.candidates as { partyId: string }[])[0].partyId = 'pt-none';
    });
    expect(() => nationPackageSchema.parse(pkg)).toThrow(/Unknown partyId/);
  });

  it('rejects parties without their candidates', () => {
    const pkg = mutated((p) => {
      delete p.candidates;
    });
    expect(() => nationPackageSchema.parse(pkg)).toThrow(/provided together/);
  });

  it('rejects baseline opinion for unknown candidates or states', () => {
    const unknownCandidate = mutated((p) => {
      (p.initialOpinion as Record<string, unknown>)['cd-ghost'] = (
        p.initialOpinion as Record<string, unknown>
      )['cd-1'];
    });
    expect(() => nationPackageSchema.parse(unknownCandidate)).toThrow(/unknown candidate/);
    const unknownState = mutated((p) => {
      const entry = (
        p.initialOpinion as Record<string, { stateAffinities: Record<string, number> }>
      )['cd-1'];
      entry.stateAffinities['st-ghost'] = 50;
    });
    expect(() => nationPackageSchema.parse(unknownState)).toThrow(/unknown state/);
  });

  it('rejects an influencer rating an unknown party', () => {
    const pkg = mutated((p) => {
      (p.influencers as { partyAffinity: Record<string, number> }[])[0].partyAffinity['pt-ghost'] =
        10;
    });
    expect(() => nationPackageSchema.parse(pkg)).toThrow(/unknown party/);
  });
});

describe('package instantiation', () => {
  function instantiated(): ReturnType<typeof createCampaign> {
    const pkg: NationPackage = nationPackageSchema.parse(makeTestPackage());
    return createCampaign({ ...TEST_INPUT, nation: { mode: 'package', packageId: pkg.id } }, pkg);
  }

  it('normalizes weights, trims cities, and derives the settings counts', () => {
    const campaign = instantiated();
    expect(campaign.nation?.name).toBe('Testonia');
    const states = campaign.nation!.states;
    expect(states.reduce((sum, s) => sum + s.populationWeight, 0)).toBeCloseTo(1, 6);
    for (const state of states) {
      expect(state.cities.length).toBeLessThanOrEqual(3);
      const topicTotal = TOPIC_AREA_IDS.reduce((sum, t) => sum + state.topicWeights[t], 0);
      expect(topicTotal).toBeCloseTo(1, 6);
    }
    expect(campaign.settings.stateCount).toBe(3);
    expect(campaign.settings.rivalCount).toBe(1);
    expect(campaign.settings.influencerCount).toBe(1);
    expect(campaign.nationRef).toEqual({
      kind: 'package',
      packageId: 'test-nation',
      packageFormatVersion: NATION_PACKAGE_FORMAT_VERSION,
    });
  });

  it('keeps the player party code on collisions and clamps package values', () => {
    const campaign = instantiated();
    const player = campaign.parties.find((p) => p.id === campaign.playerPartyId)!;
    const rival = campaign.parties.find((p) => p.id === 'pt-1')!;
    expect(player.code).toBe('27');
    expect(rival.code).not.toBe('27');
    expect(rival.code).toMatch(/^\d{2}$/);
    expect(campaign.candidates.find((c) => c.id === 'cd-1')!.age).toBe(99);
    expect(campaign.influencers[0].reach).toBe(100);
    expect(campaign.influencers[0].partyAffinity[campaign.playerPartyId]).toBeUndefined();
  });

  it('seeds packaged baseline opinion and remembers it as initialOpinion', () => {
    const campaign = instantiated();
    expect(isCandidateSeeded(campaign, 'cd-1')).toBe(true);
    expect(isCandidateSeeded(campaign, campaign.playerCandidateId)).toBe(false);
    const stamped = campaign.initialOpinion?.['cd-1'];
    expect(stamped).toBeDefined();
    expect(stamped!.topicScores.economy).toBe(100); // clamped from 250
    expect(stamped!.stateAffinities['st-2']).toBe(0); // clamped from -40
  });

  it('derives only the player opinion seed as the next setup job', () => {
    const campaign = instantiated();
    const jobs = deriveNeededJobs(campaign);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe('opinion.seed');
    expect(jobs[0].payload).toEqual({ candidateId: campaign.playerCandidateId });
  });
});

describe('a campaign in a bundled nation, offline', () => {
  it('sets up, rates influencers, starts, and plays through the mock engine', async () => {
    const host = makeHost();
    expectOk(
      await host.handle('campaign.new', {
        ...TEST_INPUT,
        nation: { mode: 'package', packageId: DEFAULT_NATION_PACKAGES[0].id },
      }),
    );
    await host.queueIdle();

    const campaign = host.getCampaign()!;
    expect(campaign.nation?.name).toBe(DEFAULT_NATION_PACKAGES[0].name);
    expect(isCoreSetupReady(campaign)).toBe(true);
    // Package identities survive untouched; only the player was polled anew.
    expect(campaign.candidates.map((c) => c.id)).toContain('alpha-cand-1');
    expect(campaign.influencers.length).toBe(DEFAULT_NATION_PACKAGES[0].influencers!.length);
    // The affinity job rated every package influencer against the player.
    for (const influencer of campaign.influencers) {
      expect(influencer.partyAffinity[campaign.playerPartyId]).toBeDefined();
    }

    await sendCommand(host, { type: 'startCampaign' });
    const running = await driveUntil(host, (c) => c.phase === 'running' && c.day >= 2);
    expect(running.surveys.length).toBeGreaterThan(0);
  }, 30_000);

  it('rejects an unknown package id', async () => {
    const host = makeHost();
    const reply = await host.handle('campaign.new', {
      ...TEST_INPUT,
      nation: { mode: 'package', packageId: 'no-such-nation' },
    });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.error).toMatch(/Unknown nation/);
  });
});
