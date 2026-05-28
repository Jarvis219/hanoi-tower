import Phaser from 'phaser';
import { TUNING } from '../config/Tuning';

const SLOWMO_TIMESCALE = 0.55;
const SLOWMO_DURATION_MS = 350;
const COMBO_SLOWMO_TRIGGER = 3;

export const shakeForSlice = (scene: Phaser.Scene, deltaAbs: number, blockWidth: number): void => {
  const ratio = Phaser.Math.Clamp(deltaAbs / Math.max(blockWidth, 1), 0, 1);
  const intensity = ratio * TUNING.camera.shakeMaxIntensity;
  scene.cameras.main.shake(TUNING.camera.shakeBaseDurationMs, intensity);
};

export const shakeForGameOver = (scene: Phaser.Scene): void => {
  scene.cameras.main.shake(320, 0.014);
};

/**
 * Brief slow-motion on high combos. Uses scene time scaling rather than
 * camera flash so input handling pauses too.
 */
export const triggerSlowMoIfCombo = (scene: Phaser.Scene, combo: number): boolean => {
  if (combo < COMBO_SLOWMO_TRIGGER) return false;
  scene.time.timeScale = SLOWMO_TIMESCALE;
  scene.tweens.timeScale = SLOWMO_TIMESCALE;
  scene.time.delayedCall(
    SLOWMO_DURATION_MS,
    () => {
      scene.time.timeScale = 1;
      scene.tweens.timeScale = 1;
    },
    [],
    scene,
  );
  return true;
};
