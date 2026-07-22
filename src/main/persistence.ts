/**
 * Save files and app settings. Saves are full campaign snapshots (validated
 * with the campaign schema on load); settings hold LLM configuration and are
 * stored separately — API keys never enter save files.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DEFAULT_LLM_SETTINGS, llmSettingsSchema } from '@core/generation/engine';
import type { LlmSettings } from '@core/generation/engine';
import { campaignSchema } from '@core/model/schemas';
import type { Campaign } from '@core/model/schemas';
import type { SaveInfo } from '@core/protocol';

const SAVE_FORMAT_VERSION = 1;

const saveFileSchema = z.object({
  formatVersion: z.literal(SAVE_FORMAT_VERSION),
  savedAt: z.string(),
  name: z.string(),
  campaign: campaignSchema,
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'campaign'
  );
}

export class PersistenceService {
  private readonly savesDir: string;
  private readonly settingsFile: string;

  constructor(dataDir: string) {
    this.savesDir = join(dataDir, 'saves');
    this.settingsFile = join(dataDir, 'settings.json');
    mkdirSync(this.savesDir, { recursive: true });
  }

  loadSettings(): LlmSettings {
    try {
      const raw = JSON.parse(readFileSync(this.settingsFile, 'utf-8'));
      return llmSettingsSchema.parse(raw);
    } catch {
      return structuredClone(DEFAULT_LLM_SETTINGS);
    }
  }

  saveSettings(settings: LlmSettings): void {
    writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
  }

  /** Same name = same slot (overwrites); new names create new slots. */
  saveCampaign(name: string, campaign: Campaign): SaveInfo {
    const fileName = `${slugify(name)}.json`;
    const payload = {
      formatVersion: SAVE_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
      name,
      campaign,
    };
    writeFileSync(join(this.savesDir, fileName), JSON.stringify(payload));
    return this.describe(fileName);
  }

  loadCampaign(fileName: string): Campaign {
    const raw = JSON.parse(readFileSync(join(this.savesDir, fileName), 'utf-8'));
    const parsed = saveFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('This save file is not compatible with this version of the game.');
    }
    return parsed.data.campaign;
  }

  deleteSave(fileName: string): void {
    rmSync(join(this.savesDir, fileName), { force: true });
  }

  listSaves(): SaveInfo[] {
    return readdirSync(this.savesDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        try {
          return this.describe(file);
        } catch {
          return null;
        }
      })
      .filter((info): info is SaveInfo => info !== null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  private describe(fileName: string): SaveInfo {
    const path = join(this.savesDir, fileName);
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const parsed = saveFileSchema.parse(raw);
    const campaign = parsed.campaign;
    const candidate = campaign.candidates.find((c) => c.id === campaign.playerCandidateId);
    const party = campaign.parties.find((p) => p.id === campaign.playerPartyId);
    return {
      fileName,
      name: parsed.name,
      savedAt: parsed.savedAt,
      day: campaign.day,
      phase: campaign.phase,
      candidateName: candidate?.name ?? '?',
      partyName: party?.name ?? '?',
      sizeBytes: statSync(path).size,
    };
  }
}
