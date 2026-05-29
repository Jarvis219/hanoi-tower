export type GameMode = 'classic' | 'daily';

export interface LeaderboardEntry {
  score: number;
  level: number;
  date: string; // ISO yyyy-mm-dd
}

export interface AchievementState {
  unlocked: boolean;
  progress: number;
  unlockedAt?: string; // ISO date
}

export interface DailyResult {
  date: string;
  score: number;
  level: number;
}

export type ThemeId = 'hanoi' | 'hue' | 'danang' | 'saigon';

export interface SaveDataV1 {
  v: 1;
  highScore: number;
  highLevel: number;
  bgmVolume: number;
  sfxVolume: number;
  hapticEnabled: boolean;
  language: 'vi' | 'en';
  /** User-chosen display name. When undefined, falls back to OAuth name or 'Player_XXXX'. */
  displayName?: string;
  leaderboard: {
    classic: LeaderboardEntry[];
    daily: LeaderboardEntry[];
  };
  achievements: Record<string, AchievementState>;
  dailyResults: DailyResult[];
  selectedTheme: ThemeId;
  tutorialDone: boolean;
}
