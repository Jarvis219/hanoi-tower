import { TUNING } from '../config/Tuning';

export class DifficultySystem {
  public speedForLevel(level: number): number {
    const raw = TUNING.block.baseSpeed + level * TUNING.block.speedIncrementPerLevel;
    return Math.min(raw, TUNING.block.maxSpeed);
  }

  public isWindActive(level: number): boolean {
    return level >= TUNING.wind.enabledFromLevel;
  }

  public windForce(level: number): number {
    if (!this.isWindActive(level)) return 0;
    const over = level - TUNING.wind.enabledFromLevel;
    return Math.min(over * 0.6, TUNING.wind.maxForce);
  }
}
