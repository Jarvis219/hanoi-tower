import Phaser from 'phaser';
import { ATLAS_FRAMES, SPRITE_SHEET_KEY } from '../config/atlas';
import type { AtlasFrameKey } from '../config/atlas';

type ReleaseHandler = (d: FallingDebris) => void;

export class FallingDebris extends Phaser.GameObjects.Container {
  private rect?: Phaser.GameObjects.Rectangle;
  private img?: Phaser.GameObjects.Image;
  private fadeTween?: Phaser.Tweens.Tween;
  private readonly onRelease?: ReleaseHandler;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    spriteKey?: AtlasFrameKey,
    onRelease?: ReleaseHandler,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.onRelease = onRelease;
    this.setSize(width, height);

    if (spriteKey && scene.textures.exists(SPRITE_SHEET_KEY) && ATLAS_FRAMES[spriteKey]) {
      this.img = scene.add.image(0, 0, SPRITE_SHEET_KEY, spriteKey);
      this.img.setDisplaySize(width, height);
      this.add(this.img);
    } else {
      this.rect = scene.add.rectangle(0, 0, width, height, color);
      this.rect.setStrokeStyle(2, 0x000000, 0.3);
      this.add(this.rect);
    }

    scene.physics.add.existing(this);
    this.applyKinematics();
    this.scheduleFade();
  }

  private applyKinematics(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setVelocity(Phaser.Math.Between(-40, 40), 0);
    body.setAngularVelocity(Phaser.Math.Between(-180, 180));
  }

  private scheduleFade(): void {
    this.fadeTween = this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 900,
      delay: 200,
      onComplete: () => {
        if (this.onRelease) {
          this.onRelease(this);
        } else {
          this.destroyForGood();
        }
      },
    });
  }

  /** Re-use this instance for a new debris burst (called by pool). */
  public reset(x: number, y: number, width: number, height: number, color: number): void {
    this.fadeTween?.stop();
    this.setActive(true);
    this.setVisible(true);
    this.setPosition(x, y);
    this.setAlpha(1);
    this.angle = 0;
    this.setSize(width, height);
    if (this.rect) {
      this.rect.setSize(width, height);
      this.rect.setFillStyle(color);
    }
    if (this.img) {
      this.img.setDisplaySize(width, height);
    }
    if (this.body) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.reset(x, y);
      body.setSize(width, height);
    }
    this.applyKinematics();
    this.scheduleFade();
  }

  /** Permanently free the GPU/CPU resources (used when pool overflows). */
  public destroyForGood(): void {
    this.fadeTween?.stop();
    this.destroy();
  }
}
