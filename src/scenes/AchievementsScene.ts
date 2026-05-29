import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { DEV_UNLOCK_ALL } from '../config/DevFlags';
import { ACHIEVEMENTS, achievementManager } from '../systems/AchievementManager';
import { t } from '../systems/I18nManager';
import { saveManager } from '../systems/SaveManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';

const VIEW_TOP = 120;
const VIEW_BOTTOM = GAME_HEIGHT - 100;
const ROW_H = 64;
const CARD_H = ROW_H - 8;
const CARD_R = 12;

export class AchievementsScene extends Phaser.Scene {
  private listContainer!: Phaser.GameObjects.Container;
  private listCam!: Phaser.Cameras.Scene2D.Camera;
  private scrollPos = 0;
  private maxScroll = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragging = false;
  private scrollbar!: Phaser.GameObjects.Graphics;
  private scrollbarFadeTimer?: Phaser.Time.TimerEvent;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: SCENE_KEYS.Achievements });
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);
    this.uiObjects = [];

    const title = this.add
      .text(GAME_WIDTH / 2, 36, t('achievements.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.uiObjects.push(title);

    const unlocked = achievementManager.unlockedCount();
    const counter = this.add
      .text(GAME_WIDTH / 2, 88, t('achievements.count', { unlocked, total: ACHIEVEMENTS.length }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.uiObjects.push(counter);

    const viewH = VIEW_BOTTOM - VIEW_TOP;
    const cardW = GAME_WIDTH - 40;

    // List container holds all cards at world coords (0, 0..totalH).
    // A dedicated sub-camera views only the viewport area — items outside
    // are not rendered by that camera (no overlap with the title above).
    this.listContainer = this.add.container(0, 0);
    ACHIEVEMENTS.forEach((a, i) => {
      const y = i * ROW_H + 4;
      const realState = saveManager.getAchievement(a.id);
      const state = DEV_UNLOCK_ALL ? { unlocked: true, progress: a.target } : realState;
      const tint = state.unlocked ? 0xf2cc8f : 0x444444;
      const alpha = state.unlocked ? 1 : 0.6;
      const cx = GAME_WIDTH / 2;
      const cy = y + CARD_H / 2;

      const card = this.add.graphics();
      const topColor = state.unlocked ? 0x2a2e4a : 0x1f2236;
      const botColor = state.unlocked ? 0x1f2236 : 0x171a28;
      card.fillGradientStyle(topColor, topColor, botColor, botColor, 1);
      card.fillRoundedRect(cx - cardW / 2, y, cardW, CARD_H, CARD_R);
      card.lineStyle(state.unlocked ? 2 : 1, tint, state.unlocked ? 0.9 : 0.4);
      card.strokeRoundedRect(cx - cardW / 2, y, cardW, CARD_H, CARD_R);

      const icon = this.add
        .text(40, cy, a.icon, {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '28px',
          color: state.unlocked ? '#f2cc8f' : '#777777',
        })
        .setOrigin(0, 0.5)
        .setAlpha(alpha);
      const titleText = this.add
        .text(90, cy - 14, t(`achievements.items.${a.id}.title`), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: state.unlocked ? '#ffffff' : '#999999',
        })
        .setOrigin(0, 0.5)
        .setAlpha(alpha);
      const desc = this.add
        .text(90, cy + 8, t(`achievements.items.${a.id}.desc`), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#cccccc',
        })
        .setOrigin(0, 0.5)
        .setAlpha(alpha);
      const progressLabel = state.unlocked
        ? '✓'
        : `${Math.min(state.progress, a.target)} / ${a.target}`;
      const progress = this.add
        .text(GAME_WIDTH - 40, cy, progressLabel, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: state.unlocked ? '#81b29a' : '#aaaaaa',
        })
        .setOrigin(1, 0.5);

      this.listContainer.add([card, icon, titleText, desc, progress]);
    });

    // Scrollbar — rendered by main cam, drawn outside the list container.
    this.scrollbar = this.add.graphics();
    this.uiObjects.push(this.scrollbar);

    const backBtn = new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 40,
      width: 200,
      height: 44,
      label: t('achievements.back').replace(/^←\s*/, ''),
      icon: '←',
      fontSize: 16,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });
    this.uiObjects.push(backBtn);

    // Set up the dedicated list camera.
    this.listCam = this.cameras.add(0, VIEW_TOP, GAME_WIDTH, viewH);
    this.listCam.setBackgroundColor(0); // transparent (alpha 0)
    // Main camera ignores the list — only listCam renders the cards.
    this.cameras.main.ignore(this.listContainer);
    // List camera ignores all UI (title/counter/scrollbar/back).
    this.listCam.ignore(this.uiObjects);

    const totalH = ACHIEVEMENTS.length * ROW_H;
    this.maxScroll = Math.max(0, totalH - viewH);

    this.drawScrollbar(viewH, totalH);
    this.bindScrollInput(viewH, totalH);
  }

  private drawScrollbar(viewH: number, totalH: number): void {
    this.scrollbar.clear();
    if (this.maxScroll === 0) return;
    const trackX = GAME_WIDTH - 8;
    const thumbH = Math.max(30, viewH * (viewH / totalH));
    const ratio = this.scrollPos / this.maxScroll;
    const thumbY = VIEW_TOP + (viewH - thumbH) * ratio;
    this.scrollbar.fillStyle(0xffffff, 0.12);
    this.scrollbar.fillRoundedRect(trackX - 2, VIEW_TOP, 4, viewH, 2);
    this.scrollbar.fillStyle(0xf2cc8f, 0.85);
    this.scrollbar.fillRoundedRect(trackX - 2, thumbY, 4, thumbH, 2);
  }

  private bindScrollInput(viewH: number, totalH: number): void {
    const inView = (y: number): boolean => y >= VIEW_TOP && y <= VIEW_BOTTOM;

    const refresh = (): void => {
      this.listCam.scrollY = this.scrollPos;
      this.drawScrollbar(viewH, totalH);
      this.flashScrollbar();
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!inView(pointer.y)) return;
      this.dragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollPos;
      this.game.canvas.style.cursor = 'grabbing';
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const delta = pointer.y - this.dragStartY;
      this.scrollPos = Phaser.Math.Clamp(this.dragStartScroll - delta, 0, this.maxScroll);
      refresh();
    });
    const releaseDrag = (): void => {
      this.dragging = false;
      this.game.canvas.style.cursor = '';
    };
    this.input.on('pointerup', releaseDrag);
    this.input.on('pointerupoutside', releaseDrag);

    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
        if (!inView(pointer.y)) return;
        this.scrollPos = Phaser.Math.Clamp(this.scrollPos + dy * 0.6, 0, this.maxScroll);
        refresh();
      },
    );
  }

  private flashScrollbar(): void {
    this.scrollbar.setAlpha(1);
    this.scrollbarFadeTimer?.remove(false);
    this.scrollbarFadeTimer = this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: this.scrollbar,
        alpha: 0.5,
        duration: 500,
        ease: 'Sine.easeOut',
      });
    });
  }
}
