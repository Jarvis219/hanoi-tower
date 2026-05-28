import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { t } from '../systems/I18nManager';
import { saveManager } from '../systems/SaveManager';
import { themeManager, THEMES, THEME_ORDER } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';
import type { ThemeId } from '../types/SaveData';

export class ThemesScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Themes });
  }

  public create(): void {
    const currentTheme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(currentTheme.menuBgColor);

    this.add
      .text(GAME_WIDTH / 2, 36, t('themes.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const cardH = 150;
    const startY = 95;
    THEME_ORDER.forEach((id, i) => {
      this.makeCard(id, startY + i * (cardH + 14), cardH);
    });

    new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 40,
      width: 200,
      height: 44,
      label: t('themes.back').replace(/^←\s*/, ''),
      icon: '←',
      fontSize: 16,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });
  }

  private makeCard(id: ThemeId, y: number, h: number): void {
    const theme = THEMES[id];
    const unlocked = themeManager.isUnlocked(id);
    const selected = saveManager.selectedTheme === id && unlocked;

    const cardW = GAME_WIDTH - 40;
    const x = GAME_WIDTH / 2;

    // Card body with gradient (shows the theme's sky color as visual cue)
    const card = this.add.graphics();
    const bgTop = unlocked ? theme.skyColor : 0x2a2a3a;
    const bgBot = unlocked ? this.darken(theme.skyColor, 0.35) : 0x1a1a25;
    card.fillGradientStyle(bgTop, bgTop, bgBot, bgBot, 0.95);
    card.fillRoundedRect(x - cardW / 2, y, cardW, h, 14);
    const border = selected ? 0x81b29a : unlocked ? 0xf2cc8f : 0x555555;
    card.lineStyle(3, border, 1);
    card.strokeRoundedRect(x - cardW / 2, y, cardW, h, 14);

    // Tag chip at top-right
    const tagLabel = selected ? t('themes.selected') : unlocked ? '' : '🔒';
    if (tagLabel) {
      const tagBg = selected ? 0x81b29a : 0x555555;
      const chip = this.add.graphics();
      chip.fillStyle(tagBg, 1);
      chip.fillRoundedRect(x + cardW / 2 - 110, y + 10, 100, 26, 8);
      this.add
        .text(x + cardW / 2 - 60, y + 23, tagLabel, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    // Theme name
    this.add
      .text(x - cardW / 2 + 20, y + 22, t(`themes.${id}`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: unlocked ? '#ffffff' : '#888888',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0, 0);

    // Description
    this.add
      .text(x - cardW / 2 + 20, y + 60, t(`themes.desc.${id}`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: unlocked ? '#ffffff' : '#777777',
        wordWrap: { width: cardW - 40 },
      })
      .setOrigin(0, 0)
      .setAlpha(0.92);

    // Bottom row — either Select button or lock requirement
    if (!unlocked) {
      this.add
        .text(
          x - cardW / 2 + 20,
          y + h - 28,
          t('themes.locked', { level: theme.unlockAtLevel }),
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '12px',
            color: '#aaaaaa',
            fontStyle: 'bold',
          },
        )
        .setOrigin(0, 0.5);
    } else if (!selected) {
      new Button(this, {
        x: x + cardW / 2 - 70,
        y: y + h - 22,
        width: 110,
        height: 32,
        label: t('themes.select'),
        fontSize: 12,
        bgColor: COLOR.primary,
        onClick: () => this.onSelect(id),
      });
    }
  }

  private darken(color: number, amt: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amt));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amt));
    const b = Math.max(0, (color & 0xff) * (1 - amt));
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  }

  private onSelect(id: ThemeId): void {
    if (themeManager.select(id)) {
      this.scene.start(SCENE_KEYS.MainMenu);
    }
  }
}
