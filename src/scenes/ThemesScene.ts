import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { HOME_SHEET_KEY, resolveBlockSprite } from '../config/atlas';
import { t } from '../systems/I18nManager';
import { saveManager } from '../systems/SaveManager';
import { themeManager, THEMES, THEME_ORDER } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';
import type { ThemeId } from '../types/SaveData';

const VIEW_TOP = 80;
const VIEW_BOTTOM = GAME_HEIGHT - 80;
const CARD_H = 180;
const CARD_GAP = 16;
const CARD_PAD = 14;
const PREVIEW_W = 110;
const PREVIEW_BLOCK_H = 36;

// Icon hint per theme — quick visual cue at top-right.
const THEME_ICON: Record<ThemeId, string> = {
  hanoi: '☀',
  hue: '🏯',
  danang: '🌊',
  saigon: '🌃',
};

// Which 3 building rows to stack in the mini preview tower. Keeps it
// visually distinct per theme (foundation sign + apartment + top floor).
const PREVIEW_KEYS = ['block_foundation', 'block_mid_2', 'block_mid_1'] as const;

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

    // Cards first → they sit at the bottom of the z-stack so the header
    // bar + title (added later) reliably paint on top even if mask clipping
    // glitches on a future Phaser update.
    this.listContainer = this.add.container(0, VIEW_TOP);
    THEME_ORDER.forEach((id, i) => {
      this.makeCard(id, i * (CARD_H + CARD_GAP), CARD_H);
    });

    const viewH = VIEW_BOTTOM - VIEW_TOP;
    const totalH = THEME_ORDER.length * CARD_H + (THEME_ORDER.length - 1) * CARD_GAP;
    this.maxScroll = Math.max(0, totalH - viewH);

    const maskGfx = this.make.graphics({ x: 0, y: 0 }, false);
    maskGfx.fillStyle(0xffffff, 1);
    maskGfx.fillRect(0, VIEW_TOP, GAME_WIDTH, viewH);
    this.listContainer.setMask(maskGfx.createGeometryMask());

    // Solid header bar — paints over the top strip 0..VIEW_TOP so scrolled
    // cards can never visually bleed into the title area, regardless of
    // mask edge cases.
    const headerBg = this.add.graphics();
    headerBg.fillStyle(currentTheme.menuBgColor, 1);
    headerBg.fillRect(0, 0, GAME_WIDTH, VIEW_TOP - 2);
    // Thin accent divider line right under the title.
    headerBg.fillStyle(themeManager.getSelected().accentColor, 0.55);
    headerBg.fillRect(20, VIEW_TOP - 2, GAME_WIDTH - 40, 1);
    headerBg.setDepth(10);

    // Title last — added after the header bar so it renders on top of it.
    this.add
      .text(GAME_WIDTH / 2, 36, t('themes.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(11);

    this.scrollbar = this.add.graphics().setDepth(9);

    // Footer bar — symmetric to header so cards can't leak below the
    // viewport into the back-button area.
    const footerBg = this.add.graphics();
    footerBg.fillStyle(currentTheme.menuBgColor, 1);
    footerBg.fillRect(0, VIEW_BOTTOM + 2, GAME_WIDTH, GAME_HEIGHT - VIEW_BOTTOM - 2);
    footerBg.setDepth(10);

    const backBtn = new Button(this, {
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
    backBtn.setDepth(11);

    this.drawScrollbar(viewH, totalH);
    this.bindScrollInput(viewH, totalH);
  }

  private makeCard(id: ThemeId, y: number, h: number): void {
    const theme = THEMES[id];
    const unlocked = themeManager.isUnlocked(id);
    const selected = saveManager.selectedTheme === id && unlocked;
    const cardW = GAME_WIDTH - 40;
    const x = GAME_WIDTH / 2;
    const left = x - cardW / 2;
    const accentHex = `#${theme.accentColor.toString(16).padStart(6, '0')}`;

    // ─── Card body: rounded gradient + 3px outline ─────────────────────
    const card = this.add.graphics();
    const bgTop = unlocked ? theme.skyColor : 0x2a2a3a;
    const bgBot = unlocked ? this.darken(theme.skyColor, 0.55) : 0x12131e;
    card.fillGradientStyle(bgTop, bgTop, bgBot, bgBot, 1);
    card.fillRoundedRect(left, y, cardW, h, 16);
    // Border: animated gold if selected, accent if unlocked, grey if locked
    const borderColor = selected ? 0x81b29a : unlocked ? theme.accentColor : 0x555555;
    card.lineStyle(selected ? 4 : 2, borderColor, 1);
    card.strokeRoundedRect(left, y, cardW, h, 16);
    this.listContainer.add(card);

    // ─── Left vertical accent stripe ───────────────────────────────────
    const stripe = this.add.graphics();
    stripe.fillStyle(theme.accentColor, unlocked ? 0.85 : 0.35);
    stripe.fillRoundedRect(left + 4, y + 4, 5, h - 8, 3);
    this.listContainer.add(stripe);

    // ─── Tower preview (3 stacked floors from this theme) ──────────────
    this.makeTowerPreview(id, left + CARD_PAD + 12, y + CARD_PAD, unlocked);

    // ─── Top-right circular badge ──────────────────────────────────────
    // Three states share the same slot:
    //   selected → green ✓ medallion (replaces theme icon)
    //   unlocked → theme emoji on transparent bg
    //   locked   → 🔒 emoji (dimmed)
    const badgeCx = left + cardW - 22;
    const badgeCy = y + 22;
    if (selected) {
      const ring = this.add.graphics();
      ring.fillStyle(0x81b29a, 1);
      ring.fillCircle(badgeCx, badgeCy, 14);
      ring.lineStyle(2, 0xffffff, 0.85);
      ring.strokeCircle(badgeCx, badgeCy, 14);
      const check = this.add
        .text(badgeCx, badgeCy, '✓', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.listContainer.add([ring, check]);
    } else {
      const iconText = this.add
        .text(badgeCx, badgeCy, unlocked ? THEME_ICON[id] : '🔒', {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '22px',
          color: unlocked ? '#ffffff' : '#666666',
        })
        .setOrigin(0.5);
      this.listContainer.add(iconText);
    }

    // ─── Theme name + description (right column) ───────────────────────
    const textCol = left + PREVIEW_W + CARD_PAD * 2;
    const textW = cardW - PREVIEW_W - CARD_PAD * 3 - 12;

    const nameText = this.add
      .text(textCol, y + 18, t(`themes.${id}`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: unlocked ? accentHex : '#888888',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0, 0);
    this.listContainer.add(nameText);

    const descText = this.add
      .text(textCol, y + 58, t(`themes.desc.${id}`), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: unlocked ? '#dddddd' : '#777777',
        wordWrap: { width: textW },
        lineSpacing: 2,
      })
      .setOrigin(0, 0)
      .setAlpha(0.92);
    this.listContainer.add(descText);

    // ─── Bottom row: progress bar (locked) or Select button (unlocked) ─
    if (!unlocked) {
      const current = saveManager.highLevel;
      const target = theme.unlockAtLevel;
      const progress = Math.min(1, current / target);
      const barX = textCol;
      const barW = textW;
      const barY = y + h - 32;
      const barH = 8;

      // Track
      const track = this.add.graphics();
      track.fillStyle(0x000000, 0.45);
      track.fillRoundedRect(barX, barY, barW, barH, 4);
      // Fill
      const fill = this.add.graphics();
      fill.fillStyle(theme.accentColor, 0.85);
      fill.fillRoundedRect(barX, barY, Math.max(2, barW * progress), barH, 4);

      const lockLabel = this.add
        .text(barX, barY - 6, `🔒 ${t('themes.locked', { level: target })}`, {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '11px',
          color: '#bbbbbb',
          fontStyle: 'bold',
        })
        .setOrigin(0, 1);
      const progLabel = this.add
        .text(barX + barW, barY + barH + 2, `${current} / ${target}`, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '10px',
          color: '#cccccc',
        })
        .setOrigin(1, 0);
      this.listContainer.add([track, fill, lockLabel, progLabel]);
    } else if (!selected) {
      const btn = new Button(this, {
        x: textCol + textW - 55,
        y: y + h - 22,
        width: 110,
        height: 34,
        label: t('themes.select'),
        fontSize: 13,
        bgColor: COLOR.primary,
        onClick: () => this.onSelect(id),
      });
      this.listContainer.add(btn);
    }
  }

  /** Mini 3-floor tower preview using the actual homes.png frames for this
   *  theme — instant visual cue of what blocks the player gets. */
  private makeTowerPreview(id: ThemeId, x: number, y: number, unlocked: boolean): void {
    if (!this.textures.exists(HOME_SHEET_KEY)) return;
    const blockW = PREVIEW_W - 24;
    let cursorY = y + 12 + PREVIEW_BLOCK_H * PREVIEW_KEYS.length;

    // Soft platform shadow under the tower
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35);
    shadow.fillEllipse(x + PREVIEW_W / 2 - 6, cursorY + 4, blockW + 18, 8);
    this.listContainer.add(shadow);

    for (let i = 0; i < PREVIEW_KEYS.length; i += 1) {
      const baseKey = PREVIEW_KEYS[i]!;
      const resolved = resolveBlockSprite(baseKey, id);
      // Each successive floor a hair narrower → tapered preview
      const w = blockW - i * 6;
      cursorY -= PREVIEW_BLOCK_H + 1;
      const img = this.add
        .image(x + PREVIEW_W / 2 - 6, cursorY, resolved.textureKey, resolved.frameKey)
        .setOrigin(0.5, 0)
        .setDisplaySize(w, PREVIEW_BLOCK_H);
      if (!unlocked) img.setAlpha(0.45).setTint(0x666666);
      this.listContainer.add(img);
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
