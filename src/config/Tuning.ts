export const TUNING = {
  block: {
    initialWidth: 200,
    height: 40,
    baseSpeed: 220,
    speedIncrementPerLevel: 4,
    maxSpeed: 600,
    perfectTolerance: 4,
  },
  scoring: {
    base: 10,
    perLevelBonus: 1,
    perfectBonus: 50,
    comboThresholds: [3, 5, 8, 12] as const,
    comboMultipliers: [2, 3, 4, 5] as const,
    comboRestoreWidthAt: 5,
    comboRestoreAmount: 20,
  },
  camera: {
    panDurationMs: 280,
    shakeBaseDurationMs: 90,
    shakeMaxIntensity: 0.012,
  },
  wind: {
    enabledFromLevel: 50,
    maxForce: 30,
  },
  powerup: {
    spawnEveryNLevels: 8,
    spawnChance: 0.45,
    // Effect-specific tuning
    wide: { multiplier: 1.5 },
    slow: { timeScaleFactor: 0.6, durationMs: 5000 },
    magnet: { autoPerfectWithinPx: 22 },
    heal: { restoreFraction: 0.4 },
  },
} as const;

export type PowerUpType = 'wide' | 'slow' | 'magnet' | 'heal';

export const POWERUP_TYPES: readonly PowerUpType[] = ['wide', 'slow', 'magnet', 'heal'] as const;
