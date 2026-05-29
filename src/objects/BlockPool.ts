import Phaser from 'phaser';
import { FallingDebris } from './FallingDebris';

/**
 * Simple object pool for FallingDebris. Block instances are kept alive for
 * the duration of a run (they form the visible tower), so pooling them is
 * unnecessary — but debris spawn 0..2× per second and fade out, making
 * them the highest churn objects worth recycling.
 */
export class DebrisPool {
  private readonly scene: Phaser.Scene;
  private readonly pool: FallingDebris[] = [];
  private readonly maxSize: number;

  constructor(scene: Phaser.Scene, maxSize = 24) {
    this.scene = scene;
    this.maxSize = maxSize;
  }

  public spawn(x: number, y: number, width: number, height: number, color: number): FallingDebris {
    const reused = this.pool.pop();
    if (reused) {
      reused.reset(x, y, width, height, color);
      return reused;
    }
    return new FallingDebris(this.scene, x, y, width, height, color, undefined, (d) =>
      this.release(d),
    );
  }

  private release(debris: FallingDebris): void {
    if (this.pool.length >= this.maxSize) {
      debris.destroyForGood();
      return;
    }
    this.pool.push(debris);
  }

  public clear(): void {
    for (const d of this.pool) d.destroyForGood();
    this.pool.length = 0;
  }
}
