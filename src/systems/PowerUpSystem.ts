import type { PowerUpType } from '../config/Tuning';
import { POWERUP_TYPES, TUNING } from '../config/Tuning';

/**
 * Stateless roll: given a level and an RNG, decide whether the *next*
 * block should carry a power-up and which type. Centralized so daily
 * challenge can plug a seeded RNG in later.
 */
export const rollPowerUp = (level: number, rng: () => number = Math.random): PowerUpType | null => {
  if (level <= 0) return null;
  if (level % TUNING.powerup.spawnEveryNLevels !== 0) return null;
  if (rng() > TUNING.powerup.spawnChance) return null;
  const idx = Math.floor(rng() * POWERUP_TYPES.length);
  return POWERUP_TYPES[idx] ?? 'wide';
};

export interface ActiveEffect {
  type: PowerUpType;
  remainingMs: number;
  totalMs: number;
}

/**
 * Tracks timed power-up effects. `slow` is the only currently-timed one
 * but the API is general so adding more (e.g., shield) stays cheap.
 */
export class PowerUpEffects {
  private active: ActiveEffect[] = [];

  public activate(type: PowerUpType, durationMs: number): void {
    const existing = this.active.find((e) => e.type === type);
    if (existing) {
      existing.remainingMs = durationMs;
      existing.totalMs = durationMs;
      return;
    }
    this.active.push({ type, remainingMs: durationMs, totalMs: durationMs });
  }

  public tick(deltaMs: number): void {
    for (const e of this.active) {
      e.remainingMs -= deltaMs;
    }
    this.active = this.active.filter((e) => e.remainingMs > 0);
  }

  public isActive(type: PowerUpType): boolean {
    return this.active.some((e) => e.type === type);
  }

  public list(): readonly ActiveEffect[] {
    return this.active;
  }

  public clear(): void {
    this.active = [];
  }
}

/**
 * Apply the magnet effect: snap the dropping block toward the previous
 * block's center if the delta is within the auto-perfect threshold.
 * Returns the adjusted (left, right) bounds.
 */
export const applyMagnet = (
  currentLeft: number,
  currentRight: number,
  previousLeft: number,
  previousRight: number,
): { left: number; right: number; snapped: boolean } => {
  const currentCenter = (currentLeft + currentRight) / 2;
  const previousCenter = (previousLeft + previousRight) / 2;
  const delta = currentCenter - previousCenter;
  if (Math.abs(delta) > TUNING.powerup.magnet.autoPerfectWithinPx) {
    return { left: currentLeft, right: currentRight, snapped: false };
  }
  return {
    left: currentLeft - delta,
    right: currentRight - delta,
    snapped: true,
  };
};
