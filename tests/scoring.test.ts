import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreSystem } from '../src/systems/ScoreSystem';
import { TUNING } from '../src/config/Tuning';

describe('ScoreSystem', () => {
  let s: ScoreSystem;
  beforeEach(() => {
    s = new ScoreSystem();
  });

  it('awards base + perfect bonus at multiplier 1 for first perfect', () => {
    const r = s.registerLanding(0, 'perfect');
    expect(r.combo).toBe(1);
    expect(r.multiplier).toBe(1);
    expect(r.isPerfect).toBe(true);
    expect(r.pointsAwarded).toBe(TUNING.scoring.base + TUNING.scoring.perfectBonus);
  });

  it('resets combo on a sliced landing', () => {
    s.registerLanding(0, 'perfect');
    s.registerLanding(1, 'perfect');
    const r = s.registerLanding(2, 'sliced');
    expect(r.combo).toBe(0);
    expect(r.multiplier).toBe(1);
  });

  it('reaches multiplier 2 at combo threshold[0]', () => {
    let r = s.registerLanding(0, 'perfect');
    for (let i = 1; i < TUNING.scoring.comboThresholds[0]!; i += 1) {
      r = s.registerLanding(i, 'perfect');
    }
    expect(r.combo).toBe(TUNING.scoring.comboThresholds[0]);
    expect(r.multiplier).toBe(TUNING.scoring.comboMultipliers[0]);
  });

  it('flags restore-width at combo multiples of restore interval', () => {
    let r = s.registerLanding(0, 'perfect');
    const restoreAt = TUNING.scoring.comboRestoreWidthAt;
    for (let i = 1; i < restoreAt; i += 1) {
      r = s.registerLanding(i, 'perfect');
    }
    expect(r.combo).toBe(restoreAt);
    expect(r.shouldRestoreWidth).toBe(true);
  });

  it('accumulates total score across landings', () => {
    s.registerLanding(0, 'sliced');
    const r = s.registerLanding(1, 'sliced');
    const expected =
      TUNING.scoring.base +
      TUNING.scoring.perLevelBonus * 0 +
      (TUNING.scoring.base + TUNING.scoring.perLevelBonus * 1);
    expect(r.totalScore).toBe(expected);
  });
});
