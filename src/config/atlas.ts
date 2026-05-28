/**
 * Sprite atlas — manually curated coordinates pointing into `sprites-2.png`.
 * Generated/verified via `scripts/preview_atlas.py`.
 * To re-verify after sheet swap: run that script and inspect `_atlas_preview.png`.
 */

export const SPRITE_SHEET_KEY = 'sprites';
export const SPRITE_SHEET_PATH = 'assets/images/sprites/sprites-2.png';

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
  'block_mid_5',
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
