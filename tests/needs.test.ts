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
import { BOUNDS } from '@core/model/constants';
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

/** MockAdapter that pauses the worker just before the first call with a tag. */
class GatedAdapter extends MockAdapter {
  private gateTag: string | null = null;
  private notifyReached: (() => void) | null = null;
  private releaseGate: (() => void) | null = null;

  constructor() {
    super(0);
  }

  /** Resolves once a call with `tag` is about to run and is holding the worker. */
  gateBefore(tag: string): Promise<void> {
    this.gateTag = tag;
    return new Promise((resolve) => {
      this.notifyReached = resolve;
    });
  }

  release(): void {
    this.releaseGate?.();
    this.releaseGate = null;
  }

  override async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (request.tag === this.gateTag) {
      this.gateTag = null;
      const held = new Promise<void>((resolve) => {
        this.releaseGate = resolve;
      });
      this.notifyReached?.();
      await held;
    }
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

/**
 * Agenda fits must reach every councilor no matter when the player hires or
 * starts: hiring splices a councilor out of the pool, and the setup wizard
 * invites hiring long before the (deliberately non-blocking) fit jobs run.
 */
describe('agenda fits for councilors hired early', () => {
  const positionId = COUNCILOR_POSITION_IDS[0];

  function expectRated(councilor: { agendaMatch?: { publicScore: number; hiddenScore: number } }) {
    expect(councilor.agendaMatch).toBeDefined();
    expect(councilor.agendaMatch!.publicScore).toBeGreaterThanOrEqual(BOUNDS.councilorMatchFloor);
    expect(councilor.agendaMatch!.hiddenScore).toBeGreaterThanOrEqual(BOUNDS.councilorMatchFloor);
  }

  it('rates a councilor hired during setup, before fits were generated', async () => {
    const host = makeHost();
    const engine = new GatedAdapter();
    host.setEngineForTesting(engine);
    const reached = engine.gateBefore('rival.generate');
    expectOk(await host.handle('campaign.new', TEST_INPUT));
    await reached;

    // Every pool exists but no agenda fit has been generated yet.
    const applicant = host.getCampaign()!.councilors.pool[positionId]![0];
    expect(applicant.agendaMatch).toBeUndefined();
    expectOk(
      await host.handle('campaign.command', {
        type: 'hireCouncilor',
        positionId,
        councilorId: applicant.id,
      }),
    );

    engine.release();
    await host.queueIdle();

    const campaign = host.getCampaign()!;
    const hired = campaign.councilors.hired[positionId]!;
    expect(hired.id).toBe(applicant.id);
    expectRated(hired);
    for (const remaining of campaign.councilors.pool[positionId]!) expectRated(remaining);
  });

  it('rates hired and pool councilors when the campaign starts early', async () => {
    const host = makeHost();
    const engine = new GatedAdapter();
    host.setEngineForTesting(engine);
    const reached = engine.gateBefore('councilor.match');
    expectOk(await host.handle('campaign.new', TEST_INPUT));
    await reached;

    // Essentials are done, extras are not: hire and start immediately.
    const applicant = host.getCampaign()!.councilors.pool[positionId]![0];
    expect(applicant.agendaMatch).toBeUndefined();
    expectOk(
      await host.handle('campaign.command', {
        type: 'hireCouncilor',
        positionId,
        councilorId: applicant.id,
      }),
    );
    expectOk(await host.handle('campaign.command', { type: 'startCampaign' }));
    expect(host.getCampaign()!.phase).toBe('running');

    engine.release();
    await host.queueIdle();

    const campaign = host.getCampaign()!;
    expectRated(campaign.councilors.hired[positionId]!);
    for (const positionPool of Object.values(campaign.councilors.pool)) {
      for (const councilor of positionPool) expectRated(councilor);
    }
  });
});
