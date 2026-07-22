/**
 * Seeded PRNG (mulberry32). All simulation randomness flows through a single
 * Rng whose state is persisted in the campaign, so a loaded save replays into
 * the same future given the same inputs.
 */

/** xmur3 string hash — turns an arbitrary seed string into a 32-bit state. */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class Rng {
  private s: number;

  constructor(state: number) {
    this.s = state >>> 0;
  }

  static fromSeed(seed: string): Rng {
    return new Rng(hashSeed(seed));
  }

  /** Current state, to persist back into the campaign after use. */
  get state(): number {
    return this.s;
  }

  /** Uniform float in [0, 1). */
  float(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.float() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[this.int(0, items.length - 1)];
  }

  /** Fisher–Yates; returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
