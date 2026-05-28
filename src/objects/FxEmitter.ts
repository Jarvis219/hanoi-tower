import Phaser from 'phaser';
import { ATLAS_FRAMES, SPRITE_SHEET_KEY } from '../config/atlas';

/**
 * One-shot particle bursts triggered at landing events. Each burst spawns
 * its own short-lived emitter and self-destructs after the lifespan so we
 * don't accumulate emitters over a long game.
 */
export const emitPerfectSparkle = (scene: Phaser.Scene, x: number, y: number): void => {
  if (!scene.textures.exists(SPRITE_SHEET_KEY) || !ATLAS_FRAMES.fx_perfect_sparkle) return;
  const emitter = scene.add.particles(x, y, SPRITE_SHEET_KEY, {
    frame: 'fx_perfect_sparkle',
    lifespan: 600,
    speed: { min: 120, max: 240 },
    scale: { start: 0.4, end: 0 },
    alpha: { start: 1, end: 0 },
    angle: { min: 200, max: 340 },
    quantity: 8,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(12);
  scene.time.delayedCall(700, () => emitter.destroy());
};

export const emitThudDust = (scene: Phaser.Scene, x: number, y: number, intensity = 1): void => {
  if (!scene.textures.exists(SPRITE_SHEET_KEY) || !ATLAS_FRAMES.fx_thud_dust) return;
  const emitter = scene.add.particles(x, y, SPRITE_SHEET_KEY, {
    frame: 'fx_thud_dust',
    lifespan: 500,
    speed: { min: 30, max: 90 * intensity },
    scale: { start: 0.4 * intensity, end: 0 },
    alpha: { start: 0.6, end: 0 },
    angle: { min: 220, max: 320 },
    gravityY: 220,
  });
  emitter.explode(Math.floor(4 + intensity * 4));
  scene.time.delayedCall(600, () => emitter.destroy());
};

export const emitSliceDebris = (scene: Phaser.Scene, x: number, y: number): void => {
  if (!scene.textures.exists(SPRITE_SHEET_KEY) || !ATLAS_FRAMES.fx_slice_debris) return;
  const emitter = scene.add.particles(x, y, SPRITE_SHEET_KEY, {
    frame: 'fx_slice_debris',
    lifespan: 700,
    speed: { min: 60, max: 180 },
    scale: { start: 0.5, end: 0.2 },
    alpha: { start: 1, end: 0 },
    rotate: { min: -180, max: 180 },
    angle: { min: 180, max: 360 },
    gravityY: 480,
  });
  emitter.explode(10);
  scene.time.delayedCall(800, () => emitter.destroy());
};
