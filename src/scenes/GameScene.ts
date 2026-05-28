import Phaser from 'phaser';
import { ATLAS_FRAMES, MID_BLOCK_KEYS } from '../config/atlas';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { Block, BlockState } from '../objects/Block';
import { DebrisPool } from '../objects/BlockPool';
import { Sky } from '../objects/Sky';
import { Streetscape } from '../objects/Streetscape';
import { Tower } from '../objects/Tower';
import { TUNING } from '../config/Tuning';
import type { PowerUpType } from '../config/Tuning';
import { achievementManager } from '../systems/AchievementManager';
import { analyticsManager } from '../systems/AnalyticsManager';
import { audioManager } from '../systems/AudioManager';
import { shakeForGameOver, shakeForSlice, triggerSlowMoIfCombo } from '../systems/CameraFx';
import { buildDailyContext } from '../systems/DailyChallengeManager';
import { DifficultySystem } from '../systems/DifficultySystem';
import { hapticManager } from '../systems/HapticManager';
import { applyMagnet, PowerUpEffects, rollPowerUp } from '../systems/PowerUpSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { saveManager } from '../systems/SaveManager';
import { themeManager } from '../systems/ThemeManager';
import { t } from '../systems/I18nManager';
import { showScorePopup } from '../ui/ScorePopup';
import { showToast } from '../ui/Toast';
import { sliceBlock } from '../utils/math';
import { emitPerfectSparkle, emitSliceDebris, emitThudDust } from '../objects/FxEmitter';
import { HUD_EVENTS } from './HUDScene';
import type { GameMode } from '../types/SaveData';

const SWING_LEFT = 20;
const SWING_RIGHT = GAME_WIDTH - 20;
const FLOOR_Y = GAME_HEIGHT - 80;
const VISIBLE_TOP_BAND = 220;

// Block visuals use the sprite's native aspect ratio. The sprite is ~256x150,
// so to keep buildings recognizable we use ~ that aspect for blocks.
const BLOCK_PIXEL_HEIGHT = 70;
const FOUNDATION_PIXEL_HEIGHT = 90;
const FOUNDATION_PIXEL_WIDTH = 280;
const INITIAL_BLOCK_WIDTH = 220;

export class GameScene extends Phaser.Scene {
  private tower!: Tower;
  private difficulty!: DifficultySystem;
  private scoring!: ScoreSystem;
  private effects!: PowerUpEffects;
  private debrisPool!: DebrisPool;
  private sky?: Sky;
  private active: Block | null = null;
  private level = 0;
  private gameOverFired = false;
  private pendingWideBonus = false;
  private mode: GameMode = 'classic';
  private rng: () => number = Math.random;
  private perfectCountThisRun = 0;
  private maxComboThisRun = 0;
  private runStartedAt = 0;
  private detachUnlockListener?: () => void;

  constructor() {
    super({ key: SCENE_KEYS.Game });
  }

  public init(data: { mode?: GameMode } = {}): void {
    this.mode = data.mode ?? 'classic';
    if (this.mode === 'daily') {
      const ctx = buildDailyContext();
      this.rng = ctx.rng;
    } else {
      this.rng = Math.random;
    }
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.skyColor);
    this.sky = new Sky(this);
    new Streetscape(this, FLOOR_Y + 20);
    audioManager.playBgm();

    this.detachUnlockListener = achievementManager.onUnlock(({ def }) => {
      showToast(
        this,
        def.icon,
        `🏆 ${t(`achievements.items.${def.id}.title`)}`,
        t(`achievements.items.${def.id}.desc`),
      );
    });
    void COLORS;

    this.tower = new Tower();
    this.difficulty = new DifficultySystem();
    this.scoring = new ScoreSystem();
    this.scoring.reset();
    this.effects = new PowerUpEffects();
    this.debrisPool = new DebrisPool(this);
    this.level = 0;
    this.gameOverFired = false;
    this.pendingWideBonus = false;
    this.perfectCountThisRun = 0;
    this.maxComboThisRun = 0;
    this.runStartedAt = performance.now();
    this.active = null;

    if (!this.scene.isActive(SCENE_KEYS.HUD)) {
      this.scene.launch(SCENE_KEYS.HUD);
    }
    this.events.emit(HUD_EVENTS.UpdateScore, 0);
    this.events.emit(HUD_EVENTS.UpdateLevel, 0);
    this.events.emit(HUD_EVENTS.UpdateCombo, { combo: 0, multiplier: 1 });

    this.spawnFoundation();
    this.spawnNextBlock();
    analyticsManager.track('game_started', { mode: this.mode });

    this.input.on('pointerdown', this.handleDrop, this);
    this.input.keyboard?.on('keydown-SPACE', this.handleDrop, this);
    this.input.keyboard?.on('keydown-ESC', this.pauseGame, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  public update(_time: number, deltaMs: number): void {
    this.sky?.update(this.cameras.main.scrollY);
    if (this.effects) {
      const before = this.effects.list().length;
      this.effects.tick(deltaMs);
      const after = this.effects.list();
      // Emit if list changed length or we're showing live timers
      if (before > 0 || after.length !== before) {
        this.events.emit(
          HUD_EVENTS.UpdateEffects,
          after.map((e) => ({ ...e })),
        );
      }
    }
  }

  private onShutdown = (): void => {
    this.input.off('pointerdown', this.handleDrop, this);
    this.input.keyboard?.off('keydown-SPACE', this.handleDrop, this);
    this.input.keyboard?.off('keydown-ESC', this.pauseGame, this);
    this.detachUnlockListener?.();
    this.detachUnlockListener = undefined;
    this.tower.clear();
    this.debrisPool?.clear();
    if (this.scene.isActive(SCENE_KEYS.HUD)) {
      this.scene.stop(SCENE_KEYS.HUD);
    }
  };

  private pauseGame = (): void => {
    if (this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch(SCENE_KEYS.Pause);
    this.scene.bringToTop(SCENE_KEYS.Pause);
  };

  private spawnFoundation(): void {
    const foundation = new Block(this, {
      x: GAME_WIDTH / 2,
      y: FLOOR_Y,
      width: FOUNDATION_PIXEL_WIDTH,
      height: FOUNDATION_PIXEL_HEIGHT,
      spriteKey: 'block_foundation',
      color: 0x3d405b,
    });
    foundation.settleAt(FLOOR_Y);
    this.tower.push(foundation);
  }

  private pickSpriteKey(level: number, powerUp: PowerUpType | null, isPerfectFollowup: boolean) {
    if (powerUp === 'magnet') return 'block_special' as const;
    if (isPerfectFollowup && Math.random() < 0.35) return 'block_special' as const;
    const idx = level % MID_BLOCK_KEYS.length;
    return MID_BLOCK_KEYS[idx] ?? 'block_mid_1';
  }

  private spawnNextBlock(): void {
    const prev = this.tower.top();
    if (!prev) return;

    const baseWidth = prev.logicalWidth;
    const y = prev.y - BLOCK_PIXEL_HEIGHT;
    const wasPerfect = this.scoring.getCombo() > 0;
    const powerUp = rollPowerUp(this.level, this.rng);
    const spriteKey = this.pickSpriteKey(this.level, powerUp, wasPerfect);

    let width = this.level === 0 ? INITIAL_BLOCK_WIDTH : Math.min(baseWidth, INITIAL_BLOCK_WIDTH);
    if (this.pendingWideBonus) {
      width = Math.min(width * TUNING.powerup.wide.multiplier, SWING_RIGHT - SWING_LEFT - 20);
      this.pendingWideBonus = false;
    }

    const block = new Block(this, {
      x: GAME_WIDTH / 2,
      y,
      width,
      height: BLOCK_PIXEL_HEIGHT,
      spriteKey,
      powerUp,
    });

    let speed = this.difficulty.speedForLevel(this.level);
    if (this.effects.isActive('slow')) speed *= TUNING.powerup.slow.timeScaleFactor;
    const startDir: 1 | -1 = this.level % 2 === 0 ? 1 : -1;
    block.startSwing(SWING_LEFT, SWING_RIGHT, speed, startDir);
    this.active = block;
  }

  private handleDrop(): void {
    if (this.scene.isPaused()) return;
    if (!this.active || this.active.state !== BlockState.Swinging) return;
    const dropping = this.active;
    dropping.dropWithGravity(this);
    audioManager.playSfx('drop');

    const prev = this.tower.top();
    if (!prev) return;

    const targetY = prev.y - BLOCK_PIXEL_HEIGHT;

    const checkLanding = () => {
      if (dropping.state !== BlockState.Falling) return;
      if (dropping.y >= targetY) {
        this.events.off(Phaser.Scenes.Events.UPDATE, checkLanding);
        this.handleLanding(dropping, prev, targetY);
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, checkLanding);
  }

  private handleLanding(dropping: Block, prev: Block, targetY: number): void {
    // Magnet effect applies before slicing — if previous active magnet, snap
    // dropping block toward previous center when within threshold.
    if (this.effects.isActive('magnet')) {
      const snapped = applyMagnet(dropping.left, dropping.right, prev.left, prev.right);
      if (snapped.snapped) {
        dropping.x = (snapped.left + snapped.right) / 2;
      }
    }

    const result = sliceBlock(
      { left: dropping.left, right: dropping.right },
      { left: prev.left, right: prev.right },
      TUNING.block.perfectTolerance,
    );

    if (result.kind === 'miss') {
      this.triggerGameOver(dropping);
      return;
    }

    dropping.settleAt(targetY);
    dropping.resizeTo(result.newLeft, result.newRight);

    const landed = this.scoring.registerLanding(this.level, result.kind);
    if (landed.isPerfect) {
      this.perfectCountThisRun += 1;
      achievementManager.bump('first_perfect', 1);
      achievementManager.bump('perfect_100', 1);
    }
    if (landed.combo > this.maxComboThisRun) {
      this.maxComboThisRun = landed.combo;
      achievementManager.setIfHigher('combo_5', landed.combo);
      achievementManager.setIfHigher('combo_10', landed.combo);
      achievementManager.setIfHigher('combo_20', landed.combo);
    }

    if (result.kind === 'sliced') {
      const debrisWidth = Math.abs(result.debrisRight - result.debrisLeft);
      const debrisX = (result.debrisLeft + result.debrisRight) / 2;
      this.debrisPool.spawn(debrisX, targetY, debrisWidth, BLOCK_PIXEL_HEIGHT, dropping.fillColor);
      emitSliceDebris(this, debrisX, targetY);
      emitThudDust(this, dropping.x, targetY, 0.8);
      shakeForSlice(this, Math.abs(result.delta), dropping.logicalWidth);
      audioManager.playSfx('slice');
      audioManager.playSfx('thud');
      hapticManager.vibrate(70);
    } else {
      emitPerfectSparkle(this, dropping.x, targetY);
      audioManager.playSfx('perfect', Math.min(1 + this.scoring.getCombo() * 0.05, 1.8));
      hapticManager.vibrate(30);
    }

    if (landed.shouldRestoreWidth) {
      const restore = TUNING.scoring.comboRestoreAmount;
      const newLeft = Math.max(SWING_LEFT, dropping.left - restore / 2);
      const newRight = Math.min(SWING_RIGHT, dropping.right + restore / 2);
      dropping.resizeTo(newLeft, newRight);
    }

    // Activate this block's own power-up (consume badge first).
    if (dropping.powerUp) {
      this.activatePowerUp(dropping.powerUp, dropping);
      dropping.consumeBadge();
    }

    this.tower.push(dropping);
    this.active = null;
    this.level += 1;

    const popupColor = landed.isPerfect ? '#f2cc8f' : '#ffffff';
    const popupText = landed.isPerfect
      ? `+${landed.pointsAwarded} PERFECT!${landed.multiplier > 1 ? ` x${landed.multiplier}` : ''}`
      : `+${landed.pointsAwarded}`;
    showScorePopup(this, GAME_WIDTH / 2, 120, popupText, popupColor);

    this.events.emit(HUD_EVENTS.UpdateScore, landed.totalScore);
    this.events.emit(HUD_EVENTS.UpdateLevel, this.level);
    this.events.emit(HUD_EVENTS.UpdateCombo, {
      combo: landed.combo,
      multiplier: landed.multiplier,
    });

    if (landed.isPerfect) {
      triggerSlowMoIfCombo(this, landed.combo);
    }

    this.panCameraUp(targetY, () => this.spawnNextBlock());
  }

  private panCameraUp(latestBlockY: number, onComplete: () => void): void {
    const cam = this.cameras.main;
    const desiredCenterY = latestBlockY + VISIBLE_TOP_BAND;
    const targetScrollY = desiredCenterY - cam.height / 2;

    if (targetScrollY >= cam.scrollY) {
      onComplete();
      return;
    }

    this.tweens.add({
      targets: cam,
      scrollY: targetScrollY,
      duration: TUNING.camera.panDurationMs,
      ease: 'Sine.easeInOut',
      onComplete,
    });
  }

  private activatePowerUp(type: PowerUpType, block: Block): void {
    achievementManager.bump(`powerup_${type}`, 1);
    switch (type) {
      case 'wide':
        this.pendingWideBonus = true;
        showScorePopup(this, GAME_WIDTH / 2, 160, t('powerup.wide'), '#81b29a');
        break;
      case 'slow':
        this.effects.activate('slow', TUNING.powerup.slow.durationMs);
        this.events.emit(
          HUD_EVENTS.UpdateEffects,
          this.effects.list().map((e) => ({ ...e })),
        );
        showScorePopup(this, GAME_WIDTH / 2, 160, t('powerup.slow'), '#5dade2');
        break;
      case 'magnet':
        this.effects.activate('magnet', 12_000);
        this.events.emit(
          HUD_EVENTS.UpdateEffects,
          this.effects.list().map((e) => ({ ...e })),
        );
        showScorePopup(this, GAME_WIDTH / 2, 160, t('powerup.magnet'), '#f2cc8f');
        break;
      case 'heal':
        {
          const targetWidth = INITIAL_BLOCK_WIDTH;
          const currentWidth = block.logicalWidth;
          const needed = (targetWidth - currentWidth) * TUNING.powerup.heal.restoreFraction;
          const newLeft = Math.max(SWING_LEFT, block.left - needed / 2);
          const newRight = Math.min(SWING_RIGHT, block.right + needed / 2);
          block.resizeTo(newLeft, newRight);
          showScorePopup(this, GAME_WIDTH / 2, 160, t('powerup.heal'), '#e07a5f');
        }
        break;
    }
    audioManager.playSfx('perfect', 1.4);
  }

  private triggerGameOver(dropping: Block): void {
    if (this.gameOverFired) return;
    this.gameOverFired = true;
    this.active = null;
    this.tweens.add({
      targets: dropping,
      alpha: 0,
      duration: 600,
      onComplete: () => dropping.destroy(),
    });
    shakeForGameOver(this);
    audioManager.playSfx('gameover');
    audioManager.stopBgm(600);
    hapticManager.pattern([60, 40, 120]);
    const score = this.scoring.getScore();
    const record = saveManager.recordRun(score, this.level, this.mode);
    analyticsManager.track('game_over', { mode: this.mode, score, level: this.level });
    // Milestone achievements based on this run
    achievementManager.setIfHigher('tower_10', this.level);
    achievementManager.setIfHigher('tower_25', this.level);
    achievementManager.setIfHigher('tower_50', this.level);
    achievementManager.setIfHigher('tower_100', this.level);
    achievementManager.setIfHigher('tower_200', this.level);
    achievementManager.setIfHigher('score_1k', score);
    achievementManager.setIfHigher('score_5k', score);
    achievementManager.setIfHigher('score_10k', score);
    if (this.mode === 'daily') {
      achievementManager.bump('daily_1', 1);
      // daily_7: distinct play-days count
      const distinctDays = new Set(
        (saveManager as unknown as { data: { dailyResults: { date: string }[] } }).data
          ?.dailyResults?.map((r) => r.date) ?? [],
      ).size;
      achievementManager.setIfHigher('daily_7', distinctDays);
    }
    const runDurationMs = Math.max(0, Math.round(performance.now() - this.runStartedAt));
    this.time.delayedCall(700, () => {
      this.scene.stop(SCENE_KEYS.HUD);
      this.scene.start(SCENE_KEYS.GameOver, {
        level: this.level,
        score,
        highScore: saveManager.highScore,
        newHighScore: record.newHighScore,
        mode: this.mode,
        runDurationMs,
        perfects: this.perfectCountThisRun,
      });
    });
  }
}

void ATLAS_FRAMES;
