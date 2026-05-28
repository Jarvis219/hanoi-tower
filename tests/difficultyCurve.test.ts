import { describe, it, expect } from 'vitest';
import { DifficultySystem } from '../src/systems/DifficultySystem';
import { TUNING } from '../src/config/Tuning';

describe('DifficultySystem', () => {
  const d = new DifficultySystem();

  it('starts at base speed at level 0', () => {
    expect(d.speedForLevel(0)).toBe(TUNING.block.baseSpeed);
  });

  it('increases with level', () => {
    expect(d.speedForLevel(5)).toBeGreaterThan(d.speedForLevel(0));
  });

  it('caps at maxSpeed', () => {
    expect(d.speedForLevel(10_000)).toBe(TUNING.block.maxSpeed);
  });

  it('wind disabled below threshold', () => {
    expect(d.isWindActive(TUNING.wind.enabledFromLevel - 1)).toBe(false);
    expect(d.windForce(TUNING.wind.enabledFromLevel - 1)).toBe(0);
  });

  it('wind force grows after threshold and caps at maxForce', () => {
    expect(d.isWindActive(TUNING.wind.enabledFromLevel)).toBe(true);
    expect(d.windForce(TUNING.wind.enabledFromLevel)).toBe(0);
    expect(d.windForce(TUNING.wind.enabledFromLevel + 1000)).toBe(TUNING.wind.maxForce);
  });
});
