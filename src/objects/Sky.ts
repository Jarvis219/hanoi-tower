import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';

/**
 * Procedural altitude-driven sky with real cloud/sun/moon sprites
 * (Kenney CC0 background-elements pack). The gradient never tiles — it's
 * always a single fill interpolated from altitude bands. Decorations are
 * placed at fixed world coords across the climb so the camera reveals them
 * naturally as the tower rises.
 */

interface SkyBand {
  altitude: number;
  top: number;
  bottom: number;
}

const BANDS: SkyBand[] = [
  { altitude: 0, top: 0xfcd6b0, bottom: 0xffe7c2 }, // Dawn — warm peach
  { altitude: 250, top: 0x87ceeb, bottom: 0xcde6f5 }, // Morning — sky blue
  { altitude: 800, top: 0x4a8fc4, bottom: 0x7fb3d4 }, // Afternoon — saturated blue
  { altitude: 1600, top: 0xff8c69, bottom: 0xffc99c }, // Sunset — orange
  { altitude: 2400, top: 0x6f5b9c, bottom: 0xa48cc8 }, // Dusk — purple
  { altitude: 3600, top: 0x1a1a3a, bottom: 0x3d3d6a }, // Night
  { altitude: 6000, top: 0x000010, bottom: 0x05051a }, // Deep night
  { altitude: 10000, top: 0x000000, bottom: 0x000005 }, // Space
];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpColor = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return (r << 16) | (g << 8) | bl;
};

const bandColorsForAltitude = (alt: number): { top: number; bottom: number } => {
  if (alt <= BANDS[0]!.altitude) return { top: BANDS[0]!.top, bottom: BANDS[0]!.bottom };
  const last = BANDS[BANDS.length - 1]!;
  if (alt >= last.altitude) return { top: last.top, bottom: last.bottom };
  for (let i = 0; i < BANDS.length - 1; i += 1) {
    const a = BANDS[i]!;
    const b = BANDS[i + 1]!;
    if (alt >= a.altitude && alt < b.altitude) {
      const t = (alt - a.altitude) / (b.altitude - a.altitude);
      return {
        top: lerpColor(a.top, b.top, t),
        bottom: lerpColor(a.bottom, b.bottom, t),
      };
    }
  }
  return { top: last.top, bottom: last.bottom };
};

export class Sky {
  private readonly scene: Phaser.Scene;
  private readonly gradient: Phaser.GameObjects.Graphics;
  private readonly decorations: Phaser.GameObjects.GameObject[] = [];
  private readonly drifters: Phaser.GameObjects.Image[] = [];
  private currentTop = 0;
  private currentBottom = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.gradient = scene.add.graphics();
    this.gradient.setScrollFactor(0).setDepth(-1000);
    this.drawGradient(BANDS[0]!.top, BANDS[0]!.bottom);

    this.spawnCelestials();
    this.spawnClouds();
    this.spawnStars();
  }

  /** Sun rises through low altitude, moon dominates high altitude. */
  private spawnCelestials(): void {
    if (this.scene.textures.exists('sun')) {
      const sun = this.scene.add
        .image(GAME_WIDTH - 80, -300, 'sun')
        .setDepth(-980)
        .setScale(0.7)
        .setScrollFactor(0.3, 0.3)
        .setAlpha(0.92);
      this.decorations.push(sun);
    }
    if (this.scene.textures.exists('moon_full')) {
      const moon = this.scene.add
        .image(80, -3200, 'moon_full')
        .setDepth(-980)
        .setScale(0.9)
        .setScrollFactor(0.3, 0.3);
      this.decorations.push(moon);
    }
    if (this.scene.textures.exists('moon_half')) {
      const moon2 = this.scene.add
        .image(GAME_WIDTH - 100, -5200, 'moon_half')
        .setDepth(-980)
        .setScale(0.7)
        .setScrollFactor(0.3, 0.3);
      this.decorations.push(moon2);
    }
  }

  /** Soft cloud silhouettes scattered through low–mid altitudes, drifting slowly. */
  private spawnClouds(): void {
    const variants = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 22; i += 1) {
      const variant = variants[Phaser.Math.Between(0, variants.length - 1)] ?? 1;
      const key = `cloud_${variant}`;
      if (!this.scene.textures.exists(key)) continue;
      const alt = 80 + i * 120 + Phaser.Math.Between(-50, 50); // 80..2700
      const worldY = -alt;
      const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
      const cloud = this.scene.add
        .image(x, worldY, key)
        .setDepth(-900)
        .setScale(Phaser.Math.FloatBetween(0.5, 1.0))
        .setAlpha(Phaser.Math.FloatBetween(0.7, 0.95))
        .setScrollFactor(0.55, 0.55);
      this.decorations.push(cloud);
      this.drifters.push(cloud);
      // Slow horizontal drift — never reaches edges, just gives "alive" feel.
      this.scene.tweens.add({
        targets: cloud,
        x: x + Phaser.Math.Between(-40, 40),
        duration: Phaser.Math.Between(8000, 14000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Tiny twinkling star dots, only visible at high altitude. */
  private spawnStars(): void {
    for (let i = 0; i < 90; i += 1) {
      const alt = 2400 + i * 85 + Phaser.Math.Between(-30, 30);
      const worldY = -alt;
      const x = Phaser.Math.Between(4, GAME_WIDTH - 4);
      const r = Phaser.Math.Between(0, 100) < 15 ? 2 : 1;
      const star = this.scene.add
        .circle(x, worldY, r, 0xffffff, Phaser.Math.FloatBetween(0.5, 1))
        .setDepth(-950);
      this.decorations.push(star);
    }
  }

  public update(scrollY: number): void {
    const altitude = Math.max(0, -scrollY);
    const colors = bandColorsForAltitude(altitude);
    if (colors.top !== this.currentTop || colors.bottom !== this.currentBottom) {
      this.drawGradient(colors.top, colors.bottom);
      this.currentTop = colors.top;
      this.currentBottom = colors.bottom;
    }
  }

  private drawGradient(top: number, bottom: number): void {
    this.gradient.clear();
    this.gradient.fillGradientStyle(top, top, bottom, bottom, 1);
    this.gradient.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  public destroy(): void {
    this.gradient.destroy();
    for (const d of this.decorations) (d as Phaser.GameObjects.GameObject).destroy();
    this.decorations.length = 0;
    this.drifters.length = 0;
  }
}
