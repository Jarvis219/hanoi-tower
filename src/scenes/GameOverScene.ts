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

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, t('gameover.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

    if (this.mode === 'daily') {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, '📅 Daily', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#5dade2',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    }

    // Score card — rounded panel for emphasis
    const card = this.add.graphics();
    card.fillStyle(0x0f3460, 0.85);
    card.fillRoundedRect(GAME_WIDTH * 0.1, GAME_HEIGHT * 0.32, GAME_WIDTH * 0.8, 160, 14);
    card.lineStyle(2, 0xf2cc8f, 0.9);
    card.strokeRoundedRect(GAME_WIDTH * 0.1, GAME_HEIGHT * 0.32, GAME_WIDTH * 0.8, 160, 14);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, t('gameover.score', { score: this.score }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, t('gameover.level', { level: this.level }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#cccccc',
      })
      .setOrigin(0.5, 0);

    const hsLabel = this.newHighScore
      ? t('gameover.new_high', { high: this.highScore })
      : t('gameover.high', { high: this.highScore });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.47, hsLabel, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: this.newHighScore ? '#f2cc8f' : '#aaaaaa',
        align: 'center',
        fontStyle: this.newHighScore ? 'bold' : 'normal',
      })
      .setOrigin(0.5, 0);

    this.rankText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, supabaseEnabled ? t('gameover.submitting') : '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#cccccc',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    void this.submitAndShowRank();
    // Fire an interstitial gate ~700ms after the score is on screen, so users
    // see their result first. Frequency-capped inside AdsManager.
    this.time.delayedCall(800, () => {
      void adsManager.maybeShowInterstitial();
    });

    const btnW = 260;
    let y = GAME_HEIGHT * 0.66;
    const gap = 12;

    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      label: t('gameover.replay').replace(/^▶\s*/, ''),
      icon: '▶',
      bgColor: COLOR.primary,
      onClick: () => this.scene.start(SCENE_KEYS.Game, { mode: this.mode }),
    });

    y += 52 + gap;
    this.shareBtn = new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      height: 46,
      label: t('gameover.share').replace(/^📤\s*/, ''),
      icon: '📤',
      fontSize: 16,
      bgColor: COLOR.secondary,
      onClick: () => void this.handleShare(),
    });

    y += 46 + gap;
    new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: btnW,
      height: 44,
      label: t('gameover.menu').replace(/^↩\s*/, ''),
      icon: '↩',
      fontSize: 14,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });
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
      // rate_limited (local or server): we already have a submission for this
      // mode in the window — don't surface as an error, treat as "saved".
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
    // skipped-not-best: score wasn't a new PB; show neutral "submitted" rather
    // than a failure indicator.
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
