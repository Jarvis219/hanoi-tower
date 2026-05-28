import Phaser from 'phaser';
import { GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { audioManager } from '../systems/AudioManager';
import { t } from '../systems/I18nManager';
import { installFpsMeterIfRequested } from '../ui/FpsMeter';

export const HUD_EVENTS = {
  UpdateScore: 'hud:updateScore',
  UpdateLevel: 'hud:updateLevel',
  UpdateCombo: 'hud:updateCombo',
  UpdateEffects: 'hud:updateEffects',
} as const;

export interface ActiveEffectView {
  type: 'wide' | 'slow' | 'magnet' | 'heal';
  remainingMs: number;
  totalMs: number;
}

export interface HUDEventPayload {
  [HUD_EVENTS.UpdateScore]: number;
  [HUD_EVENTS.UpdateLevel]: number;
  [HUD_EVENTS.UpdateCombo]: { combo: number; multiplier: number };
  [HUD_EVENTS.UpdateEffects]: ActiveEffectView[];
}

export class HUDScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private effectsContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: SCENE_KEYS.HUD });
  }

  public create(): void {
    this.scoreText = this.add
      .text(20, 20, '0', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#f2cc8f',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setScrollFactor(0);

    this.levelText = this.add
      .text(GAME_WIDTH / 2, 28, t('hud.floor', { level: 0 }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    this.comboText = this.add
      .text(20, 64, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ff6b6b',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setScrollFactor(0);

    this.effectsContainer = this.add.container(20, 96).setScrollFactor(0);
    installFpsMeterIfRequested(this);

    this.buildPauseButton();

    const game = this.scene.get(SCENE_KEYS.Game);
    game.events.on(HUD_EVENTS.UpdateScore, this.onScore, this);
    game.events.on(HUD_EVENTS.UpdateLevel, this.onLevel, this);
    game.events.on(HUD_EVENTS.UpdateCombo, this.onCombo, this);
    game.events.on(HUD_EVENTS.UpdateEffects, this.onEffects, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      game.events.off(HUD_EVENTS.UpdateScore, this.onScore, this);
      game.events.off(HUD_EVENTS.UpdateLevel, this.onLevel, this);
      game.events.off(HUD_EVENTS.UpdateCombo, this.onCombo, this);
      game.events.off(HUD_EVENTS.UpdateEffects, this.onEffects, this);
    });
  }

  private onScore = (score: number): void => {
    this.scoreText.setText(score.toString());
  };

  private onLevel = (level: number): void => {
    this.levelText.setText(t('hud.floor', { level }));
  };

  private buildPauseButton(): Phaser.GameObjects.Container {
    const size = 44;
    const container = this.add.container(GAME_WIDTH - 20 - size / 2, 20 + size / 2).setScrollFactor(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
    bg.lineStyle(2, 0xffffff, 0.35);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
    const icon = this.add
      .text(0, -1, '⏸', {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const hit = this.add
      .rectangle(0, 0, size, size, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    container.add([bg, icon, hit]);

    hit.on('pointerup', () => {
      const gameScene = this.scene.get(SCENE_KEYS.Game);
      if (gameScene.scene.isPaused()) return;
      audioManager.playSfx('click');
      gameScene.scene.pause();
      this.scene.launch(SCENE_KEYS.Pause);
      this.scene.bringToTop(SCENE_KEYS.Pause);
    });
    hit.on('pointerover', () => {
      this.tweens.add({ targets: container, scale: 1.08, duration: 120 });
    });
    hit.on('pointerout', () => {
      this.tweens.add({ targets: container, scale: 1, duration: 120 });
    });
    return container;
  }

  private onEffects = (effects: ActiveEffectView[]): void => {
    this.effectsContainer.removeAll(true);
    const ICONS: Record<ActiveEffectView['type'], string> = {
      wide: '↔',
      slow: '⏱',
      magnet: '★',
      heal: '♥',
    };
    effects.forEach((e, i) => {
      const y = i * 28;
      const icon = this.add.text(0, y, ICONS[e.type], {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 3,
      });
      const barW = 80;
      const barH = 8;
      const fillW = barW * Math.max(0, e.remainingMs / e.totalMs);
      const bars = this.add.graphics();
      bars.fillStyle(0x000000, 0.55);
      bars.fillRoundedRect(28, y + 4, barW, barH, 4);
      if (fillW > 2) {
        bars.fillStyle(0xf2cc8f, 1);
        bars.fillRoundedRect(28, y + 4, fillW, barH, 4);
      }
      this.effectsContainer.add([icon, bars]);
    });
  };

  private onCombo = (data: HUDEventPayload[typeof HUD_EVENTS.UpdateCombo]): void => {
    if (data.combo <= 1) {
      this.comboText.setText('');
      return;
    }
    this.comboText.setText(t('hud.combo', { combo: data.combo, mult: data.multiplier }));
    this.tweens.add({
      targets: this.comboText,
      scale: { from: 1.4, to: 1 },
      duration: 250,
      ease: 'Back.easeOut',
    });
  };
}
