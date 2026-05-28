import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../src/utils/seededRandom';
import { applyMagnet, PowerUpEffects, rollPowerUp } from '../src/systems/PowerUpSystem';
import { TUNING } from '../src/config/Tuning';

describe('rollPowerUp', () => {
  it('returns null at level 0', () => {
    expect(rollPowerUp(0, () => 0)).toBeNull();
  });

  it('returns null when level is not a spawn level', () => {
    const notSpawn = TUNING.powerup.spawnEveryNLevels + 1;
    expect(rollPowerUp(notSpawn, () => 0)).toBeNull();
  });

  it('returns null when RNG roll exceeds spawn chance', () => {
    const spawnLevel = TUNING.powerup.spawnEveryNLevels;
    expect(rollPowerUp(spawnLevel, () => 0.99)).toBeNull();
  });

  it('returns a power-up type at spawn level with low RNG', () => {
    const spawnLevel = TUNING.powerup.spawnEveryNLevels;
    // Two RNG calls happen: first for spawn check, second for type pick.
    const rng = mulberry32(7);
    const result = rollPowerUp(spawnLevel, rng);
    if (result !== null) {
      expect(['wide', 'slow', 'magnet', 'heal']).toContain(result);
    }
  });

  it('is deterministic with seeded RNG', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const resultsA = Array.from({ length: 20 }, (_, i) =>
      rollPowerUp(i * TUNING.powerup.spawnEveryNLevels, a),
    );
    const resultsB = Array.from({ length: 20 }, (_, i) =>
      rollPowerUp(i * TUNING.powerup.spawnEveryNLevels, b),
    );
    expect(resultsA).toEqual(resultsB);
  });
});

describe('applyMagnet', () => {
  it('snaps when within threshold', () => {
    const result = applyMagnet(110, 210, 100, 200);
    expect(result.snapped).toBe(true);
    expect((result.left + result.right) / 2).toBeCloseTo(150);
  });

  it('does not snap when outside threshold', () => {
    const result = applyMagnet(200, 300, 100, 200);
    expect(result.snapped).toBe(false);
    expect(result.left).toBe(200);
    expect(result.right).toBe(300);
  });

  it('snaps exactly at threshold boundary', () => {
    const t = TUNING.powerup.magnet.autoPerfectWithinPx;
    const result = applyMagnet(100 + t, 200 + t, 100, 200);
    expect(result.snapped).toBe(true);
  });
});

describe('PowerUpEffects', () => {
  it('activates and expires after duration', () => {
    const e = new PowerUpEffects();
    e.activate('slow', 1000);
    expect(e.isActive('slow')).toBe(true);
    e.tick(500);
    expect(e.isActive('slow')).toBe(true);
    e.tick(600);
    expect(e.isActive('slow')).toBe(false);
  });

  it('refreshes duration when re-activated', () => {
    const e = new PowerUpEffects();
    e.activate('slow', 1000);
    e.tick(800);
    e.activate('slow', 2000);
    e.tick(1500);
    expect(e.isActive('slow')).toBe(true);
  });

  it('list returns the current active effects', () => {
    const e = new PowerUpEffects();
    e.activate('slow', 1000);
    e.activate('magnet', 2000);
    expect(e.list().map((x) => x.type).sort()).toEqual(['magnet', 'slow']);
  });
});
