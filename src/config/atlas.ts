import type { ThemeId } from '../types/SaveData';

/**
 * Sprite atlas — manually curated coordinates pointing into `sprites-2.png`.
 * Generated/verified via `scripts/preview_atlas.py`.
 * To re-verify after sheet swap: run that script and inspect `_atlas_preview.png`.
 */

export const SPRITE_SHEET_KEY = 'sprites';
export const SPRITE_SHEET_PATH = 'assets/images/sprites/sprites-2.png';

/**
 * `homes.png` — themed shophouse / apartment block art, organized as a 4×N
 * grid (4 theme columns × N row types). Used to swap the in-game tower
 * blocks based on the player's selected theme.
 *
 * Columns are NOT evenly spaced — each theme has its own x offset + width
 * (see `HOME_THEME_RECT`). Y bands use the union of opaque content across all
 * themes so Hue's taller curved roofs aren't clipped.
 */
export const HOME_SHEET_KEY = 'home';
export const HOME_SHEET_PATH = 'assets/images/sprites/homes.png';

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ATLAS_FRAMES = {
  // ── Blocks ──────────────────────────────────────────────────────────
  block_foundation: { x: 25, y: 92, w: 367, h: 148 },
  block_mid_1: { x: 423, y: 78, w: 198, h: 128 },
  block_mid_2: { x: 639, y: 78, w: 222, h: 127 },
  block_mid_3: { x: 879, y: 78, w: 192, h: 128 },
  block_mid_4: { x: 422, y: 237, w: 193, h: 125 },
  block_mid_5: { x: 636, y: 237, w: 215, h: 125 },
  block_mid_6: { x: 864, y: 237, w: 226, h: 125 }, // COFFEE 1888
  block_special: { x: 1117, y: 77, w: 290, h: 159 }, // HANOI View LED
  block_roof: { x: 47, y: 294, w: 340, h: 144 },

  // ── Parallax background layers (1 = farthest, 4 = nearest) ─────────
  // Note: auto-detector merged layers 2 and 3 because they touch with no
  // transparent gap. We split at the visual midpoint.
  bg_layer_1: { x: 24, y: 551, w: 161, h: 275 },
  bg_layer_2: { x: 196, y: 551, w: 161, h: 275 },
  bg_layer_3: { x: 357, y: 551, w: 161, h: 275 },
  bg_layer_4: { x: 530, y: 551, w: 174, h: 275 },

  // ── UI: HUD panels ──────────────────────────────────────────────────
  ui_score_panel: { x: 1058, y: 623, w: 126, h: 73 },
  ui_combo_panel: { x: 1214, y: 623, w: 110, h: 73 },
  ui_height_panel: { x: 1381, y: 623, w: 90, h: 70 },

  // ── UI: buttons ─────────────────────────────────────────────────────
  ui_btn_play: { x: 1058, y: 742, w: 129, h: 40 },
  ui_btn_replay: { x: 1200, y: 739, w: 155, h: 48 },
  ui_btn_settings: { x: 1058, y: 791, w: 129, h: 40 },
  ui_btn_menu: { x: 1201, y: 794, w: 157, h: 46 },
  ui_btn_quit: { x: 1058, y: 838, w: 129, h: 40 },
  ui_btn_pause: { x: 1404, y: 778, w: 54, h: 50 },
  ui_btn_sound_on: { x: 1274, y: 944, w: 61, h: 40 },
  ui_btn_sound_off: { x: 1358, y: 943, w: 57, h: 40 },

  // ── Particles (emit textures / impact splash) ──────────────────────
  fx_perfect_sparkle: { x: 740, y: 540, w: 215, h: 90 },
  fx_slice_debris: { x: 740, y: 660, w: 220, h: 80 },
  fx_thud_dust: { x: 755, y: 770, w: 200, h: 70 },

  // ── SFX mini-icons (used in achievement toasts / sound preview) ────
  sfx_icon_drop: { x: 38, y: 903, w: 47, h: 52 },
  sfx_icon_thud: { x: 120, y: 915, w: 50, h: 42 },
  sfx_icon_slice: { x: 189, y: 911, w: 59, h: 47 },
  sfx_icon_perfect: { x: 277, y: 902, w: 57, h: 59 },
  sfx_icon_combo: { x: 357, y: 905, w: 46, h: 51 },

  // ── Decor / props (variety pass for settled blocks) ────────────────
  decor_potted_plant: { x: 449, y: 900, w: 61, h: 90 },
  decor_gas_blue: { x: 515, y: 905, w: 50, h: 75 },
  decor_gas_red: { x: 570, y: 905, w: 50, h: 75 },
  decor_washing_machine: { x: 625, y: 905, w: 60, h: 65 },
  decor_appliance: { x: 700, y: 905, w: 60, h: 65 },
  decor_red_lantern: { x: 778, y: 905, w: 50, h: 80 },
  decor_green_box: { x: 830, y: 925, w: 55, h: 60 },
  decor_street_lamp: { x: 880, y: 895, w: 70, h: 95 },

  // ── Extra effects (overlay flairs — faint on new sheet) ────────────
  fx_camera_shake_lines: { x: 985, y: 905, w: 75, h: 60 },
  fx_speed_lines: { x: 1080, y: 910, w: 100, h: 50 },
  fx_glow: { x: 1190, y: 905, w: 80, h: 60 },
  fx_star_burst: { x: 1290, y: 905, w: 90, h: 65 },
  fx_confetti: { x: 1390, y: 905, w: 130, h: 80 },
} as const satisfies Record<string, AtlasFrame>;

export type AtlasFrameKey = keyof typeof ATLAS_FRAMES;

export const MID_BLOCK_KEYS: readonly AtlasFrameKey[] = [
  'block_mid_1',
  'block_mid_2',
  'block_mid_3',
  'block_mid_4',
  // block_mid_5 (rooftop terrace row in homes.png) intentionally dropped —
  // the visual is a terrace with sky-around props, not a stackable floor.
  'block_mid_6',
] as const;

export const PARALLAX_KEYS: readonly AtlasFrameKey[] = [
  'bg_layer_1',
  'bg_layer_2',
  'bg_layer_3',
  'bg_layer_4',
] as const;

export const DECOR_KEYS: readonly AtlasFrameKey[] = [
  'decor_potted_plant',
  'decor_gas_blue',
  'decor_gas_red',
  'decor_washing_machine',
  'decor_appliance',
  'decor_red_lantern',
  'decor_green_box',
  'decor_street_lamp',
] as const;

/**
 * Register all frames against a single loaded texture so we can use them
 * by key everywhere (`scene.add.sprite(x, y, SPRITE_SHEET_KEY, 'block_mid_1')`).
 */
export const registerAtlasFrames = (textures: Phaser.Textures.TextureManager): void => {
  const tex = textures.get(SPRITE_SHEET_KEY);
  if (!tex || tex.key === '__MISSING') {
    throw new Error(`Sprite sheet "${SPRITE_SHEET_KEY}" not loaded before frame registration`);
  }
  for (const [name, frame] of Object.entries(ATLAS_FRAMES)) {
    if (tex.has(name)) continue;
    tex.add(name, 0, frame.x, frame.y, frame.w, frame.h);
  }
};

// ────────────────────────────────────────────────────────────────────────
// Themed block frames (home.png)
// ────────────────────────────────────────────────────────────────────────

/**
 * Per-theme tight column rectangle inside homes.png — different x/width for
 * each theme since the source art doesn't use uniform column spacing.
 */
const HOME_THEME_RECT: Partial<Record<ThemeId, { x: number; w: number }>> = {
  hanoi: { x: 75, w: 189 },
  hue: { x: 299, w: 197 },
  danang: { x: 531, w: 189 },
  saigon: { x: 760, w: 198 },
};

/**
 * Y bands tight to rows where ≥20% of pixels are opaque (union across all
 * themes). Tighter than max-alpha bounds — drops the 4-5 transparent rows
 * at the top of each frame so blocks stack without sky-gap leak.
 * Missing block keys fall back to sprites-2.png.
 */
const HOME_BLOCK_ROWS: Partial<Record<AtlasFrameKey, { y: number; h: number }>> = {
  block_mid_1: { y: 57, h: 66 }, // top floor with awning roof
  block_mid_2: { y: 138, h: 65 }, // balcony with plants
  block_mid_3: { y: 219, h: 63 }, // mid floor with shutters / windows
  block_mid_4: { y: 298, h: 65 }, // red lantern / lit windows
  block_special: { y: 377, h: 60 }, // storefront with awning sign
  // Row 6 (rooftop terrace at y=461, h=37) dropped per design — the art has
  // too much transparent sky around water tanks/AC units to read as a floor.
  block_mid_6: { y: 515, h: 61 }, // secondary storefront sign
  block_foundation: { y: 590, h: 68 }, // large foundation sign
};

/**
 * Per-theme overrides. Đà Nẵng's source art has the awning-sign storefront
 * and the lantern apartment swapped relative to Hanoi/Hue/Saigon — its
 * "MI QUẢNG ĐÀ NẴNG" sign sits at the row that's an apartment in other themes.
 * Override the y/h for just those two keys so the frame names still mean
 * the same thing visually (block_special = storefront with sign).
 */
const HOME_BLOCK_ROW_OVERRIDES: Partial<
  Record<ThemeId, Partial<Record<AtlasFrameKey, { y: number; h: number }>>>
> = {
  danang: {
    block_special: { y: 298, h: 65 }, // "MI QUẢNG" storefront sign
    block_mid_4: { y: 377, h: 60 }, // red lantern apartment
  },
};

const resolveBand = (
  themeId: ThemeId,
  baseKey: AtlasFrameKey,
): { y: number; h: number } | undefined => {
  return HOME_BLOCK_ROW_OVERRIDES[themeId]?.[baseKey] ?? HOME_BLOCK_ROWS[baseKey];
};

const buildHomeFrameKey = (themeId: ThemeId, baseKey: AtlasFrameKey): string =>
  `home_${themeId}_${baseKey}`;

export const registerHomeAtlasFrames = (textures: Phaser.Textures.TextureManager): void => {
  if (!textures.exists(HOME_SHEET_KEY)) return;
  const tex = textures.get(HOME_SHEET_KEY);
  if (!tex || tex.key === '__MISSING') return;
  for (const [themeId, rect] of Object.entries(HOME_THEME_RECT) as [
    ThemeId,
    { x: number; w: number },
  ][]) {
    for (const baseKey of Object.keys(HOME_BLOCK_ROWS) as AtlasFrameKey[]) {
      const band = resolveBand(themeId, baseKey);
      if (!band) continue;
      const name = buildHomeFrameKey(themeId, baseKey);
      if (tex.has(name)) continue;
      tex.add(name, 0, rect.x, band.y, rect.w, band.h);
    }
  }
};

/**
 * Resolve the (texture, frame) pair to use for a block of `baseKey` under the
 * currently selected `themeId`. Falls back to sprites-2.png when the theme
 * has no homes.png column or the base key isn't covered.
 */
export const resolveBlockSprite = (
  baseKey: AtlasFrameKey,
  themeId: ThemeId,
): { textureKey: string; frameKey: string } => {
  if (HOME_THEME_RECT[themeId] && resolveBand(themeId, baseKey)) {
    return { textureKey: HOME_SHEET_KEY, frameKey: buildHomeFrameKey(themeId, baseKey) };
  }
  return { textureKey: SPRITE_SHEET_KEY, frameKey: baseKey };
};
