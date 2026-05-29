import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';
import { ATLAS_FRAMES, MID_BLOCK_KEYS, SPRITE_SHEET_KEY } from '../config/atlas';
import type { AtlasFrameKey } from '../config/atlas';
import { themeManager } from '../systems/ThemeManager';
import type { ThemeId } from '../types/SaveData';

/**
 * Ground-level streetscape — single row that mixes external shophouse
 * sprites (CC-BY 4.0 from 2D Pixel City Pack) with atlas tube-house
 * blocks, plus a far-distant skyline silhouette behind everything.
 *
 * Constraints learned the hard way:
 *   - NEVER setFlipX on atlas blocks — they carry painted text
 *     ("COFFEE 1888", "TẠP HÓA 24H"…) that becomes unreadable mirrored.
 *   - Only ONE building row; multiple overlapping rows hide the variety.
 *   - Spacing weighted so big external shophouses (CLUB / yellow awning)
 *     show up regularly — those are the freshest sprites.
 *
 * Layers (back → front):
 *   1. Distant skyline silhouette, parallax 0.45, tinted pastel
 *   2. Single building row at ground level, parallax 0.9
 *   3. Asphalt + pavement + dashes, parallax 0.95
 *   4. Sparse street props (lamps, plants), parallax 0.95
 */

type BuildingKind =
  | { source: 'external'; key: 'shop_brick_1' | 'shop_brick_2' | 'shop_yellow_1' | 'shop_yellow_2' }
  | { source: 'atlas'; key: AtlasFrameKey; stories: 1 | 2 };

const TINT_PALETTE = [
  0xffffff, 0xf3c884, 0xe6a574, 0xb9d6e6, 0xc8e6cd, 0xefc8d6, 0xd9d2b5,
] as const;

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

  /** Pick the next building in the row — weighted to favor variety. */
  private pickNext(prev?: BuildingKind): BuildingKind {
    // ~50/50 external vs atlas, but never two identical in a row.
    const useExternal = Math.random() < 0.55;
    if (useExternal) {
      const candidates = [
        'shop_brick_1',
        'shop_brick_2',
        'shop_yellow_1',
        'shop_yellow_2',
      ] as const;
      let pick = candidates[Phaser.Math.Between(0, candidates.length - 1)]!;
      if (prev?.source === 'external' && prev.key === pick) {
        pick = candidates[(candidates.indexOf(pick) + 1) % candidates.length]!;
      }
      return { source: 'external', key: pick };
    }
    let key = MID_BLOCK_KEYS[Phaser.Math.Between(0, MID_BLOCK_KEYS.length - 1)]!;
    if (prev?.source === 'atlas' && prev.key === key) {
      key = MID_BLOCK_KEYS[(MID_BLOCK_KEYS.indexOf(key) + 1) % MID_BLOCK_KEYS.length]!;
    }
    const stories: 1 | 2 = Math.random() < 0.55 ? 2 : 1;
    return { source: 'atlas', key, stories };
  }

  private renderExternal(
    x: number,
    baseY: number,
    key: 'shop_brick_1' | 'shop_brick_2' | 'shop_yellow_1' | 'shop_yellow_2',
  ): number {
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

  private renderAtlas(x: number, baseY: number, key: AtlasFrameKey, stories: 1 | 2): number {
    const scale = 0.7 * Phaser.Math.FloatBetween(0.95, 1.05);
    const tint = TINT_PALETTE[Phaser.Math.Between(0, TINT_PALETTE.length - 1)] ?? 0xffffff;
    const frameH = ATLAS_FRAMES[key].h * scale;
    let yCursor = baseY;
    let widest = 0;
    for (let i = 0; i < stories; i += 1) {
      const img = this.scene.add
        .image(x, yCursor, SPRITE_SHEET_KEY, key)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(-812)
        .setScrollFactor(0.9, 0.9)
        .setTint(tint);
      // No setFlipX — text on facade must stay readable.
      this.props.push(img);
      if (img.displayWidth > widest) widest = img.displayWidth;
      yCursor -= frameH * 0.98;
    }
    return widest;
  }

  private buildBuildingRow(groundY: number): void {
    const rowY = groundY + 22;
    let x = -10;
    let safety = 50;
    let prev: BuildingKind | undefined;
    while (x < GAME_WIDTH + 10 && safety-- > 0) {
      const plan = this.pickNext(prev);
      const w =
        plan.source === 'external'
          ? this.renderExternal(x + 0, rowY, plan.key)
          : this.renderAtlas(x + 0, rowY, plan.key, plan.stories);
      x += w + Phaser.Math.Between(2, 10); // small visible gap between buildings
      prev = plan;
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
