import Phaser from 'phaser';
import { ATLAS_FRAMES, SPRITE_SHEET_KEY } from '../config/atlas';
import type { AtlasFrameKey } from '../config/atlas';
import type { PowerUpType } from '../config/Tuning';

export const BlockState = {
  Swinging: 'swinging',
  Falling: 'falling',
  Settled: 'settled',
} as const;
export type BlockState = (typeof BlockState)[keyof typeof BlockState];

export interface BlockOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Atlas frame key for the sprite face. */
  spriteKey: AtlasFrameKey;
  /** Fallback fill color when the sprite hasn't loaded. */
  color?: number;
  /** Optional power-up that triggers when this block lands. */
  powerUp?: PowerUpType | null;
}

const POWERUP_BADGE: Record<PowerUpType, { icon: string; color: string }> = {
  wide: { icon: '↔', color: '#81b29a' },
  slow: { icon: '⏱', color: '#5dade2' },
  magnet: { icon: '★', color: '#f2cc8f' },
  heal: { icon: '♥', color: '#e07a5f' },
};

/**
 * A block in the tower. Visually it's a sprite cropped/scaled to fit the
 * logical width × height; the underlying physics body is a plain rectangle
 * sized to those same dimensions so collision math (sliceBlock) stays
 * pixel-accurate.
 */
export class Block extends Phaser.GameObjects.Container {
  public state: BlockState = BlockState.Swinging;
  public logicalWidth: number;
  public logicalHeight: number;
  public fillColor: number;
  public powerUp: PowerUpType | null;

  private sprite!: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private spriteKey: AtlasFrameKey;
  private swingTween?: Phaser.Tweens.Tween;
  private badge?: Phaser.GameObjects.Text;
  private badgePulse?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, options: BlockOptions) {
    super(scene, options.x, options.y);
    scene.add.existing(this);

    this.logicalWidth = options.width;
    this.logicalHeight = options.height;
    this.spriteKey = options.spriteKey;
    this.fillColor = options.color ?? 0xe07a5f;
    this.powerUp = options.powerUp ?? null;

    this.setSize(this.logicalWidth, this.logicalHeight);
    this.buildVisual();
    if (this.powerUp) this.buildBadge(this.powerUp);
  }

  private buildBadge(type: PowerUpType): void {
    const { icon, color } = POWERUP_BADGE[type];
    this.badge = this.scene.add
      .text(0, -this.logicalHeight / 2 - 18, icon, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add(this.badge);
    this.badgePulse = this.scene.tweens.add({
      targets: this.badge,
      scale: { from: 1, to: 1.25 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  public consumeBadge(): void {
    this.badgePulse?.stop();
    this.badge?.destroy();
    this.badge = undefined;
    this.badgePulse = undefined;
  }

  private buildVisual(): void {
    if (this.scene.textures.exists(SPRITE_SHEET_KEY) && ATLAS_FRAMES[this.spriteKey]) {
      const img = this.scene.add.image(0, 0, SPRITE_SHEET_KEY, this.spriteKey);
      img.setDisplaySize(this.logicalWidth, this.logicalHeight);
      this.sprite = img;
    } else {
      this.sprite = this.scene.add.rectangle(0, 0, this.logicalWidth, this.logicalHeight, this.fillColor);
      (this.sprite as Phaser.GameObjects.Rectangle).setStrokeStyle(2, 0x000000, 0.3);
    }
    this.add(this.sprite);
  }

  public startSwing(
    leftEdge: number,
    rightEdge: number,
    speedPxPerSec: number,
    startDir: 1 | -1 = 1,
  ): void {
    this.state = BlockState.Swinging;
    const halfWidth = this.logicalWidth / 2;
    const minX = leftEdge + halfWidth;
    const maxX = rightEdge - halfWidth;

    this.x = startDir === 1 ? minX : maxX;
    const distance = maxX - minX;
    const durationMs = (distance / speedPxPerSec) * 1000;

    this.swingTween = this.scene.tweens.add({
      targets: this,
      x: startDir === 1 ? maxX : minX,
      duration: durationMs,
      ease: 'Linear',
      yoyo: true,
      repeat: -1,
    });
  }

  public stopSwing(): void {
    this.swingTween?.stop();
    this.swingTween = undefined;
  }

  public dropWithGravity(scene: Phaser.Scene): void {
    this.state = BlockState.Falling;
    this.stopSwing();

    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.logicalWidth, this.logicalHeight);
    body.setAllowGravity(true);
    body.setVelocity(0, 0);
  }

  public settleAt(y: number): void {
    this.state = BlockState.Settled;
    if (this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setVelocity(0, 0);
      body.setImmovable(true);
    }
    this.y = y;
  }

  public resizeTo(left: number, right: number): void {
    const newWidth = right - left;
    this.logicalWidth = newWidth;
    this.setSize(newWidth, this.logicalHeight);
    this.x = (left + right) / 2;
    if (this.sprite instanceof Phaser.GameObjects.Image) {
      this.sprite.setDisplaySize(newWidth, this.logicalHeight);
    } else {
      (this.sprite as Phaser.GameObjects.Rectangle).setSize(newWidth, this.logicalHeight);
    }
    if (this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setSize(newWidth, this.logicalHeight);
    }
  }

  public get left(): number {
    return this.x - this.logicalWidth / 2;
  }

  public get right(): number {
    return this.x + this.logicalWidth / 2;
  }

  public override destroy(fromScene?: boolean): void {
    this.stopSwing();
    this.badgePulse?.stop();
    super.destroy(fromScene);
  }
}
