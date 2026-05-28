import type {
  AchievementState,
  DailyResult,
  LeaderboardEntry,
  SaveDataV1,
  ThemeId,
} from '../types/SaveData';

const STORAGE_KEY = 'thap-ha-noi.save';
const LEADERBOARD_MAX = 10;

const DEFAULT_SAVE: SaveDataV1 = {
  v: 1,
  highScore: 0,
  highLevel: 0,
  bgmVolume: 0.5,
  sfxVolume: 0.8,
  hapticEnabled: true,
  language: 'vi',
  leaderboard: { classic: [], daily: [] },
  achievements: {},
  dailyResults: [],
  selectedTheme: 'hanoi',
  tutorialDone: false,
};

const isoDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const sortDesc = (a: LeaderboardEntry, b: LeaderboardEntry): number => b.score - a.score;

export type SaveChangeReason =
  | 'settings'
  | 'run'
  | 'achievement'
  | 'theme'
  | 'tutorial'
  | 'cloud';

type ChangeListener = (data: Readonly<SaveDataV1>, reason: SaveChangeReason) => void;

export class SaveManager {
  private data: SaveDataV1;
  private listeners = new Set<ChangeListener>();
  private quiet = false;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveDataV1 {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw) as Partial<SaveDataV1>;
      return { ...structuredClone(DEFAULT_SAVE), ...parsed, v: 1 };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  private flush(reason: SaveChangeReason = 'settings'): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable — fail silently.
    }
    if (!this.quiet) {
      this.listeners.forEach((cb) => {
        try {
          cb(this.data, reason);
        } catch (err) {
          console.warn('[SaveManager] listener threw:', err);
        }
      });
    }
  }

  /** Subscribe to mutations. Returns an unsubscribe fn. */
  public onAnyChange(cb: ChangeListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Apply a snapshot from the cloud without re-broadcasting (avoids feedback loop
   * back to CloudSyncManager). Used only by CloudSyncManager on first pull or
   * when a remote write lands while the tab is open.
   */
  public applyCloudSnapshot(patch: Partial<SaveDataV1>): void {
    this.quiet = true;
    try {
      this.data = { ...this.data, ...patch, v: 1 };
      this.flush('cloud');
    } finally {
      this.quiet = false;
    }
  }

  public snapshot(): Readonly<SaveDataV1> {
    return this.data;
  }

  // ── Audio / haptic / language ─────────────────────────────────────
  public get highScore(): number {
    return this.data.highScore;
  }
  public get highLevel(): number {
    return this.data.highLevel;
  }
  public get bgmVolume(): number {
    return this.data.bgmVolume;
  }
  public get sfxVolume(): number {
    return this.data.sfxVolume;
  }
  public get hapticEnabled(): boolean {
    return this.data.hapticEnabled;
  }
  public get language(): 'vi' | 'en' {
    return this.data.language;
  }
  public get selectedTheme(): ThemeId {
    return this.data.selectedTheme;
  }
  public get tutorialDone(): boolean {
    return this.data.tutorialDone;
  }
  public get displayName(): string | undefined {
    return this.data.displayName;
  }

  public setBgmVolume(v: number): void {
    this.data.bgmVolume = Math.max(0, Math.min(1, v));
    this.flush();
  }
  public setSfxVolume(v: number): void {
    this.data.sfxVolume = Math.max(0, Math.min(1, v));
    this.flush();
  }
  public setHapticEnabled(v: boolean): void {
    this.data.hapticEnabled = v;
    this.flush();
  }
  public setLanguage(lang: 'vi' | 'en'): void {
    this.data.language = lang;
    this.flush();
  }
  public setDisplayName(name: string): void {
    const trimmed = name.trim();
    this.data.displayName = trimmed.length > 0 ? trimmed : undefined;
    this.flush('settings');
  }
  public setSelectedTheme(t: ThemeId): void {
    this.data.selectedTheme = t;
    this.flush('theme');
  }
  public markTutorialDone(): void {
    this.data.tutorialDone = true;
    this.flush('tutorial');
  }

  // ── Run records / leaderboard ────────────────────────────────────
  public recordRun(
    score: number,
    level: number,
    mode: 'classic' | 'daily',
  ): { newHighScore: boolean; newHighLevel: boolean } {
    let newHighScore = false;
    let newHighLevel = false;
    if (score > this.data.highScore) {
      this.data.highScore = score;
      newHighScore = true;
    }
    if (level > this.data.highLevel) {
      this.data.highLevel = level;
      newHighLevel = true;
    }

    const entry: LeaderboardEntry = { score, level, date: isoDate() };
    const board = this.data.leaderboard[mode];
    board.push(entry);
    board.sort(sortDesc);
    board.splice(LEADERBOARD_MAX);

    if (mode === 'daily') {
      const today = isoDate();
      const prev = this.data.dailyResults.find((r) => r.date === today);
      if (prev) {
        if (score > prev.score) {
          prev.score = score;
          prev.level = level;
        }
      } else {
        this.data.dailyResults.push({ date: today, score, level });
        // Trim to last 60 days to bound storage.
        this.data.dailyResults.splice(0, Math.max(0, this.data.dailyResults.length - 60));
      }
    }

    this.flush('run');
    return { newHighScore, newHighLevel };
  }

  public getLeaderboard(mode: 'classic' | 'daily'): LeaderboardEntry[] {
    return [...this.data.leaderboard[mode]];
  }

  public hasPlayedDaily(date: string = isoDate()): DailyResult | undefined {
    return this.data.dailyResults.find((r) => r.date === date);
  }

  // ── Achievements ─────────────────────────────────────────────────
  public getAchievement(id: string): AchievementState {
    return this.data.achievements[id] ?? { unlocked: false, progress: 0 };
  }

  public allAchievements(): Record<string, AchievementState> {
    return { ...this.data.achievements };
  }

  /** Returns true if this call newly unlocked the achievement. */
  public updateAchievement(id: string, patch: Partial<AchievementState>): boolean {
    const prev = this.getAchievement(id);
    const wasUnlocked = prev.unlocked;
    const next: AchievementState = { ...prev, ...patch };
    if (next.unlocked && !wasUnlocked) {
      next.unlockedAt = isoDate();
    }
    this.data.achievements[id] = next;
    this.flush('achievement');
    return next.unlocked && !wasUnlocked;
  }
}

export const saveManager = new SaveManager();
