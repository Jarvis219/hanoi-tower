import Phaser from 'phaser';
import { ATLAS_FRAMES, PARALLAX_KEYS, SPRITE_SHEET_KEY } from '../config/atlas';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

/**
 * 4-layer parallax sky. Each layer scrolls at a fraction of the camera's
 * vertical movement so distant layers appear to lag behind, giving a
 * sense of altitude. Layers tile vertically to fill arbitrarily tall climbs.
 */
export class ParallaxBackground {
  private readonly layers: { image: Phaser.GameObjects.TileSprite; factor: number }[] = [];

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(SPRITE_SHEET_KEY)) return;

    PARALLAX_KEYS.forEach((key, index) => {
      const frame = ATLAS_FRAMES[key];
      const factor = 0.1 + index * 0.18; // 0.10, 0.28, 0.46, 0.64
      const tile = scene.add
        .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, SPRITE_SHEET_KEY, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-100 + index);
      // Scale the texture so width fits screen while preserving aspect
      const scale = GAME_WIDTH / frame.w;
      tile.tileScaleX = scale;
      tile.tileScaleY = scale;
      this.layers.push({ image: tile, factor });
    });
  }

  /** Call every frame with the current camera scrollY. */
  public update(scrollY: number): void {
    for (const { image, factor } of this.layers) {
      image.tilePositionY = scrollY * factor;
    }
  }
}
