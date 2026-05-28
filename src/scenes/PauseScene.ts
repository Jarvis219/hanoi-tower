import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { t } from '../systems/I18nManager';
import { Button, COLOR } from '../ui/Button';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Pause });
  }

  public create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, t('pause.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '42px',
        color: '#f2cc8f',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const btnW = 240;
    let y = GAME_HEIGHT * 0.46;
    const gap = 14;

    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      label: t('pause.resume').replace(/^▶\s*/, ''),
      icon: '▶',
      bgColor: COLOR.primary,
      onClick: () => this.resume(),
    });
    y += 52 + gap;
    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      label: t('pause.restart').replace(/^↻\s*/, ''),
      icon: '↻',
      bgColor: COLOR.accent,
      onClick: () => {
        this.scene.stop(SCENE_KEYS.Game);
        this.scene.stop(SCENE_KEYS.HUD);
        this.scene.start(SCENE_KEYS.Game);
        this.scene.stop();
      },
    });
    y += 52 + gap;
    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      label: t('pause.menu').replace(/^↩\s*/, ''),
      icon: '↩',
      bgColor: COLOR.neutral,
      onClick: () => {
        this.scene.stop(SCENE_KEYS.Game);
        this.scene.stop(SCENE_KEYS.HUD);
        this.scene.start(SCENE_KEYS.MainMenu);
        this.scene.stop();
      },
    });

    this.input.keyboard?.on('keydown-ESC', () => this.resume());
  }

  private resume(): void {
    this.scene.resume(SCENE_KEYS.Game);
    this.scene.stop();
  }
}
