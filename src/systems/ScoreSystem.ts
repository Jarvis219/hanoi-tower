import { TUNING } from '../config/Tuning';

export type LandingKind = 'perfect' | 'sliced';

export interface LandingResult {
  pointsAwarded: number;
  totalScore: number;
  combo: number;
  multiplier: number;
  isPerfect: boolean;
  shouldRestoreWidth: boolean;
}

export class ScoreSystem {
  private score = 0;
  private combo = 0;

  public reset(): void {
    this.score = 0;
    this.combo = 0;
  }

  public registerLanding(level: number, kind: LandingKind): LandingResult {
    const isPerfect = kind === 'perfect';
    if (isPerfect) {
      this.combo += 1;
    } else {
      this.combo = 0;
    }

    const base = TUNING.scoring.base + level * TUNING.scoring.perLevelBonus;
    const perfectBonus = isPerfect ? TUNING.scoring.perfectBonus : 0;
    const multiplier = this.multiplierForCombo(this.combo);
    const pointsAwarded = (base + perfectBonus) * multiplier;
    this.score += pointsAwarded;

    const shouldRestoreWidth =
      isPerfect && this.combo > 0 && this.combo % TUNING.scoring.comboRestoreWidthAt === 0;

    return {
      pointsAwarded,
      totalScore: this.score,
      combo: this.combo,
      multiplier,
      isPerfect,
      shouldRestoreWidth,
    };
  }

  public getScore(): number {
    return this.score;
  }

  public getCombo(): number {
    return this.combo;
  }

  private multiplierForCombo(combo: number): number {
    const { comboThresholds, comboMultipliers } = TUNING.scoring;
    let mult = 1;
    for (let i = 0; i < comboThresholds.length; i += 1) {
      const threshold = comboThresholds[i];
      const value = comboMultipliers[i];
      if (threshold !== undefined && value !== undefined && combo >= threshold) {
        mult = value;
      }
    }
    return mult;
  }
}
