import type { GameMode, ThemeId } from './SaveData';

export interface ProfileRow {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  country: string | null;
  linked_google: boolean;
  language: 'vi' | 'en';
  selected_theme: ThemeId;
  tutorial_done: boolean;
  high_score: number;
  high_level: number;
  bgm_volume: number;
  sfx_volume: number;
  haptic_enabled: boolean;
  created_at: string;
  last_seen_at: string;
}

export interface AchievementRow {
  user_id: string;
  achievement_id: string;
  unlocked: boolean;
  progress: number;
  unlocked_at: string | null;
}

export interface DailyResultRow {
  user_id: string;
  date: string;
  score: number;
  level: number;
  played_at: string;
}

/**
 * Raw row in `public.leaderboard_entries`. Identity fields only — display_name
 * / photo_url / country live on the `profiles` table and are fetched via the
 * `get_leaderboard` RPC at read time (see LeaderboardService).
 */
export interface LeaderboardEntryRow {
  user_id: string;
  mode: GameMode;
  period: LeaderboardPeriod;
  bucket: string;
  score: number;
  level: number;
  achieved_at: string;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'alltime';

export interface SubmitScorePayload {
  score: number;
  level: number;
  mode: GameMode;
  runDurationMs: number;
  perfects: number;
}

export interface SubmitScoreResult {
  ok: boolean;
  newPersonalBest: boolean;
  rank?: { alltime: number; weekly: number; daily: number };
  reason?: string;
}
