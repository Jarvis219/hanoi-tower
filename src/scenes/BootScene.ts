import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/Constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  preload(): void {
    // Minimal assets needed for the preload progress bar itself.
    // Add tiny placeholder textures here when bar artwork is ready.
  }

  create(): void {
    this.scene.start(SCENE_KEYS.Preload);
  }
}
