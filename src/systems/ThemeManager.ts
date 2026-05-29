import { DEV_UNLOCK_ALL } from '../config/DevFlags';
import type { ThemeId } from '../types/SaveData';
import { saveManager } from './SaveManager';

/**
 * Theme metadata. `name` and `description` are i18n lookup keys
 * (`themes.<id>` and `themes.desc.<id>`) — resolve via `t()` at render time.
 */
export interface ThemeDef {
  id: ThemeId;
  unlockAtLevel: number;
  /** Sky color for GameScene gradient origin (bright). */
  skyColor: number;
  /** Dark theme-tinted background for menu/overlay scenes (keeps text readable). */
  menuBgColor: number;
  /** Bright accent color for titles, borders, highlights. */
  accentColor: number;
  /** Optional global tint applied to mid blocks (RGB hex). */
  blockTint?: number;
  /** Optional BGM key — currently same for all themes; future Sprint can swap. */
  bgmKey?: string;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  hanoi: {
    id: 'hanoi',
    unlockAtLevel: 0,
    skyColor: 0x87ceeb, // sky blue
    menuBgColor: 0x141a2e, // deep navy with blue undertone
    accentColor: 0xf2cc8f, // warm gold
  },
  hue: {
    id: 'hue',
    unlockAtLevel: 50,
    skyColor: 0x6f5b9c, // royal purple
    menuBgColor: 0x1a1430, // deep indigo
    accentColor: 0xc9a8ff, // pale lavender
    blockTint: 0xd9c8ff,
  },
  danang: {
    id: 'danang',
    unlockAtLevel: 100,
    skyColor: 0x6cc3d1, // coastal turquoise
    menuBgColor: 0x0f2530, // deep teal-navy
    accentColor: 0x7adef0, // bright cyan
    blockTint: 0xc8eef7,
  },
  saigon: {
    id: 'saigon',
    unlockAtLevel: 150,
    skyColor: 0xff8c69, // sunset orange
    menuBgColor: 0x2a1620, // very dark crimson
    accentColor: 0xff9d6b, // warm coral
    blockTint: 0xffd9a0,
  },
};

export const THEME_ORDER: readonly ThemeId[] = ['hanoi', 'hue', 'danang', 'saigon'] as const;

class ThemeManagerImpl {
  public isUnlocked(id: ThemeId): boolean {
    if (DEV_UNLOCK_ALL) return true;
    return saveManager.highLevel >= THEMES[id].unlockAtLevel;
  }

  public getSelected(): ThemeDef {
    const id = saveManager.selectedTheme;
    if (this.isUnlocked(id)) return THEMES[id];
    return THEMES.hanoi;
  }

  public select(id: ThemeId): boolean {
    if (!this.isUnlocked(id)) return false;
    saveManager.setSelectedTheme(id);
    return true;
  }

  public listAll(): ThemeDef[] {
    return THEME_ORDER.map((id) => THEMES[id]);
  }

  /** Convenience: hex string ("#rrggbb") for the accent — handy for Phaser text styles. */
  public accentHex(): string {
    return `#${this.getSelected().accentColor.toString(16).padStart(6, '0')}`;
  }
}

export const themeManager = new ThemeManagerImpl();
