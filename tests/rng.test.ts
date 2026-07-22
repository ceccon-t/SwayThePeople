import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '@core/sim/rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = Rng.fromSeed('hello');
    const b = Rng.fromSeed('hello');
    for (let i = 0; i < 100; i++) {
      expect(a.float()).toBe(b.float());
    }
  });

  it('differs across seeds', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(Rng.fromSeed('a').float()).not.toBe(Rng.fromSeed('b').float());
  });

  it('resumes from persisted state', () => {
    const a = Rng.fromSeed('resume');
    a.float();
    const savedState = a.state;
    const b = new Rng(savedState);
    expect(b.float()).toBe(a.float());
  });

  it('produces values in expected ranges', () => {
    const rng = Rng.fromSeed('ranges');
    for (let i = 0; i < 500; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('shuffle preserves elements', () => {
    const rng = Rng.fromSeed('shuffle');
    const shuffled = rng.shuffle([1, 2, 3, 4, 5]);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
