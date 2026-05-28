import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { SPRITE_SHEET_KEY, SPRITE_SHEET_PATH, registerAtlasFrames } from '../config/atlas';
import { consentManager } from '../systems/ConsentManager';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Preload });
  }

  preload(): void {
    this.drawProgressBar();
    this.load.image(SPRITE_SHEET_KEY, SPRITE_SHEET_PATH);
    // Sky decorations (Kenney CC0 background-elements pack)
    for (let i = 1; i <= 9; i += 1) {
      this.load.image(`cloud_${i}`, `assets/images/sky/cloud${i}.png`);
    }
    this.load.image('sun', 'assets/images/sky/sun.png');
    this.load.image('moon_full', 'assets/images/sky/moon_full.png');
    this.load.image('moon_half', 'assets/images/sky/moon_half.png');
    // Street buildings — 2D Pixel City Pack (OpenGameArt, CC-BY 4.0)
    this.load.image('shop_brick_1', 'assets/images/buildings/shop_brick_1.png');
    this.load.image('shop_brick_2', 'assets/images/buildings/shop_brick_2.png');
    this.load.image('shop_yellow_1', 'assets/images/buildings/shop_yellow_1.png');
    this.load.image('shop_yellow_2', 'assets/images/buildings/shop_yellow_2.png');
    this.load.image('skyline_distant', 'assets/images/buildings/skyline_distant.png');
  }

  create(): void {
    registerAtlasFrames(this.textures);
    // Route to consent banner if ads are configured but the user hasn't decided yet.
    // Otherwise drop into the menu — Tutorial gate is handled by MainMenu.
    const adsConfigured = Boolean(import.meta.env.VITE_ADSENSE_PUBLISHER_ID);
    if (adsConfigured && !consentManager.hasDecided()) {
      this.scene.start(SCENE_KEYS.ConsentBanner);
      return;
    }
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  private drawProgressBar(): void {
    const w = GAME_WIDTH * 0.6;
    const h = 14;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;

    const outline = this.add.rectangle(x + w / 2, y, w, h).setStrokeStyle(2, 0xffffff);
    const fill = this.add.rectangle(x, y, 0, h - 4, 0xf2cc8f).setOrigin(0, 0.5);
    const label = this.add
      .text(GAME_WIDTH / 2, y - 30, 'Đang tải…', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (w - 4) * value;
    });
    this.load.once('complete', () => {
      outline.destroy();
      fill.destroy();
      label.destroy();
    });
  }
}
