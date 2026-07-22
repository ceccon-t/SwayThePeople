import { describe, expect, it } from 'vitest';
import type {
  CompletionRequest,
  CompletionResult,
  LlmEngine,
  ModelInfo,
} from '@core/generation/engine';
import { GameHost } from '../src/main/gameHost';
import { TEST_INPUT, expectOk, tempDataDir } from './helpers';

/** Engine whose responses are scripted per call. */
class ScriptedEngine implements LlmEngine {
  readonly providerId = 'mock' as const;
  readonly requests: CompletionRequest[] = [];
  constructor(private script: Array<string | Error>) {}

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'scripted' };
  }
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(request);
    const next = this.script.shift();
    if (next === undefined) throw new Error('script exhausted');
    if (next instanceof Error) throw next;
    return { text: next };
  }
}

const VALID_WORLD = JSON.stringify({
  nationName: 'Scriptland',
  nationDescription: 'A nation from a script.',
  states: [1, 2, 3, 4, 5].map((i) => ({
    name: `State ${i}`,
    description: `The ${i}th state.`,
    cities: [`City ${i}`],
    populationWeight: 20,
    topicWeights: {
      economy: 20,
      security: 15,
      health: 15,
      education: 20,
      culture: 15,
      environment: 15,
    },
  })),
});

describe('GenerationQueue via GameHost', () => {
  it('repairs invalid JSON with a follow-up prompt', async () => {
    const engine = new ScriptedEngine(['this is not json at all', VALID_WORLD]);
    const host = new GameHost(tempDataDir(), () => {});
    host.setEngineForTesting(engine);
    await host.handle('campaign.new', TEST_INPUT);

    // Wait until the world lands (other jobs will fail on script exhaustion).
    for (let i = 0; i < 200 && !host.getCampaign()?.nation; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(host.getCampaign()?.nation?.name).toBe('Scriptland');
    // Second request must carry the repair conversation (assistant + user turns).
    expect(engine.requests[1].messages.length).toBe(engine.requests[0].messages.length + 2);
    expect(engine.requests[1].messages.at(-1)?.content).toMatch(/invalid/);
  });

  it('marks a job failed after exhausting attempts, and retry works', async () => {
    const engine = new ScriptedEngine(['bad', 'worse', 'still bad', VALID_WORLD]);
    const host = new GameHost(tempDataDir(), () => {});
    host.setEngineForTesting(engine);
    await host.handle('campaign.new', TEST_INPUT);

    // 3 failed attempts → job failed.
    for (let i = 0; i < 200; i++) {
      const status = await host.handle('queue.status', {});
      if (
        status.ok &&
        (status.data as Array<{ status: string }>).some((j) => j.status === 'failed')
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const status = expectOk(await host.handle('queue.status', {})) as Array<{
      key: string;
      status: string;
      attempts: number;
    }>;
    const failed = status.find((j) => j.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed?.attempts).toBe(3);

    await host.handle('generation.retry', { key: failed?.key });
    for (let i = 0; i < 200 && !host.getCampaign()?.nation; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(host.getCampaign()?.nation?.name).toBe('Scriptland');
  });

  it('orders interactive jobs before background ones', async () => {
    const engine = new ScriptedEngine([]);
    const host = new GameHost(tempDataDir(), () => {});
    host.setEngineForTesting(engine);
    await host.handle('campaign.new', TEST_INPUT);
    const jobs = expectOk(await host.handle('queue.status', {})) as Array<{ type: string }>;
    // During setup only the world job is derivable — everything else waits on it.
    expect(jobs[0]?.type).toBe('world.generate');
  });
});
