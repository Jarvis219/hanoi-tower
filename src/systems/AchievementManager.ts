import { DEV_UNLOCK_ALL } from '../config/DevFlags';
import type { AchievementState } from '../types/SaveData';
import { saveManager } from './SaveManager';

export type AchievementCategory = 'milestone' | 'skill' | 'collection' | 'daily';

/**
 * Achievement metadata. `title` and `description` are LOOKUP KEYS into
 * `achievements.items.<id>.{title,desc}` of the i18n bundle — never raw
 * display strings. Resolve them via `t()` at render time.
 */
export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  icon: string;
  /** Target progress to trigger unlock. */
  target: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Milestones ─────────────────────────────────────────────────────
  { id: 'tower_10', category: 'milestone', icon: '🏠', target: 10 },
  { id: 'tower_25', category: 'milestone', icon: '🏘', target: 25 },
  { id: 'tower_50', category: 'milestone', icon: '🏢', target: 50 },
  { id: 'tower_100', category: 'milestone', icon: '🗼', target: 100 },
  { id: 'tower_200', category: 'milestone', icon: '🚀', target: 200 },
  { id: 'score_1k', category: 'milestone', icon: '⭐', target: 1000 },
  { id: 'score_5k', category: 'milestone', icon: '💎', target: 5000 },
  { id: 'score_10k', category: 'milestone', icon: '👑', target: 10000 },

  // ── Skill ──────────────────────────────────────────────────────────
  { id: 'first_perfect', category: 'skill', icon: '✨', target: 1 },
  { id: 'combo_5', category: 'skill', icon: '🔥', target: 5 },
  { id: 'combo_10', category: 'skill', icon: '⚡', target: 10 },
  { id: 'combo_20', category: 'skill', icon: '🌟', target: 20 },
  { id: 'perfect_100', category: 'skill', icon: '🎯', target: 100 },

  // ── Collection ─────────────────────────────────────────────────────
  { id: 'powerup_wide', category: 'collection', icon: '↔', target: 1 },
  { id: 'powerup_slow', category: 'collection', icon: '⏱', target: 1 },
  { id: 'powerup_magnet', category: 'collection', icon: '★', target: 1 },
  { id: 'powerup_heal', category: 'collection', icon: '♥', target: 1 },

  // ── Daily ──────────────────────────────────────────────────────────
  { id: 'daily_1', category: 'daily', icon: '📅', target: 1 },
  { id: 'daily_7', category: 'daily', icon: '🗓', target: 7 },
];

export interface AchievementUnlock {
  def: AchievementDef;
  state: AchievementState;
}

class AchievementManagerImpl {
  private listeners: ((u: AchievementUnlock) => void)[] = [];

  public onUnlock(handler: (u: AchievementUnlock) => void): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  /** Bump progress by `amount` toward an achievement; unlocks at target. */
  public bump(id: string, amount = 1): void {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    const state = saveManager.getAchievement(id);
    if (state.unlocked) return;
    const nextProgress = Math.min(def.target, state.progress + amount);
    const willUnlock = nextProgress >= def.target;
    const justUnlocked = saveManager.updateAchievement(id, {
      progress: nextProgress,
      unlocked: willUnlock,
    });
    if (justUnlocked) {
      const final = saveManager.getAchievement(id);
      for (const l of this.listeners) l({ def, state: final });
    }
  }

  /** Set progress to an absolute value (for "max combo this run" style). */
  public setIfHigher(id: string, value: number): void {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    const state = saveManager.getAchievement(id);
    if (state.unlocked || value <= state.progress) return;
    const clamped = Math.min(def.target, value);
    const willUnlock = clamped >= def.target;
    const justUnlocked = saveManager.updateAchievement(id, {
      progress: clamped,
      unlocked: willUnlock,
    });
    if (justUnlocked) {
      const final = saveManager.getAchievement(id);
      for (const l of this.listeners) l({ def, state: final });
    }
  }

  public unlockedCount(): number {
    if (DEV_UNLOCK_ALL) return ACHIEVEMENTS.length;
    return ACHIEVEMENTS.filter((a) => saveManager.getAchievement(a.id).unlocked).length;
  }
}

export const achievementManager = new AchievementManagerImpl();
