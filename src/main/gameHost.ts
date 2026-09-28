/**
 * GameHost: owns the authoritative campaign state and orchestrates the engine,
 * queue and persistence. Deliberately Electron-free (broadcast and native file
 * dialogs are injected) so the full game can be driven headlessly in tests.
 */
import { createCampaign } from '@core/campaign/create';
import type { NewCampaignInput } from '@core/campaign/create';
import { describeNationPackage } from '@core/nation/package';
import type { NationPackage } from '@core/nation/package';
import { exportNationPackage, nationExportFileName } from '@core/nation/export';
import { applyCommand } from '@core/commands/reducer';
import { CommandError } from '@core/commands/commands';
import type { PlayerCommand } from '@core/commands/commands';
import type { LlmEngine, LlmSettings } from '@core/generation/engine';
import type { JobRequest } from '@core/generation/jobs';
import { deriveNeededJobs, jobLabel } from '@core/generation/needs';
import type { Campaign } from '@core/model/schemas';
import { INVOKE_SCHEMAS } from '@core/protocol';
import type { EventPayloads, InvokeChannel, InvokeResults, Reply } from '@core/protocol';
import { llmSettingsSchema } from '@core/generation/engine';
import { createEngine, isEngineConfigured } from './llm/factory';
import { DEFAULT_NATION_PACKAGES, findDefaultNation } from './nations/defaults';
import { readNationPackageFile, writeNationPackageFile } from './nations/files';
import { PersistenceService } from './persistence';
import { GenerationQueue } from './queue';

export type Broadcast = <C extends keyof EventPayloads>(
  channel: C,
  payload: EventPayloads[C],
) => void;

/** Native file dialogs; the Electron entry point supplies them, tests stub them. */
export interface FileDialogs {
  /** Resolves to the chosen path, or null when the player cancels. */
  pickSavePath(options: { title: string; defaultFileName: string }): Promise<string | null>;
  /** Resolves to the chosen existing file, or null when the player cancels. */
  pickOpenPath(options: { title: string }): Promise<string | null>;
}

const NO_DIALOGS: FileDialogs = {
  pickSavePath: () => Promise.reject(new Error('File dialogs are not available here.')),
  pickOpenPath: () => Promise.reject(new Error('File dialogs are not available here.')),
};

export class GameHost {
  private campaign: Campaign | null = null;
  private settings: LlmSettings;
  private engine: LlmEngine | null = null;
  private readonly persistence: PersistenceService;
  private readonly queue: GenerationQueue;
  /** Package files opened this session, by package id; campaign.new resolves 'imported' here. */
  private readonly importedNations = new Map<string, NationPackage>();

  constructor(
    dataDir: string,
    private readonly broadcast: Broadcast,
    private readonly dialogs: FileDialogs = NO_DIALOGS,
  ) {
    this.persistence = new PersistenceService(dataDir);
    this.settings = this.persistence.loadSettings();
    this.rebuildEngine();
    this.queue = new GenerationQueue({
      getEngine: () => this.engine,
      getCampaign: () => this.campaign,
      applyResult: (request, output) => this.applyJobResult(request, output),
      onChange: () => this.broadcast('state:queue', this.queue.snapshots()),
    });
  }

  /** Test hook: swap in a custom engine (e.g. a scripted mock). */
  setEngineForTesting(engine: LlmEngine): void {
    this.engine = engine;
    this.reconcile();
  }

  getCampaign(): Campaign | null {
    return this.campaign;
  }

  queueIdle(): Promise<void> {
    return this.queue.idle();
  }

  async handle(channel: string, payload?: unknown): Promise<Reply<unknown>> {
    try {
      const schema = INVOKE_SCHEMAS[channel as InvokeChannel];
      if (!schema) return { ok: false, error: `Unknown channel: ${channel}` };
      const parsed = schema.parse(payload ?? {});
      const data = await this.execute(channel as InvokeChannel, parsed);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof CommandError) return { ok: false, error: error.message };
      return { ok: false, error: (error as Error).message };
    }
  }

  private async execute<C extends InvokeChannel>(
    channel: C,
    payload: unknown,
  ): Promise<InvokeResults[C]> {
    type R = InvokeResults[C];
    switch (channel) {
      case 'campaign.new': {
        const input = payload as NewCampaignInput;
        const choice = input.nation;
        let nationPackage;
        if (choice?.mode === 'package') {
          nationPackage = findDefaultNation(choice.packageId);
          if (!nationPackage) throw new CommandError(`Unknown nation: ${choice.packageId}`);
        } else if (choice?.mode === 'imported') {
          nationPackage = this.importedNations.get(choice.packageId);
          if (!nationPackage) {
            throw new CommandError(
              'That imported nation is no longer available — import it again.',
            );
          }
        }
        this.campaign = createCampaign(input, nationPackage);
        this.afterStateChange();
        return this.campaign as R;
      }
      case 'campaign.command': {
        if (!this.campaign) throw new CommandError('No campaign in progress.');
        this.campaign = applyCommand(this.campaign, payload as PlayerCommand);
        this.afterStateChange();
        return this.campaign as R;
      }
      case 'campaign.save': {
        if (!this.campaign) throw new CommandError('No campaign to save.');
        const { name } = payload as { name: string };
        return this.persistence.saveCampaign(name, this.campaign) as R;
      }
      case 'campaign.load': {
        const { fileName } = payload as { fileName: string };
        this.campaign = this.persistence.loadCampaign(fileName);
        this.afterStateChange();
        return this.campaign as R;
      }
      case 'campaign.delete': {
        this.persistence.deleteSave((payload as { fileName: string }).fileName);
        return null as R;
      }
      case 'campaign.close': {
        this.campaign = null;
        this.afterStateChange();
        return null as R;
      }
      case 'campaign.snapshot':
        return this.campaign as R;
      case 'saves.list':
        return this.persistence.listSaves() as R;
      case 'nations.list':
        return DEFAULT_NATION_PACKAGES.map(describeNationPackage) as R;
      case 'nation.export': {
        if (!this.campaign) throw new CommandError('No campaign in progress.');
        // Build (and validate) before prompting, so a nation that cannot be
        // exported yet fails fast instead of after the player picked a file.
        const nationPackage = exportNationPackage(this.campaign);
        const filePath = await this.dialogs.pickSavePath({
          title: 'Export nation',
          defaultFileName: nationExportFileName(this.campaign),
        });
        if (!filePath) return null as R;
        const written = writeNationPackageFile(filePath, nationPackage);
        return { filePath: written, packageName: nationPackage.name } as R;
      }
      case 'nation.import': {
        const filePath = await this.dialogs.pickOpenPath({ title: 'Import nation' });
        if (!filePath) return null as R;
        const nationPackage = readNationPackageFile(filePath);
        this.importedNations.set(nationPackage.id, nationPackage);
        return { filePath, nation: describeNationPackage(nationPackage) } as R;
      }
      case 'settings.get':
        return this.settings as R;
      case 'settings.setLlm': {
        this.settings = llmSettingsSchema.parse(payload);
        this.persistence.saveSettings(this.settings);
        this.rebuildEngine();
        this.reconcile();
        return this.settings as R;
      }
      case 'llm.listModels': {
        const candidate = llmSettingsSchema.parse(payload);
        return (await createEngine(candidate).listModels()) as R;
      }
      case 'llm.test': {
        const candidate = llmSettingsSchema.parse(payload);
        return (await createEngine(candidate).testConnection()) as R;
      }
      case 'generation.retry': {
        this.queue.retry((payload as { key: string }).key);
        return null as R;
      }
      case 'queue.status':
        return this.queue.snapshots() as R;
      default:
        throw new Error(`Unhandled channel: ${channel satisfies never}`);
    }
  }

  private applyJobResult(request: JobRequest, output: unknown): void {
    if (!this.campaign) return;
    this.campaign = applyCommand(this.campaign, {
      type: 'applyJobResult',
      jobType: request.type,
      payload: request.payload,
      output,
    });
    this.afterStateChange();
  }

  private rebuildEngine(): void {
    this.engine = isEngineConfigured(this.settings) ? createEngine(this.settings) : null;
  }

  private reconcile(): void {
    const needed = this.campaign
      ? deriveNeededJobs(this.campaign).map((request) => ({
          ...request,
          label: jobLabel(this.campaign as Campaign, request),
        }))
      : [];
    this.queue.reconcile(needed);
  }

  private afterStateChange(): void {
    this.broadcast('state:campaign', this.campaign);
    this.reconcile();
  }
}
