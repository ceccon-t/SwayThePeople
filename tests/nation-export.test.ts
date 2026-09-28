/**
 * Nation export/import suite: a played campaign's world must come back out as
 * a valid package that carries nothing of the player (axiom 15), replay
 * faithfully through instantiation, reach the disk through the injected
 * dialog, and come back in from a file — with unusable files rejected in words.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCampaign } from '@core/campaign/create';
import { deriveNeededJobs } from '@core/generation/needs';
import type { Campaign } from '@core/model/schemas';
import { exportNationPackage, nationExportFileName } from '@core/nation/export';
import { nationPackageSchema } from '@core/nation/package';
import { isCoreSetupReady } from '@core/campaign/status';
import type { NationExportInfo, NationImportInfo } from '@core/protocol';
import { isCandidateSeeded } from '@core/sim/opinion';
import { DEFAULT_NATION_PACKAGES } from '../src/main/nations/defaults';
import { TEST_INPUT, expectOk, makeHost, setupCampaign, tempDataDir } from './helpers';

describe('exportNationPackage', () => {
  it('turns a generated campaign into a valid, player-free package', async () => {
    const host = makeHost();
    const campaign = await setupCampaign(host);
    const pkg = exportNationPackage(campaign);
    expect(() => nationPackageSchema.parse(pkg)).not.toThrow();

    expect(pkg.name).toBe(campaign.nation!.name);
    expect(pkg.id).toContain(campaign.id.slice(-6));
    expect(pkg.states.map((s) => s.id)).toEqual(campaign.nation!.states.map((s) => s.id));
    for (const state of pkg.states) {
      expect(state.populationWeight).toBeGreaterThan(0);
    }

    // Every rival and no trace of the player.
    const rivalIds = campaign.candidates
      .filter((c) => c.id !== campaign.playerCandidateId)
      .map((c) => c.id);
    expect(pkg.candidates!.map((c) => c.id).sort()).toEqual([...rivalIds].sort());
    expect(pkg.parties!.some((p) => p.id === campaign.playerPartyId)).toBe(false);
    expect(pkg.initialOpinion![campaign.playerCandidateId]).toBeUndefined();
    for (const rivalId of rivalIds) expect(pkg.initialOpinion![rivalId]).toBeDefined();
    expect(pkg.influencers!.length).toBe(campaign.influencers.length);
    for (const influencer of pkg.influencers!) {
      expect(influencer.partyAffinity[campaign.playerPartyId]).toBeUndefined();
      expect(Object.keys(influencer.partyAffinity).length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('replays into a new campaign needing only the player opinion seed', async () => {
    const host = makeHost();
    const original = await setupCampaign(host);
    const pkg = exportNationPackage(original);

    const replay = createCampaign(
      { ...TEST_INPUT, nation: { mode: 'package', packageId: pkg.id } },
      pkg,
    );
    expect(replay.nation!.states.map((s) => s.name)).toEqual(
      original.nation!.states.map((s) => s.name),
    );
    for (const state of replay.nation!.states) {
      const source = original.nation!.states.find((s) => s.id === state.id)!;
      expect(state.populationWeight).toBeCloseTo(source.populationWeight, 3);
    }
    const rivals = replay.candidates.filter((c) => c.id !== replay.playerCandidateId);
    expect(rivals.length).toBe(original.settings.rivalCount);
    for (const rival of rivals) expect(isCandidateSeeded(replay, rival.id)).toBe(true);
    expect(replay.settings.influencerCount).toBe(original.influencers.length);
    const jobs = deriveNeededJobs(replay);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe('opinion.seed');
  }, 30_000);

  it('gives a package-born campaign back its bundled identity and cast', async () => {
    const source = DEFAULT_NATION_PACKAGES[0];
    const host = makeHost();
    expectOk(
      await host.handle('campaign.new', {
        ...TEST_INPUT,
        nation: { mode: 'package', packageId: source.id },
      }),
    );
    await host.queueIdle();
    const pkg = exportNationPackage(host.getCampaign()!);
    expect(pkg.id).toBe(source.id);
    expect(pkg.candidates!.map((c) => c.id).sort()).toEqual(
      source.candidates!.map((c) => c.id).sort(),
    );
    expect(pkg.influencers!.map((i) => i.name)).toEqual(source.influencers!.map((i) => i.name));
    expect(pkg.initialOpinion!).toEqual(source.initialOpinion!);
  }, 30_000);

  it('exports only the nation while the cast is still being generated', () => {
    const campaign: Campaign = createCampaign(TEST_INPUT);
    expect(() => exportNationPackage(campaign)).toThrow(/not been generated/);
    campaign.nation = {
      name: 'Halfway Republic',
      description: 'Still assembling.',
      states: [1, 2, 3].map((i) => ({
        id: `st-${i}`,
        name: `State ${i}`,
        description: '',
        cities: [],
        populationWeight: 1 / 3,
        topicWeights: {
          economy: 1 / 6,
          security: 1 / 6,
          health: 1 / 6,
          education: 1 / 6,
          culture: 1 / 6,
          environment: 1 / 6,
        },
      })),
    };
    const pkg = exportNationPackage(campaign);
    expect(pkg.parties).toBeUndefined();
    expect(pkg.candidates).toBeUndefined();
    expect(pkg.influencers).toBeUndefined();
    expect(nationExportFileName(campaign)).toBe('halfway-republic.json');
  });
});

describe('nation.export over the host', () => {
  it('writes the chosen file and reports it', async () => {
    const dir = tempDataDir();
    let suggested = '';
    const host = makeHost({
      pickSavePath: async ({ defaultFileName }) => {
        suggested = defaultFileName;
        return join(dir, 'my-nation');
      },
    });
    const campaign = await setupCampaign(host);
    const result = expectOk(await host.handle('nation.export')) as NationExportInfo | null;
    expect(suggested).toBe(nationExportFileName(campaign));
    expect(result?.filePath).toBe(join(dir, 'my-nation.json'));
    expect(result?.packageName).toBe(campaign.nation!.name);
    const onDisk = JSON.parse(readFileSync(result!.filePath, 'utf-8'));
    expect(nationPackageSchema.parse(onDisk)).toEqual(exportNationPackage(campaign));
  }, 30_000);

  it('returns null and writes nothing when the dialog is cancelled', async () => {
    const dir = tempDataDir();
    const host = makeHost({ pickSavePath: async () => null });
    await setupCampaign(host);
    expect(expectOk(await host.handle('nation.export'))).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
  }, 30_000);

  it('refuses without a campaign', async () => {
    const reply = await makeHost().handle('nation.export');
    expect(reply.ok).toBe(false);
  });
});

describe('nation.import over the host', () => {
  /** Export the mock world from one host to disk, for another host to import. */
  async function exportedFile(): Promise<{ filePath: string; source: Campaign }> {
    const dir = tempDataDir();
    const host = makeHost({ pickSavePath: async () => join(dir, 'exported.json') });
    const source = await setupCampaign(host);
    const result = expectOk(await host.handle('nation.export')) as NationExportInfo;
    return { filePath: result.filePath, source };
  }

  it('reads an exported file and replays it in a new campaign, offline', async () => {
    const { filePath, source } = await exportedFile();
    const host = makeHost({ pickOpenPath: async () => filePath });
    const info = expectOk(await host.handle('nation.import')) as NationImportInfo;
    expect(info.filePath).toBe(filePath);
    expect(info.nation.name).toBe(source.nation!.name);
    expect(info.nation.partyNames.length).toBe(source.settings.rivalCount);

    expectOk(
      await host.handle('campaign.new', {
        ...TEST_INPUT,
        nation: { mode: 'imported', packageId: info.nation.id },
      }),
    );
    await host.queueIdle();
    const replay = host.getCampaign()!;
    expect(replay.nation!.name).toBe(source.nation!.name);
    expect(replay.nationRef).toEqual({
      kind: 'package',
      packageId: info.nation.id,
      packageFormatVersion: 1,
    });
    expect(
      replay.candidates.filter((c) => c.id !== replay.playerCandidateId).map((c) => c.id),
    ).toEqual(source.candidates.filter((c) => c.id !== source.playerCandidateId).map((c) => c.id));
    expect(isCoreSetupReady(replay)).toBe(true);
    // The imported package stays available for another campaign this session.
    expectOk(await host.handle('campaign.close'));
    expectOk(
      await host.handle('campaign.new', {
        ...TEST_INPUT,
        nation: { mode: 'imported', packageId: info.nation.id },
      }),
    );
  }, 30_000);

  it('returns null when the dialog is cancelled', async () => {
    const host = makeHost({ pickOpenPath: async () => null });
    expect(expectOk(await host.handle('nation.import'))).toBeNull();
  });

  it('rejects files that are not nation packages, in plain words', async () => {
    const dir = tempDataDir();
    const notJson = join(dir, 'notes.json');
    writeFileSync(notJson, 'this is not json');
    const wrongShape = join(dir, 'save.json');
    writeFileSync(wrongShape, JSON.stringify({ formatVersion: 1, name: 'x', states: [] }));

    const garbled = await makeHost({ pickOpenPath: async () => notJson }).handle('nation.import');
    expect(garbled.ok).toBe(false);
    if (!garbled.ok) expect(garbled.error).toMatch(/Could not read a nation package/);

    const invalid = await makeHost({ pickOpenPath: async () => wrongShape }).handle(
      'nation.import',
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toMatch(/not a valid nation package/);
  });

  it('refuses a campaign on an imported id it never saw', async () => {
    const reply = await makeHost().handle('campaign.new', {
      ...TEST_INPUT,
      nation: { mode: 'imported', packageId: 'never-imported' },
    });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.error).toMatch(/no longer available/);
  });
});
