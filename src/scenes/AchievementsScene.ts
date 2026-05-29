import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { DEV_UNLOCK_ALL } from '../config/DevFlags';
import { ACHIEVEMENTS, achievementManager } from '../systems/AchievementManager';
import { t } from '../systems/I18nManager';
import { saveManager } from '../systems/SaveManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';

const VIEW_TOP = 110;
const VIEW_BOTTOM = GAME_HEIGHT - 90;
const CARD_H = 86;
const CARD_GAP = 10;
const ROW_H = CARD_H + CARD_GAP;
const CARD_R = 14;
const CARD_PAD = 14;

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

    // Cards first → bottom of z-stack so header/footer panels reliably
    // overpaint any scroll bleed into title/back-button areas.
    this.listContainer = this.add.container(0, 0);
    ACHIEVEMENTS.forEach((a, i) => {
      const y = i * ROW_H + CARD_GAP / 2;
      const realState = saveManager.getAchievement(a.id);
      const state = DEV_UNLOCK_ALL ? { unlocked: true, progress: a.target } : realState;
      this.makeCard(a, y, CARD_H, state.unlocked, state.progress);
    });

    // Solid header panel — covers 0..VIEW_TOP so scrolled cards can never
    // bleed into the title/counter strip.
    const headerBg = this.add.graphics();
    headerBg.fillStyle(theme.menuBgColor, 1);
    headerBg.fillRect(0, 0, GAME_WIDTH, VIEW_TOP - 2);
    headerBg.fillStyle(theme.accentColor, 0.55);
    headerBg.fillRect(20, VIEW_TOP - 2, GAME_WIDTH - 40, 1);
    headerBg.setDepth(10);
    this.uiObjects.push(headerBg);

    const title = this.add
      .text(GAME_WIDTH / 2, 36, t('achievements.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(11);
    this.uiObjects.push(title);

    const unlockedCount = achievementManager.unlockedCount();
    const counter = this.add
      .text(GAME_WIDTH / 2, 78, t('achievements.count', { unlocked: unlockedCount, total: ACHIEVEMENTS.length }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#dddddd',
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.uiObjects.push(counter);

    // Footer panel — covers VIEW_BOTTOM..GAME_HEIGHT.
    const footerBg = this.add.graphics();
    footerBg.fillStyle(theme.menuBgColor, 1);
    footerBg.fillRect(0, VIEW_BOTTOM + 2, GAME_WIDTH, GAME_HEIGHT - VIEW_BOTTOM - 2);
    footerBg.setDepth(10);
    this.uiObjects.push(footerBg);

    this.scrollbar = this.add.graphics().setDepth(9);
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
    backBtn.setDepth(11);
    this.uiObjects.push(backBtn);

    const viewH = VIEW_BOTTOM - VIEW_TOP;
    this.listCam = this.cameras.add(0, VIEW_TOP, GAME_WIDTH, viewH);
    // Keep the sub-camera transparent — `setBackgroundColor(0)` was painting
    // an opaque BLACK rectangle over the viewport, hiding the main camera's
    // theme menuBgColor. Default is transparent; just make it explicit.
    this.listCam.transparent = true;
    this.cameras.main.ignore(this.listContainer);
    this.listCam.ignore(this.uiObjects);

    const totalH = ACHIEVEMENTS.length * ROW_H;
    this.maxScroll = Math.max(0, totalH - viewH);

    this.drawScrollbar(viewH, totalH);
    this.bindScrollInput(viewH, totalH);
  }

  private makeCard(
    a: (typeof ACHIEVEMENTS)[number],
    y: number,
    h: number,
    unlocked: boolean,
    progress: number,
  ): void {
    const theme = themeManager.getSelected();
    const cardW = GAME_WIDTH - 40;
    const x = GAME_WIDTH / 2;
    const left = x - cardW / 2;
    const accentHex = `#${theme.accentColor.toString(16).padStart(6, '0')}`;

    // ─── Card body — gradient uses the active theme's sky for unlocked,
    //     dark neutrals for locked (matches ThemesScene card treatment). ──
    const card = this.add.graphics();
    const topColor = unlocked ? theme.skyColor : 0x2a2a3a;
    const botColor = unlocked ? this.darken(theme.skyColor, 0.55) : 0x12131e;
    card.fillGradientStyle(topColor, topColor, botColor, botColor, 1);
    card.fillRoundedRect(left, y, cardW, h, CARD_R);
    const borderColor = unlocked ? theme.accentColor : 0x444455;
    card.lineStyle(unlocked ? 2 : 1, borderColor, unlocked ? 0.9 : 0.5);
    card.strokeRoundedRect(left, y, cardW, h, CARD_R);
    this.listContainer.add(card);

    // ─── Left vertical accent stripe ───────────────────────────────────
    const stripe = this.add.graphics();
    stripe.fillStyle(unlocked ? theme.accentColor : 0x444455, unlocked ? 0.85 : 0.4);
    stripe.fillRoundedRect(left + 4, y + 4, 5, h - 8, 3);
    this.listContainer.add(stripe);

    // ─── Achievement icon (left, with subtle glow when unlocked) ───────
    const iconX = left + CARD_PAD + 24;
    const iconY = y + h / 2;
    if (unlocked) {
      const glow = this.add.graphics();
      glow.fillStyle(theme.accentColor, 0.18);
      glow.fillCircle(iconX, iconY, 24);
      this.listContainer.add(glow);
    }
    const icon = this.add
      .text(iconX, iconY, a.icon, {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: '28px',
        color: unlocked ? accentHex : '#666666',
      })
      .setOrigin(0.5)
      .setAlpha(unlocked ? 1 : 0.55);
    this.listContainer.add(icon);

    // ─── Title + description (right of icon) ───────────────────────────
    const textCol = iconX + 32;
    const textW = cardW - (textCol - left) - CARD_PAD - 50;
    // Title — stroke keeps it legible over light theme sky gradients.
    const titleText = this.add
      .text(textCol, y + 16, t(`achievements.items.${a.id}.title`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: unlocked ? '#ffffff' : '#888888',
        stroke: '#000',
        strokeThickness: 3,
        wordWrap: { width: textW },
      })
      .setOrigin(0, 0);
    this.listContainer.add(titleText);

    const descText = this.add
      .text(textCol, y + 36, t(`achievements.items.${a.id}.desc`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: unlocked ? '#ffffff' : '#777777',
        stroke: '#000',
        strokeThickness: 2,
        wordWrap: { width: textW },
        lineSpacing: 2,
      })
      .setOrigin(0, 0)
      .setAlpha(0.92);
    this.listContainer.add(descText);

    // ─── Top-right circular badge (matches ThemesScene) ────────────────
    const badgeCx = left + cardW - 22;
    const badgeCy = y + 22;
    if (unlocked) {
      const ring = this.add.graphics();
      ring.fillStyle(0x81b29a, 1);
      ring.fillCircle(badgeCx, badgeCy, 13);
      ring.lineStyle(2, 0xffffff, 0.85);
      ring.strokeCircle(badgeCx, badgeCy, 13);
      const check = this.add
        .text(badgeCx, badgeCy, '✓', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.listContainer.add([ring, check]);
    } else {
      const lockIcon = this.add
        .text(badgeCx, badgeCy, '🔒', {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '16px',
          color: '#888888',
        })
        .setOrigin(0.5);
      this.listContainer.add(lockIcon);
    }

    // ─── Progress bar (only when locked) — label sits INLINE to the
    //     right of the bar instead of below it so the whole row clears
    //     the card bottom with ~14px breathing room. ────────────────────
    if (!unlocked) {
      const ratio = Math.min(1, progress / a.target);
      const labelW = 56;
      const barX = textCol;
      const barH = 8;
      const barW = textW - labelW - 8;
      const barY = y + h - 22;
      const track = this.add.graphics();
      track.fillStyle(0x000000, 0.45);
      track.fillRoundedRect(barX, barY, barW, barH, 4);
      const fill = this.add.graphics();
      fill.fillStyle(theme.accentColor, 0.9);
      fill.fillRoundedRect(barX, barY, Math.max(2, barW * ratio), barH, 4);
      const progLabel = this.add
        .text(
          barX + barW + 8,
          barY + barH / 2,
          `${Math.min(progress, a.target)} / ${a.target}`,
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '11px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 2,
          },
        )
        .setOrigin(0, 0.5);
      this.listContainer.add([track, fill, progLabel]);
    }
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

  private darken(color: number, amt: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amt));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amt));
    const b = Math.max(0, (color & 0xff) * (1 - amt));
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
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
