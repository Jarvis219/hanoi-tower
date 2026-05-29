import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { ATLAS_FRAMES, SPRITE_SHEET_KEY } from '../config/atlas';
import type { AtlasFrameKey } from '../config/atlas';
import { themeManager } from '../systems/ThemeManager';
import type { ThemeId } from '../types/SaveData';

/**
 * Ground-level streetscape — single row of external shophouse sprites
 * (CC-BY 4.0 from 2D Pixel City Pack + CC-BY 3.0 from coffeeshopstuff)
 * plus a far-distant theme-tinted skyline silhouette behind everything.
 *
 * Constraint: the tower blocks (homes.png MID_BLOCK_KEYS) used to mix in
 * here too — that made the background read as duplicates of what the
 * player was stacking. Dropped entirely; street uses ONLY external shops.
 *
 * Layers (back → front):
 *   1. Distant skyline silhouette, parallax 0.45, tinted pastel
 *   2. Single building row at ground level, parallax 0.9
 *   3. Asphalt + pavement + dashes, parallax 0.95
 *   4. Sparse street props (lamps, plants), parallax 0.95
 */

const SHOP_KEYS = [
  'shop_brick_1',
  'shop_brick_2',
  'shop_yellow_1',
  'shop_yellow_2',
  'shop_teahouse',
  'shop_cafe',
] as const;
type ShopKey = (typeof SHOP_KEYS)[number];

const STREET_PROPS: AtlasFrameKey[] = [
  'decor_street_lamp',
  'decor_potted_plant',
  'decor_red_lantern',
  'decor_gas_red',
];

const ROAD_COLOR = 0x222428;
const PAVEMENT_COLOR = 0x4a4d54;

/**
 * Per-theme distant-skyline texture key + tint. Each variant uses a different
 * silhouette shape and color matching the theme's palette. Textures are
 * pre-generated CC0-derived PNGs in public/assets/images/buildings/.
 */
const SKYLINE_BY_THEME: Record<ThemeId, { key: string; tint: number; scale: number }> = {
  hanoi: { key: 'skyline_hanoi', tint: 0x5e4e78, scale: 0.55 },
  hue: { key: 'skyline_hue', tint: 0x6f5b9c, scale: 0.55 },
  danang: { key: 'skyline_danang', tint: 0x3c788c, scale: 0.55 },
  saigon: { key: 'skyline_saigon', tint: 0xa05a64, scale: 0.55 },
};

export class Streetscape {
  private readonly scene: Phaser.Scene;
  private readonly props: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, groundY: number) {
    this.scene = scene;
    if (!scene.textures.exists(SPRITE_SHEET_KEY)) return;

    this.buildSkylineFar(groundY);
    this.buildBuildingRow(groundY);
    this.buildRoad(groundY);
    this.sprinkleProps(groundY);
  }

  /** Theme-aware distant skyline — different silhouette per theme. */
  private buildSkylineFar(groundY: number): void {
    const theme = themeManager.getSelected().id;
    const variant = SKYLINE_BY_THEME[theme] ?? SKYLINE_BY_THEME.hanoi;
    if (!this.scene.textures.exists(variant.key)) return;
    const tex = this.scene.textures.get(variant.key).getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement;
    const w = tex.width * variant.scale;
    let x = -w;
    while (x < GAME_WIDTH + w) {
      const img = this.scene.add
        .image(x, groundY - 8, variant.key)
        .setOrigin(0, 1)
        .setScale(variant.scale)
        .setDepth(-820)
        .setScrollFactor(0.45, 0.45)
        .setAlpha(0.55)
        .setTint(variant.tint);
      this.props.push(img);
      x += w - 1;
    }
  }

  /** Pick the next shop — never repeat the immediately previous one. */
  private pickNext(prev?: ShopKey): ShopKey {
    let pick = SHOP_KEYS[Phaser.Math.Between(0, SHOP_KEYS.length - 1)]!;
    if (prev && prev === pick) {
      pick = SHOP_KEYS[(SHOP_KEYS.indexOf(pick) + 1) % SHOP_KEYS.length]!;
    }
    return pick;
  }

  private renderShop(x: number, baseY: number, key: ShopKey): number {
    if (!this.scene.textures.exists(key)) return 60;
    const scale = 0.7 * Phaser.Math.FloatBetween(0.95, 1.05);
    const img = this.scene.add
      .image(x, baseY, key)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(-812)
      .setScrollFactor(0.9, 0.9);
    this.props.push(img);
    return img.displayWidth;
  }

  private buildBuildingRow(groundY: number): void {
    const rowY = groundY + 22;
    let x = -10;
    let safety = 50;
    let prev: ShopKey | undefined;
    while (x < GAME_WIDTH + 10 && safety-- > 0) {
      const pick = this.pickNext(prev);
      const w = this.renderShop(x + 0, rowY, pick);
      x += w + Phaser.Math.Between(2, 10); // small visible gap between buildings
      prev = pick;
    }
  }

  private buildRoad(groundY: number): void {
    const road = this.scene.add
      .rectangle(GAME_WIDTH / 2, groundY + 80, GAME_WIDTH * 1.4, 90, ROAD_COLOR)
      .setDepth(-805)
      .setScrollFactor(0.95, 0.95);
    const pavement = this.scene.add
      .rectangle(GAME_WIDTH / 2, groundY + 28, GAME_WIDTH * 1.4, 12, PAVEMENT_COLOR)
      .setDepth(-807)
      .setScrollFactor(0.95, 0.95);
    for (let dx = -GAME_WIDTH * 0.6; dx < GAME_WIDTH * 1.6; dx += 40) {
      const dash = this.scene.add
        .rectangle(GAME_WIDTH / 2 + dx, groundY + 80, 18, 3, 0xfff0c8, 0.6)
        .setDepth(-806)
        .setScrollFactor(0.95, 0.95);
      this.props.push(dash);
    }
    this.props.push(road, pavement);
  }

  private sprinkleProps(groundY: number): void {
    const rowY = groundY + 22;
    const slots = 5;
    const spacing = GAME_WIDTH / slots;
    for (let i = 0; i < slots; i += 1) {
      if (Math.random() < 0.5) continue;
      const key = STREET_PROPS[Phaser.Math.Between(0, STREET_PROPS.length - 1)]!;
      if (!ATLAS_FRAMES[key]) continue;
      const x = spacing * (i + 0.5) + Phaser.Math.Between(-10, 10);
      const img = this.scene.add
        .image(x, rowY, SPRITE_SHEET_KEY, key)
        .setOrigin(0.5, 1)
        .setScale(Phaser.Math.FloatBetween(0.5, 0.75))
        .setDepth(-810)
        .setScrollFactor(0.93, 0.93);
      this.props.push(img);
    }
  }

  public destroy(): void {
    for (const p of this.props) p.destroy();
    this.props.length = 0;
  }
}
