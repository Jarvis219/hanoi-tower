import { describe, it, expect } from 'vitest';
import { buildDailyContext, formatDateLabel } from '../src/systems/DailyChallengeManager';
import { rollPowerUp } from '../src/systems/PowerUpSystem';

describe('DailyChallenge', () => {
  it('produces identical sequences for same date across calls', () => {
    const date = new Date(2026, 4, 28); // 2026-05-28
    const a = buildDailyContext(date);
    const b = buildDailyContext(date);
    const seqA = Array.from({ length: 50 }, () => a.rng());
    const seqB = Array.from({ length: 50 }, () => b.rng());
    expect(seqA).toEqual(seqB);
    expect(a.seed).toBe(b.seed);
    expect(a.date).toBe('2026-05-28');
  });

  it('produces different sequences across different dates', () => {
    const d1 = new Date(2026, 4, 28);
    const d2 = new Date(2026, 4, 29);
    const a = buildDailyContext(d1);
    const b = buildDailyContext(d2);
    expect(a.seed).not.toBe(b.seed);
    expect(a.rng()).not.toBe(b.rng());
  });

  it('power-up roll is deterministic with the daily RNG', () => {
    const ctxA = buildDailyContext(new Date(2026, 4, 28));
    const ctxB = buildDailyContext(new Date(2026, 4, 28));
    const seqA: Array<string | null> = [];
    const seqB: Array<string | null> = [];
    for (let i = 1; i <= 60; i += 1) {
      seqA.push(rollPowerUp(i, ctxA.rng));
      seqB.push(rollPowerUp(i, ctxB.rng));
    }
    expect(seqA).toEqual(seqB);
  });

  it('formatDateLabel converts ISO to dd/mm/yyyy', () => {
    expect(formatDateLabel('2026-05-28')).toBe('28/05/2026');
  });
});
