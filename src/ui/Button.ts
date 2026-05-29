import Phaser from 'phaser';
import { audioManager } from '../systems/AudioManager';

export interface ButtonOptions {
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  icon?: string;
  /** Primary fill color. */
  bgColor: number;
  textColor?: string;
  fontSize?: number;
  disabled?: boolean;
  /** Suppress the built-in click SFX. */
  silent?: boolean;
  onClick: () => void;
}

// Pixel-art bevel button (with softened corners).
//   - 6px rounded corners — keeps the retro chunky feel but less harsh
//   - Solid fill (no gradient)
//   - Light bevel on top + left, dark bevel on bottom + right
//   - Press: bevel inverts + button sinks by SHADOW_OFFSET
//   - Hover: subtle lighten of fill (no scale — scale fights pixel-art
//     crispness at non-integer factors)
const SHADOW_OFFSET = 4;
const CORNER_RADIUS = 6;
const BEVEL = 3;

const darken = (color: number, amt = 0.22): number => {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amt));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amt));
  const b = Math.max(0, (color & 0xff) * (1 - amt));
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
};

const lighten = (color: number, amt = 0.18): number => {
  const r = Math.min(255, ((color >> 16) & 0xff) + 255 * amt);
  const g = Math.min(255, ((color >> 8) & 0xff) + 255 * amt);
  const b = Math.min(255, (color & 0xff) + 255 * amt);
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
};

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly bevels: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private readonly opts: Required<Pick<ButtonOptions, 'height' | 'textColor' | 'fontSize'>> &
    ButtonOptions;
  private disabledState: boolean;
  private isHover = false;
  private isPressed = false;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    super(scene, options.x, options.y);
    scene.add.existing(this);
    this.opts = {
      height: 52,
      textColor: '#ffffff',
      fontSize: 18,
      ...options,
    };
    this.disabledState = options.disabled ?? false;

    this.shadow = scene.add.graphics();
    this.bg = scene.add.graphics();
    this.bevels = scene.add.graphics();

    const fullLabel = options.icon ? `${options.icon}  ${options.label}` : options.label;
    this.labelText = scene.add
      .text(0, 0, fullLabel, {
        fontFamily: 'system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: `${this.opts.fontSize}px`,
        color: this.opts.textColor,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);
    this.labelText.y = -1;

    this.hit = scene.add
      .rectangle(0, 0, this.opts.width, this.opts.height, 0xffffff, 0)
      .setOrigin(0.5);

    this.add([this.shadow, this.bg, this.bevels, this.labelText, this.hit]);
    this.draw();

    this.hit.setInteractive({ useHandCursor: true });
    this.hit.on('pointerover', () => !this.disabledState && this.onHover(true));
    this.hit.on('pointerout', () => !this.disabledState && this.onHover(false));
    this.hit.on('pointerdown', () => !this.disabledState && this.onPress(true));
    this.hit.on('pointerup', () => {
      if (this.disabledState) return;
      this.onPress(false);
      if (!this.opts.silent) audioManager.playSfx('click');
      this.scene.time.delayedCall(0, () => this.opts.onClick());
    });
    this.hit.on('pointerupoutside', () => !this.disabledState && this.onPress(false));

    if (this.disabledState) this.setAlpha(0.55);
  }

  private draw(): void {
    const w = this.opts.width;
    const h = this.opts.height;
    const half = { x: w / 2, y: h / 2 };
    const fill = this.isHover && !this.isPressed
      ? lighten(this.opts.bgColor, 0.08)
      : this.opts.bgColor;
    const light = lighten(this.opts.bgColor, 0.32);
    const dark = darken(this.opts.bgColor, 0.4);
    const outline = darken(this.opts.bgColor, 0.6);

    // Hard pixel shadow — disappears when pressed.
    this.shadow.clear();
    if (!this.isPressed) {
      this.shadow.fillStyle(0x000000, 0.5);
      this.shadow.fillRoundedRect(
        -half.x + 2,
        -half.y + SHADOW_OFFSET,
        w,
        h,
        CORNER_RADIUS,
      );
    }

    // Body — solid fill + outline.
    this.bg.clear();
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(-half.x, -half.y, w, h, CORNER_RADIUS);
    this.bg.lineStyle(1, outline, 1);
    this.bg.strokeRoundedRect(-half.x, -half.y, w, h, CORNER_RADIUS);

    // Bevel bands: top+left light, bottom+right dark (inverted on press).
    // Inset by CORNER_RADIUS so bands stop short of the rounded corners
    // and don't poke out as visual artifacts.
    this.bevels.clear();
    const topLeft = this.isPressed ? dark : light;
    const bottomRight = this.isPressed ? light : dark;
    const inset = CORNER_RADIUS;
    // Top
    this.bevels.fillStyle(topLeft, 1);
    this.bevels.fillRect(-half.x + inset, -half.y + 1, w - inset * 2, BEVEL);
    // Left
    this.bevels.fillRect(-half.x + 1, -half.y + inset, BEVEL, h - inset * 2);
    // Bottom
    this.bevels.fillStyle(bottomRight, 1);
    this.bevels.fillRect(-half.x + inset, half.y - BEVEL - 1, w - inset * 2, BEVEL);
    // Right
    this.bevels.fillRect(half.x - BEVEL - 1, -half.y + inset, BEVEL, h - inset * 2);
  }

  private onHover(isOver: boolean): void {
    this.isHover = isOver;
    this.draw();
    this.scene.game.canvas.style.cursor = isOver ? 'pointer' : '';
  }

  private onPress(isDown: boolean): void {
    this.isPressed = isDown;
    this.draw();
    // Sink label content with the button so it visually pushes in.
    this.labelText.y = isDown ? SHADOW_OFFSET - 1 : -1;
  }

  public setLabel(label: string): void {
    const full = this.opts.icon ? `${this.opts.icon}  ${label}` : label;
    this.labelText.setText(full);
  }

  public setDisabled(disabled: boolean): void {
    this.disabledState = disabled;
    this.setAlpha(disabled ? 0.55 : 1);
    if (disabled) {
      this.hit.disableInteractive();
    } else {
      this.hit.setInteractive({ useHandCursor: true });
    }
  }

  public setBgColor(color: number): void {
    this.opts.bgColor = color;
    this.draw();
  }
}

export const COLOR = {
  primary: 0x81b29a, // green — primary action
  secondary: 0x5dade2, // blue — daily / share
  accent: 0xe07a5f, // orange-red — themes / restart
  highlight: 0xf2cc8f, // gold — achievements / featured
  info: 0x6c63a9, // royal purple — settings / utility
  neutral: 0x3d405b, // dark blue — back / menu (overlays)
  danger: 0xa83232, // red — quit / reset
  muted: 0x555555, // grey — disabled / locked
} as const;
