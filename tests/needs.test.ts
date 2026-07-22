/**
 * Setup-sequencing suite: during setup the needs derivation must yield ONE
 * world-building job at a time, in the progressive build-up order (nation →
 * councilor options role by role → rivals → opinion → extras), and the
 * campaign must become startable on the essentials alone — local engines
 * depend on never being buried in queued work.
 */
import { describe, expect, it } from 'vitest';
import { isCoreSetupReady } from '@core/campaign/status';
import type { CompletionRequest, CompletionResult } from '@core/generation/engine';
import { deriveNeededJobs } from '@core/generation/needs';
import { COUNCILOR_POSITION_IDS } from '@core/model/schemas';
import { MockAdapter } from '../src/main/llm/mock';
import { TEST_INPUT, expectOk, makeHost } from './helpers';
import { createCampaign } from '@core/campaign/create';

/** MockAdapter wrapper that records the order of completed jobs. */
class RecordingAdapter extends MockAdapter {
  readonly calls: string[] = [];

  constructor() {
    super(0);
  }

  override async complete(request: CompletionRequest): Promise<CompletionResult> {
    this.calls.push(request.tag);
    return super.complete(request);
  }
}

describe('progressive setup derivation', () => {
  it('derives exactly one world-building job at a time during setup', () => {
    const campaign = createCampaign(TEST_INPUT);
    const jobs = deriveNeededJobs(campaign);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe('world.generate');
  });

  it('runs the setup chain strictly sequentially and in narrative order', async () => {
    const host = makeHost();
    const engine = new RecordingAdapter();
    host.setEngineForTesting(engine);
    expectOk(await host.handle('campaign.new', TEST_INPUT));
    await host.queueIdle();

    const calls = engine.calls;
    const settings = host.getCampaign()!.settings;
    // Nation first, then councilor options one position at a time, then
    // rivals one by one, then opinion for every candidate — then the extras.
    const essentials = [
      'world.generate',
      ...COUNCILOR_POSITION_IDS.map(() => 'councilor.pool'),
      ...Array.from({ length: settings.rivalCount }, () => 'rival.generate'),
      ...Array.from({ length: settings.rivalCount + 1 }, () => 'opinion.seed'),
    ];
    expect(calls.slice(0, essentials.length)).toEqual(essentials);
    // Extras follow the essentials, never interleave with them.
    const extras = calls.slice(essentials.length);
    expect(extras.length).toBeGreaterThan(0);
    expect(new Set(extras)).toEqual(
      new Set(['councilor.match', 'party.policies', 'influencers.generate']),
    );
  });

  it('becomes startable on the essentials, before the background extras', async () => {
    const host = makeHost();
    const engine = new RecordingAdapter();
    host.setEngineForTesting(engine);
    expectOk(await host.handle('campaign.new', TEST_INPUT));
    await host.queueIdle();

    const campaign = host.getCampaign()!;
    expect(isCoreSetupReady(campaign)).toBe(true);
    // Readiness must not depend on anything generated after the last seed.
    const lastSeed = engine.calls.lastIndexOf('opinion.seed');
    for (const extra of ['councilor.match', 'party.policies', 'influencers.generate']) {
      const first = engine.calls.indexOf(extra);
      expect(first, `${extra} must run after the essentials`).toBeGreaterThan(lastSeed);
    }
    // And the extras do complete eventually (nothing is silently dropped).
    expect(
      campaign.parties.find((p) => p.id === campaign.playerPartyId)!.policies,
    ).not.toHaveLength(0);
    expect(campaign.influencers.length).toBe(campaign.settings.influencerCount);
  });
});
