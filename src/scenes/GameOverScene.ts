import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { adsManager } from '../systems/AdsManager';
import { supabaseEnabled } from '../systems/supabase/SupabaseClient';
import { leaderboardService } from '../systems/supabase/LeaderboardService';
import { t } from '../systems/I18nManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';
import { shareScore } from '../utils/shareScore';
import type { GameMode } from '../types/SaveData';

interface GameOverData {
  level?: number;
  score?: number;
  highScore?: number;
  newHighScore?: boolean;
  mode?: GameMode;
  runDurationMs?: number;
  perfects?: number;
}

export class GameOverScene extends Phaser.Scene {
  private level = 0;
  private score = 0;
  private highScore = 0;
  private newHighScore = false;
  private mode: GameMode = 'classic';
  private runDurationMs = 0;
  private perfects = 0;
  private shareBtn?: Button;
  private rankText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.GameOver });
  }

  public init(data: GameOverData): void {
    this.level = data.level ?? 0;
    this.score = data.score ?? 0;
    this.highScore = data.highScore ?? 0;
    this.newHighScore = data.newHighScore ?? false;
    this.mode = data.mode ?? 'classic';
    this.runDurationMs = data.runDurationMs ?? 0;
    this.perfects = data.perfects ?? 0;
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);

    // ─── Subtle theme-colored top gradient overlay ─────────────────────
    const sky = this.add.graphics();
    sky.fillGradientStyle(
      theme.skyColor,
      theme.skyColor,
      theme.menuBgColor,
      theme.menuBgColor,
      0.4,
    );
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.45);

    // ─── Title with entrance slide-in ──────────────────────────────────
    const title = this.add
      .text(GAME_WIDTH / 2, 70, t('gameover.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '44px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5,
        shadow: { color: '#000', blur: 8, fill: true, offsetX: 0, offsetY: 4 },
      })
      .setOrigin(0.5);
    title.setAlpha(0).setY(40);
    this.tweens.add({
      targets: title,
      alpha: 1,
      y: 70,
      duration: 360,
      ease: 'Cubic.easeOut',
    });

    // ─── Mode chip ─────────────────────────────────────────────────────
    if (this.mode === 'daily') {
      const chip = this.add.graphics();
      chip.fillStyle(0x5dade2, 0.85);
      chip.fillRoundedRect(GAME_WIDTH / 2 - 50, 110, 100, 22, 11);
      this.add
        .text(GAME_WIDTH / 2, 121, '📅 Daily', {
          fontFamily: 'system-ui, "Segoe UI Emoji", sans-serif',
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    // ─── Hero score card ───────────────────────────────────────────────
    const cardX = 20;
    const cardY = 140;
    const cardW = GAME_WIDTH - 40;
    const cardH = 220;
    const card = this.add.graphics();
    const topColor = this.newHighScore ? 0xfde68a : theme.skyColor;
    const botColor = this.newHighScore ? 0x8a6020 : this.darken(theme.skyColor, 0.6);
    const borderColor = this.newHighScore ? 0xffd700 : theme.accentColor;
    card.fillGradientStyle(topColor, topColor, botColor, botColor, 1);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 18);
    card.lineStyle(this.newHighScore ? 3 : 2, borderColor, 1);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 18);
    // Left accent stripe
    const stripe = this.add.graphics();
    stripe.fillStyle(borderColor, 0.95);
    stripe.fillRoundedRect(cardX + 5, cardY + 6, 5, cardH - 12, 3);

    // NEW HIGH ribbon — only when applicable
    if (this.newHighScore) {
      const ribbonW = 180;
      const ribbon = this.add.graphics();
      ribbon.fillStyle(0xff4d4d, 1);
      ribbon.fillRoundedRect(GAME_WIDTH / 2 - ribbonW / 2, cardY - 16, ribbonW, 28, 14);
      ribbon.lineStyle(2, 0xffffff, 0.85);
      ribbon.strokeRoundedRect(GAME_WIDTH / 2 - ribbonW / 2, cardY - 16, ribbonW, 28, 14);
      const ribbonText = this.add
        .text(GAME_WIDTH / 2, cardY - 2, `★ ${t('gameover.new_high', { high: '' }).split('\n')[0]?.replace(/[★!\s]/g, '') || 'NEW HIGH SCORE'} ★`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      // Pulse animation
      this.tweens.add({
        targets: [ribbon, ribbonText],
        scale: { from: 1, to: 1.06 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Hero score number — huge, with stroke
    const scoreColor = this.newHighScore ? '#1a1a1a' : '#ffffff';
    const heroScore = this.add
      .text(GAME_WIDTH / 2, cardY + 50, String(this.score), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '64px',
        color: scoreColor,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    heroScore.setScale(0.5).setAlpha(0);
    this.tweens.add({
      targets: heroScore,
      scale: 1,
      alpha: 1,
      duration: 480,
      ease: 'Back.easeOut',
      delay: 180,
    });

    // SCORE label above hero number
    this.add
      .text(GAME_WIDTH / 2, cardY + 12, 'SCORE', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: scoreColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    // Previous high underneath (smaller, only if NOT new high)
    if (!this.newHighScore) {
      this.add
        .text(
          GAME_WIDTH / 2,
          cardY + 96,
          t('gameover.high', { high: this.highScore }),
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            color: '#ffffff',
            stroke: '#000',
            strokeThickness: 2,
          },
        )
        .setOrigin(0.5)
        .setAlpha(0.85);
    }

    // ─── 3-stat row inside card ────────────────────────────────────────
    const statY = cardY + cardH - 60;
    const statSlotW = (cardW - 30) / 3;
    const seconds = Math.max(0, Math.round(this.runDurationMs / 1000));
    const durStr = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    this.makeStat(cardX + 15 + statSlotW * 0 + statSlotW / 2, statY, '🏢', String(this.level), 'FLOOR', scoreColor);
    this.makeStat(cardX + 15 + statSlotW * 1 + statSlotW / 2, statY, '✨', String(this.perfects), 'PERFECT', scoreColor);
    this.makeStat(cardX + 15 + statSlotW * 2 + statSlotW / 2, statY, '⏱', durStr, 'TIME', scoreColor);

    // ─── Rank chip (below card) ────────────────────────────────────────
    this.rankText = this.add
      .text(GAME_WIDTH / 2, cardY + cardH + 18, supabaseEnabled ? t('gameover.submitting') : '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    void this.submitAndShowRank();
    // Interstitial after a beat so users see their score first.
    this.time.delayedCall(800, () => {
      void adsManager.maybeShowInterstitial();
    });

    // ─── Action buttons ────────────────────────────────────────────────
    const btnW = 280;
    let by = cardY + cardH + 56;
    const gap = 10;

    new Button(this, {
      x: GAME_WIDTH / 2,
      y: by,
      width: btnW,
      height: 52,
      label: t('gameover.replay').replace(/^▶\s*/, ''),
      icon: '▶',
      fontSize: 18,
      bgColor: COLOR.primary,
      onClick: () => this.scene.start(SCENE_KEYS.Game, { mode: this.mode }),
    });

    by += 52 + gap;
    // Share + Menu side-by-side (50/50 of btnW)
    const halfW = (btnW - 8) / 2;
    this.shareBtn = new Button(this, {
      x: GAME_WIDTH / 2 - halfW / 2 - 4,
      y: by,
      width: halfW,
      height: 44,
      label: t('gameover.share').replace(/^📤\s*/, ''),
      icon: '📤',
      fontSize: 14,
      bgColor: COLOR.secondary,
      onClick: () => void this.handleShare(),
    });
    new Button(this, {
      x: GAME_WIDTH / 2 + halfW / 2 + 4,
      y: by,
      width: halfW,
      height: 44,
      label: t('gameover.menu').replace(/^↩\s*/, ''),
      icon: '↩',
      fontSize: 14,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });

    void stripe; // keep reference (added to scene already)
  }

  /** A single stat cell: icon on top, value middle, label below. */
  private makeStat(x: number, y: number, icon: string, value: string, label: string, color: string): void {
    this.add
      .text(x, y - 18, icon, {
        fontFamily: 'system-ui, "Segoe UI Emoji", sans-serif',
        fontSize: '18px',
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 4, value, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color,
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.add
      .text(x, y + 24, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '10px',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0.75);
  }

  private darken(color: number, amt: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amt));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amt));
    const b = Math.max(0, (color & 0xff) * (1 - amt));
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  }

  private async submitAndShowRank(): Promise<void> {
    if (!supabaseEnabled || !this.rankText) {
      this.rankText?.setText('');
      return;
    }
    const result = await leaderboardService.submitScore({
      score: this.score,
      level: this.level,
      mode: this.mode,
      runDurationMs: this.runDurationMs,
      perfects: this.perfects,
    });
    if (!this.rankText) return;
    if (!result.ok) {
      const reason = result.reason ?? 'unknown';
      if (reason === 'rate_limited_local' || reason.includes('rate_limited')) {
        this.rankText.setText(t('gameover.submitted'));
        return;
      }
      this.rankText.setText(
        reason === 'offline' || reason === 'unavailable'
          ? t('gameover.submit_offline')
          : t('gameover.submit_failed'),
      );
      return;
    }
    if (result.reason === 'skipped-not-best') {
      this.rankText.setText(t('gameover.submitted'));
      return;
    }
    if (result.rank) {
      this.rankText.setText(t('gameover.world_rank', { rank: result.rank.alltime }));
    } else {
      this.rankText.setText(t('gameover.submitted'));
    }
  }

  private async handleShare(): Promise<void> {
    if (!this.shareBtn) return;
    const canvas = (this.game.canvas as HTMLCanvasElement) ?? undefined;
    const result = await shareScore({
      text: t('gameover.share_text', { score: this.score, level: this.level }),
      canvas,
    });
    if (result.method === 'clipboard' && result.ok) {
      this.shareBtn.setLabel(t('gameover.share_copied'));
      this.time.delayedCall(2000, () =>
        this.shareBtn?.setLabel(t('gameover.share').replace(/^📤\s*/, '')),
      );
    }
  }
}
