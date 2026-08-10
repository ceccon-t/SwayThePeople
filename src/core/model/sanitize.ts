/**
 * Sanitizers shared by everything that constructs campaign entities from
 * untrusted proposals — LLM outputs (generation/apply.ts) and nation packages
 * (nation/package.ts) alike: "the proposal proposes, the core disposes".
 */
import type { Campaign } from './schemas';
import { clamp } from './queries';
import type { Rng } from '../sim/rng';

/** Normalize relative weights into positive fractions that sum to 1. */
export function normalizeWeights(values: number[]): number[] {
  const positive = values.map((v) => Math.max(v, 0.01));
  const total = positive.reduce((sum, v) => sum + v, 0);
  return positive.map((v) => v / total);
}

/** The proposed two-digit party code, re-rolled if malformed or taken. */
export function uniquePartyCode(campaign: Campaign, proposed: string, rng: Rng): string {
  const taken = new Set(campaign.parties.map((p) => p.code));
  const cleaned = proposed.replace(/\D/g, '').padStart(2, '0').slice(0, 2);
  if (cleaned.length === 2 && !taken.has(cleaned)) return cleaned;
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = String(rng.int(10, 99));
    if (!taken.has(code)) return code;
  }
  return '99';
}

export function clampAge(age: number): number {
  return Math.round(clamp(age, 18, 99));
}
