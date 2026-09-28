/**
 * The IPC contract — the single place channel names and payload schemas live.
 * Main validates every incoming payload against these schemas; the renderer
 * uses the types via the preload bridge.
 */
import { z } from 'zod';
import { newCampaignInputSchema } from './campaign/create';
import { playerCommandSchema } from './commands/commands';
import { llmSettingsSchema } from './generation/engine';
import type { LlmSettings, ModelInfo } from './generation/engine';
import type { JobSnapshot } from './generation/jobs';
import type { Campaign } from './model/schemas';
import type { NationPackageInfo } from './nation/package';

export const INVOKE_SCHEMAS = {
  'campaign.new': newCampaignInputSchema,
  'campaign.command': playerCommandSchema,
  'campaign.save': z.object({ name: z.string().min(1) }),
  'campaign.load': z.object({ fileName: z.string().min(1) }),
  'campaign.delete': z.object({ fileName: z.string().min(1) }),
  'campaign.close': z.object({}).optional(),
  'campaign.snapshot': z.object({}).optional(),
  'saves.list': z.object({}).optional(),
  'nations.list': z.object({}).optional(),
  /** Prompts for a location and writes the current nation as a package file. */
  'nation.export': z.object({}).optional(),
  /** Prompts for a package file, validates it, and keeps it available for campaign.new. */
  'nation.import': z.object({}).optional(),
  'settings.get': z.object({}).optional(),
  'settings.setLlm': llmSettingsSchema,
  /** Model listing / connection tests run against candidate (unsaved) settings. */
  'llm.listModels': llmSettingsSchema,
  'llm.test': llmSettingsSchema,
  'generation.retry': z.object({ key: z.string() }),
  'queue.status': z.object({}).optional(),
} as const;

export type InvokeChannel = keyof typeof INVOKE_SCHEMAS;

/** Every invoke resolves to this envelope; errors are data, not rejections. */
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SaveInfo {
  fileName: string;
  name: string;
  savedAt: string;
  day: number;
  phase: string;
  candidateName: string;
  partyName: string;
  sizeBytes: number;
}

/** Outcome of a nation export; null means the player cancelled the dialog. */
export interface NationExportInfo {
  filePath: string;
  packageName: string;
}

/** A package file the player opened; null means the dialog was cancelled. */
export interface NationImportInfo {
  filePath: string;
  nation: NationPackageInfo;
}

export interface InvokeResults {
  'campaign.new': Campaign;
  'campaign.command': Campaign;
  'campaign.save': SaveInfo;
  'campaign.load': Campaign;
  'campaign.delete': null;
  'campaign.close': null;
  'campaign.snapshot': Campaign | null;
  'saves.list': SaveInfo[];
  'nations.list': NationPackageInfo[];
  'nation.export': NationExportInfo | null;
  'nation.import': NationImportInfo | null;
  'settings.get': LlmSettings;
  'settings.setLlm': LlmSettings;
  'llm.listModels': ModelInfo[];
  'llm.test': { ok: boolean; message: string };
  'generation.retry': null;
  'queue.status': JobSnapshot[];
}

export const EVENT_CHANNELS = {
  campaignUpdated: 'state:campaign',
  queueUpdated: 'state:queue',
} as const;

export interface EventPayloads {
  'state:campaign': Campaign | null;
  'state:queue': JobSnapshot[];
}
