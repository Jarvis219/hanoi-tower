import type { AchievementRow, DailyResultRow, ProfileRow } from '../../types/Cloud';
import type { AchievementState, DailyResult, SaveDataV1 } from '../../types/SaveData';
import { saveManager, type SaveChangeReason } from '../SaveManager';
import { authManager } from './AuthManager';
import { supabase, supabaseEnabled } from './SupabaseClient';

// Long debounce: during a play session the player triggers many save
// mutations (perfect drops, combo bumps, theme/setting toggles). Without
// coalescing aggressively, we'd burst-call Supabase every couple of seconds.
// 15s is long enough to fold most in-game noise into a single push; game-over
// and visibility-change events bypass it via explicit flush.
const PUSH_DEBOUNCE_MS = 15_000;
// Minimum gap between actual pushes (additional throttle for bursts that
// arrive while a push was in flight).
const MIN_PUSH_INTERVAL_MS = 10_000;

interface PendingPush {
  profile: boolean;
  achievements: Set<string>;
  dailyResults: Set<string>;
}

const emptyPending = (): PendingPush => ({
  profile: false,
  achievements: new Set(),
  dailyResults: new Set(),
});

class CloudSyncManager {
  private started = false;
  private pending = emptyPending();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPushAt = 0;
  private pushInFlight = false;

  public async start(): Promise<void> {
    if (this.started || !supabaseEnabled || !supabase) return;
    this.started = true;

    // Listen to local mutations immediately so anything that happens during pull is queued.
    saveManager.onAnyChange((_, reason) => this.queuePush(reason));

    // Ship pending data when the player switches tabs / closes the app so we
    // don't lose mutations that haven't reached the 15s debounce window yet.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.hasPending()) this.flushNow();
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.hasPending()) this.flushNow();
      });
      window.addEventListener('pagehide', () => {
        if (this.hasPending()) this.flushNow();
      });
    }

    const uid = await this.waitForUid();
    if (!uid) return;
    await this.pullAndMerge(uid);
    if (this.hasPending()) this.flushNow();
  }

  private async waitForUid(timeoutMs = 5000): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (authManager.currentUid) return authManager.currentUid;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  private hasPending(): boolean {
    return (
      this.pending.profile ||
      this.pending.achievements.size > 0 ||
      this.pending.dailyResults.size > 0
    );
  }

  private queuePush(reason: SaveChangeReason): void {
    if (!supabaseEnabled || !supabase) return;
    if (reason === 'cloud') return;
    const snap = saveManager.snapshot();
    if (reason === 'achievement') {
      Object.keys(snap.achievements).forEach((id) => this.pending.achievements.add(id));
    }
    if (reason === 'run') {
      this.pending.profile = true;
      snap.dailyResults.forEach((r) => this.pending.dailyResults.add(r.date));
    } else {
      this.pending.profile = true;
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flushNow(), PUSH_DEBOUNCE_MS);
  }

  private flushNow(force = false): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pushInFlight) return; // a push is already running; pending merges in
    if (!force) {
      const sinceLast = Date.now() - this.lastPushAt;
      if (sinceLast < MIN_PUSH_INTERVAL_MS && this.lastPushAt > 0) {
        // Wait the remaining cool-down before pushing.
        this.timer = setTimeout(() => this.flushNow(), MIN_PUSH_INTERVAL_MS - sinceLast);
        return;
      }
    }
    void this.push();
  }

  private async push(): Promise<void> {
    const uid = authManager.currentUid;
    if (!uid || !supabase) return;
    if (this.pushInFlight) return;
    this.pushInFlight = true;
    const pending = this.pending;
    this.pending = emptyPending();
    const snap = saveManager.snapshot();
    const tasks: Promise<unknown>[] = [];

    if (pending.profile) tasks.push(this.pushProfile(uid, snap));
    if (pending.achievements.size > 0) {
      const rows = Array.from(pending.achievements)
        .map((id) => this.buildAchievementRow(uid, id, snap.achievements[id]))
        .filter((r): r is AchievementRow => r !== null);
      if (rows.length > 0) {
        tasks.push(
          Promise.resolve(supabase.from('achievements').upsert(rows)).then((res) => {
            if (res.error)
              console.warn('[CloudSync] achievements upsert error:', res.error.message);
          }),
        );
      }
    }
    if (pending.dailyResults.size > 0) {
      const rows = Array.from(pending.dailyResults)
        .map((date) =>
          this.buildDailyResultRow(
            uid,
            snap.dailyResults.find((r) => r.date === date),
          ),
        )
        .filter((r): r is DailyResultRow => r !== null);
      if (rows.length > 0) {
        tasks.push(
          Promise.resolve(supabase.from('daily_results').upsert(rows)).then((res) => {
            if (res.error)
              console.warn('[CloudSync] daily_results upsert error:', res.error.message);
          }),
        );
      }
    }

    try {
      await Promise.allSettled(tasks);
      this.lastPushAt = Date.now();
    } catch (err) {
      console.warn('[CloudSync] push failed:', err);
    } finally {
      this.pushInFlight = false;
      // If new mutations arrived while pushing, schedule the next flush.
      if (this.hasPending()) this.schedule();
    }
  }

  private async pushProfile(uid: string, snap: Readonly<SaveDataV1>): Promise<void> {
    if (!supabase) return;
    const row: Partial<ProfileRow> = {
      user_id: uid,
      display_name: authManager.displayName,
      photo_url: authManager.currentUser?.user_metadata?.avatar_url ?? null,
      linked_google: authManager.isGoogleLinked,
      language: snap.language,
      selected_theme: snap.selectedTheme,
      tutorial_done: snap.tutorialDone,
      high_score: snap.highScore,
      high_level: snap.highLevel,
      bgm_volume: snap.bgmVolume,
      sfx_volume: snap.sfxVolume,
      haptic_enabled: snap.hapticEnabled,
      last_seen_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) console.warn('[CloudSync] profile upsert error:', error.message);
  }

  private buildAchievementRow(
    uid: string,
    id: string,
    state: AchievementState | undefined,
  ): AchievementRow | null {
    if (!state) return null;
    return {
      user_id: uid,
      achievement_id: id,
      unlocked: state.unlocked,
      progress: state.progress,
      unlocked_at: state.unlockedAt ? new Date(state.unlockedAt).toISOString() : null,
    };
  }

  private buildDailyResultRow(uid: string, row: DailyResult | undefined): DailyResultRow | null {
    if (!row) return null;
    return {
      user_id: uid,
      date: row.date,
      score: row.score,
      level: row.level,
      played_at: new Date().toISOString(),
    };
  }

  private async pullAndMerge(uid: string): Promise<void> {
    if (!supabase) return;
    const [profileRes, achievementsRes, dailyRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('achievements').select('*').eq('user_id', uid),
      supabase.from('daily_results').select('*').eq('user_id', uid),
    ]);

    const local = saveManager.snapshot();
    const merged: Partial<SaveDataV1> = {};

    const remoteProfile = profileRes.data as ProfileRow | null;
    if (remoteProfile) {
      merged.highScore = Math.max(local.highScore, remoteProfile.high_score);
      merged.highLevel = Math.max(local.highLevel, remoteProfile.high_level);
      merged.language = remoteProfile.language;
      merged.selectedTheme = remoteProfile.selected_theme;
      // OR-merge: tutorial completion is a one-way flag. Never let a stale
      // cloud `false` revert a local `true` that the player just set via
      // Skip / "Chơi ngay" before the 15s push debounce had a chance to fire.
      merged.tutorialDone = local.tutorialDone || remoteProfile.tutorial_done;
      merged.bgmVolume = remoteProfile.bgm_volume;
      merged.sfxVolume = remoteProfile.sfx_volume;
      merged.hapticEnabled = remoteProfile.haptic_enabled;
      // Restore the user-set display name. Server is source of truth; local
      // edits are pushed via setDisplayName → queuePush('settings').
      if (remoteProfile.display_name && !remoteProfile.display_name.startsWith('Player_')) {
        merged.displayName = remoteProfile.display_name;
      }
    } else {
      // First-time login — seed cloud with local state.
      await this.pushProfile(uid, local);
    }

    const remoteAchievements = (achievementsRes.data as AchievementRow[] | null) ?? [];
    const mergedAchievements: Record<string, AchievementState> = { ...local.achievements };
    for (const r of remoteAchievements) {
      const prev = mergedAchievements[r.achievement_id];
      mergedAchievements[r.achievement_id] = {
        unlocked: Boolean(prev?.unlocked || r.unlocked),
        progress: Math.max(prev?.progress ?? 0, r.progress),
        unlockedAt: prev?.unlockedAt ?? (r.unlocked_at ? r.unlocked_at.slice(0, 10) : undefined),
      };
    }
    merged.achievements = mergedAchievements;

    const remoteDaily = (dailyRes.data as DailyResultRow[] | null) ?? [];
    const byDate = new Map<string, DailyResult>();
    local.dailyResults.forEach((r) => byDate.set(r.date, r));
    for (const r of remoteDaily) {
      const prev = byDate.get(r.date);
      if (!prev || r.score > prev.score) {
        byDate.set(r.date, { date: r.date, score: r.score, level: r.level });
      }
    }
    merged.dailyResults = Array.from(byDate.values())
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-60);

    saveManager.applyCloudSnapshot(merged);
  }

  /** Force-push immediately, bypassing the debounce + min-interval cooldown.
   * Used at session boundaries (game over, tab hide, unload) to make sure
   * progress reaches the cloud instead of waiting for the next debounce. */
  public async flush(): Promise<void> {
    this.flushNow(true);
    await new Promise((r) => setTimeout(r, 50));
  }

  public get lastPushTime(): number {
    return this.lastPushAt;
  }
}

export const cloudSyncManager = new CloudSyncManager();
