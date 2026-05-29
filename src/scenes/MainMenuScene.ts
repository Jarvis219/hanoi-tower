import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { adsManager } from '../systems/AdsManager';
import { audioManager } from '../systems/AudioManager';
import {
  buildDailyContext,
  dailyAlreadyPlayed,
  formatDateLabel,
} from '../systems/DailyChallengeManager';
import { t } from '../systems/I18nManager';
import { saveManager } from '../systems/SaveManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.MainMenu });
  }

  public create(): void {
    if (!saveManager.tutorialDone) {
      this.scene.start(SCENE_KEYS.Tutorial);
      return;
    }

    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);

    // Subtle theme-tinted top gradient — adds atmosphere without harming text contrast.
    const sky = this.add.graphics();
    sky.fillGradientStyle(
      theme.skyColor,
      theme.skyColor,
      theme.menuBgColor,
      theme.menuBgColor,
      0.55,
    );
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.5);

    // Title — large with subtle shadow. Auto-shrink + word-wrap so longer
    // translations ("VIETNAM STREET STACK") fit GAME_WIDTH without
    // overflowing past the edges.
    const MAX_TITLE_W = GAME_WIDTH - 40;
    const titleStr = t('title');
    // Heuristic: tune font size by character count.
    // 13 chars (VI) → 46px; 20 chars (EN) → ~34px. Clamp to 28..46.
    const dynamicFont = Math.max(28, Math.min(46, Math.round(580 / Math.max(8, titleStr.length))));
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.14, titleStr, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${dynamicFont}px`,
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000',
        strokeThickness: 5,
        shadow: { color: '#000', blur: 8, fill: true, offsetX: 0, offsetY: 4 },
        wordWrap: { width: MAX_TITLE_W, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: title,
      y: title.y - 6,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Theme + high-score subtitle stack
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.21, `🎨 ${t(`themes.${theme.id}`)}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT * 0.27,
        t('menu.high', { score: saveManager.highScore, level: saveManager.highLevel }),
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#f2cc8f',
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5);

    // ── Primary buttons (big centered) ──────────────────────────────
    const btnW = 280;
    const gap = 16;
    let y = GAME_HEIGHT * 0.42;

    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      label: t('menu.play_classic').replace(/^▶\s*/, '').trim() || t('menu.play_classic'),
      icon: '▶',
      bgColor: COLOR.primary,
      onClick: () => this.startGame('classic'),
    });

    y += 56 + gap;
    const dailyCtx = buildDailyContext();
    const alreadyPlayed = dailyAlreadyPlayed();
    const dailyLabel = alreadyPlayed
      ? t('menu.daily_played', { date: formatDateLabel(dailyCtx.date) }).replace(/^📅\s*/, '')
      : t('menu.daily_play').replace(/^📅\s*/, '');
    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      label: dailyLabel,
      icon: '📅',
      bgColor: alreadyPlayed ? COLOR.muted : COLOR.secondary,
      disabled: alreadyPlayed,
      onClick: () => this.startGame('daily'),
    });

    // ── Secondary buttons (smaller, side-by-side) ───────────────────
    y += 56 + gap + 8;
    const halfW = (btnW - gap) / 2;
    new Button(this, {
      x: GAME_WIDTH / 2 - halfW / 2 - gap / 2,
      y,
      width: halfW,
      height: 46,
      label: t('themes.title').split(' ').pop() ?? 'Themes',
      icon: '🎨',
      fontSize: 14,
      bgColor: COLOR.accent,
      onClick: () => this.scene.start(SCENE_KEYS.Themes),
    });
    new Button(this, {
      x: GAME_WIDTH / 2 + halfW / 2 + gap / 2,
      y,
      width: halfW,
      height: 46,
      label: t('menu.achievements').replace(/^🏆\s*/, ''),
      icon: '🏆',
      fontSize: 14,
      bgColor: COLOR.highlight,
      textColor: '#1a1a2e',
      onClick: () => this.scene.start(SCENE_KEYS.Achievements),
    });

    y += 46 + gap;
    new Button(this, {
      x: GAME_WIDTH / 2 - halfW / 2 - gap / 2,
      y,
      width: halfW,
      height: 44,
      label: t('menu.leaderboard').replace(/^🌍\s*/, ''),
      icon: '🌍',
      fontSize: 14,
      bgColor: COLOR.secondary,
      onClick: () => this.scene.start(SCENE_KEYS.Leaderboard),
    });
    new Button(this, {
      x: GAME_WIDTH / 2 + halfW / 2 + gap / 2,
      y,
      width: halfW,
      height: 44,
      label: t('menu.settings').replace(/^⚙\s*/, ''),
      icon: '⚙',
      fontSize: 14,
      bgColor: COLOR.info,
      onClick: () => this.scene.start(SCENE_KEYS.Settings),
    });

    // Mount banner ad below the canvas (DOM overlay). Safe no-op when ads are
    // not configured or the user has not granted consent.
    void adsManager.showBanner();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 20, t('menu.hint'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.55);
  }

  private startGame(mode: 'classic' | 'daily'): void {
    audioManager.playBgm();
    this.scene.start(SCENE_KEYS.Game, { mode });
  }
}
