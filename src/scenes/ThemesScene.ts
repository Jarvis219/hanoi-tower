import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { t } from '../systems/I18nManager';
import { saveManager } from '../systems/SaveManager';
import { themeManager, THEMES, THEME_ORDER } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';
import type { ThemeId } from '../types/SaveData';

const VIEW_TOP = 80;
const VIEW_BOTTOM = GAME_HEIGHT - 80;
const CARD_H = 150;
const CARD_GAP = 14;

export class ThemesScene extends Phaser.Scene {
  private listContainer!: Phaser.GameObjects.Container;
  private scrollPos = 0;
  private maxScroll = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragging = false;
  private scrollbar!: Phaser.GameObjects.Graphics;
  private scrollbarFadeTimer?: Phaser.Time.TimerEvent;

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

    // Build all cards inside a translatable container — content y starts at 0
    // (local coords). We translate the container.y by -scrollPos and clip the
    // visible area with a rectangular geometry mask between VIEW_TOP / VIEW_BOTTOM.
    this.listContainer = this.add.container(0, VIEW_TOP);
    THEME_ORDER.forEach((id, i) => {
      this.makeCard(id, i * (CARD_H + CARD_GAP), CARD_H);
    });

    const viewH = VIEW_BOTTOM - VIEW_TOP;
    const totalH = THEME_ORDER.length * CARD_H + (THEME_ORDER.length - 1) * CARD_GAP;
    this.maxScroll = Math.max(0, totalH - viewH);

    // Mask: rectangle covering VIEW_TOP..VIEW_BOTTOM clips card render to viewport.
    const maskGfx = this.make.graphics({ x: 0, y: 0 }, false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(0, VIEW_TOP, GAME_WIDTH, viewH);
    this.listContainer.setMask(maskGfx.createGeometryMask());

    this.scrollbar = this.add.graphics();

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

    this.drawScrollbar(viewH, totalH);
    this.bindScrollInput(viewH, totalH);
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
    this.listContainer.add(card);

    // Tag chip at top-right
    const tagLabel = selected ? t('themes.selected') : unlocked ? '' : '🔒';
    if (tagLabel) {
      const tagBg = selected ? 0x81b29a : 0x555555;
      const chip = this.add.graphics();
      chip.fillStyle(tagBg, 1);
      chip.fillRoundedRect(x + cardW / 2 - 110, y + 10, 100, 26, 8);
      const chipText = this.add
        .text(x + cardW / 2 - 60, y + 23, tagLabel, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.listContainer.add([chip, chipText]);
    }

    // Theme name
    const nameText = this.add
      .text(x - cardW / 2 + 20, y + 22, t(`themes.${id}`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: unlocked ? '#ffffff' : '#888888',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0, 0);
    this.listContainer.add(nameText);

    // Description
    const descText = this.add
      .text(x - cardW / 2 + 20, y + 60, t(`themes.desc.${id}`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: unlocked ? '#ffffff' : '#777777',
        wordWrap: { width: cardW - 40 },
      })
      .setOrigin(0, 0)
      .setAlpha(0.92);
    this.listContainer.add(descText);

    // Bottom row — either Select button or lock requirement
    if (!unlocked) {
      const lockText = this.add
        .text(x - cardW / 2 + 20, y + h - 28, t('themes.locked', { level: theme.unlockAtLevel }), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          color: '#aaaaaa',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5);
      this.listContainer.add(lockText);
    } else if (!selected) {
      const btn = new Button(this, {
        x: x + cardW / 2 - 70,
        y: y + h - 22,
        width: 110,
        height: 32,
        label: t('themes.select'),
        fontSize: 12,
        bgColor: COLOR.primary,
        onClick: () => this.onSelect(id),
      });
      this.listContainer.add(btn);
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
    if (this.maxScroll === 0) return;

    const inView = (y: number): boolean => y >= VIEW_TOP && y <= VIEW_BOTTOM;

    const refresh = (): void => {
      // Container starts at VIEW_TOP; translate up by scrollPos to scroll.
      this.listContainer.y = VIEW_TOP - this.scrollPos;
      this.drawScrollbar(viewH, totalH);
      this.flashScrollbar();
    };

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!inView(pointer.y)) return;
      this.dragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollPos;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const delta = pointer.y - this.dragStartY;
      this.scrollPos = Phaser.Math.Clamp(this.dragStartScroll - delta, 0, this.maxScroll);
      refresh();
    });
    const releaseDrag = (): void => {
      this.dragging = false;
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
