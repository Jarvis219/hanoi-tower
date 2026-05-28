import { describe, it, expect } from 'vitest';
import { mulberry32, seedFromDate } from '../src/utils/seededRandom';

describe('mulberry32', () => {
  it('produces deterministic output for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different output for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seedFromDate', () => {
  it('encodes Y/M/D into a stable number', () => {
    expect(seedFromDate(new Date(2026, 4, 28))).toBe(20260528);
  });

  it('changes when day changes', () => {
    const a = seedFromDate(new Date(2026, 4, 28));
    const b = seedFromDate(new Date(2026, 4, 29));
    expect(a).not.toBe(b);
  });
});
