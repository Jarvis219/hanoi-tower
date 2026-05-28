import Phaser from 'phaser';
import { audioManager } from '../systems/AudioManager';

export interface ButtonOptions {
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  icon?: string;
  /** Primary fill color (top of gradient). Bottom is auto-darkened ~20%. */
  bgColor: number;
  textColor?: string;
  fontSize?: number;
  disabled?: boolean;
  /** Suppress the built-in click SFX (rare — e.g., volume slider preview already plays one). */
  silent?: boolean;
  onClick: () => void;
}

const HOVER_SCALE = 1.04;
const PRESS_SCALE = 0.96;
const SHADOW_OFFSET = 4;
const CORNER_RADIUS = 12;

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
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Rectangle;
  private readonly opts: Required<Pick<ButtonOptions, 'height' | 'textColor' | 'fontSize'>> &
    ButtonOptions;
  private disabledState: boolean;

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
    this.highlight = scene.add.graphics();

    // Single Text object: icon merged into label string. Avoids layout
    // pitfalls of measuring emoji widths separately from alphabetic glyphs.
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

    // Transparent rectangle on TOP of all visuals as the click surface.
    // Container hit areas with mixed Graphics + Text children are unreliable
    // — a real GameObject with explicit size hit-tests reliably everywhere.
    this.hit = scene.add
      .rectangle(0, 0, this.opts.width, this.opts.height, 0xffffff, 0)
      .setOrigin(0.5);

    this.add([this.shadow, this.bg, this.highlight, this.labelText, this.hit]);
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

    this.shadow.clear();
    this.shadow.fillStyle(0x000000, 0.35);
    this.shadow.fillRoundedRect(-half.x, -half.y + SHADOW_OFFSET, w, h, CORNER_RADIUS);

    this.bg.clear();
    this.bg.fillGradientStyle(
      lighten(this.opts.bgColor, 0.12),
      lighten(this.opts.bgColor, 0.12),
      darken(this.opts.bgColor, 0.18),
      darken(this.opts.bgColor, 0.18),
      1,
    );
    this.bg.fillRoundedRect(-half.x, -half.y, w, h, CORNER_RADIUS);
    this.bg.lineStyle(2, darken(this.opts.bgColor, 0.4), 1);
    this.bg.strokeRoundedRect(-half.x, -half.y, w, h, CORNER_RADIUS);

    // Top inner highlight (gives it a glassy feel)
    this.highlight.clear();
    this.highlight.fillStyle(0xffffff, 0.18);
    this.highlight.fillRoundedRect(-half.x + 3, -half.y + 3, w - 6, h * 0.42, {
      tl: CORNER_RADIUS - 3,
      tr: CORNER_RADIUS - 3,
      bl: 0,
      br: 0,
    });
  }

  private onHover(isOver: boolean): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: isOver ? HOVER_SCALE : 1,
      duration: 120,
      ease: 'Sine.easeOut',
    });
    if (isOver) {
      this.scene.game.canvas.style.cursor = 'pointer';
    } else {
      this.scene.game.canvas.style.cursor = '';
    }
  }

  private onPress(isDown: boolean): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: isDown ? PRESS_SCALE : HOVER_SCALE,
      duration: 80,
      ease: 'Sine.easeOut',
    });
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
  neutral: 0x3d405b, // dark blue — menu / back
  danger: 0xa83232, // red — quit / reset
  muted: 0x555555, // grey — disabled / locked
} as const;
