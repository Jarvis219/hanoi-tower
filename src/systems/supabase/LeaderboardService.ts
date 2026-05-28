import type {
  LeaderboardPeriod,
  SubmitScorePayload,
  SubmitScoreResult,
} from '../../types/Cloud';
import type { GameMode } from '../../types/SaveData';
import { ALL_TIME_BUCKET, todayBucket, weekBucket } from '../../utils/dateBuckets';
import { authManager } from './AuthManager';
import { supabase, supabaseEnabled } from './SupabaseClient';

interface LeaderboardRpcRow {
  user_id: string;
  score: number;
  level: number;
  achieved_at: string;
  display_name: string;
  photo_url: string | null;
  country: string | null;
  rank: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = 'lb-cache:';
const TOP_LIMIT = 100;

interface CachedBoard {
  entries: LeaderboardRow[];
  myRank?: number;
  fetchedAt: number;
}

export interface LeaderboardRow {
  uid: string;
  rank: number;
  score: number;
  level: number;
  displayName: string;
  photoURL?: string;
  country?: string;
  achievedAtIso?: string;
  isSelf: boolean;
}

const periodBucket = (period: LeaderboardPeriod): string =>
  period === 'alltime' ? ALL_TIME_BUCKET : period === 'daily' ? todayBucket() : weekBucket();

const cacheKey = (mode: GameMode, period: LeaderboardPeriod): string =>
  `${CACHE_PREFIX}${mode}:${period}:${periodBucket(period)}`;

const readCache = (key: string): CachedBoard | null => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBoard;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: CachedBoard): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // session full, skip
  }
};

const toRow = (data: LeaderboardRpcRow, selfUid: string | null): LeaderboardRow => ({
  uid: data.user_id,
  rank: data.rank,
  score: data.score,
  level: data.level,
  displayName: data.display_name,
  photoURL: data.photo_url ?? undefined,
  country: data.country ?? undefined,
  achievedAtIso: data.achieved_at,
  isSelf: data.user_id === selfUid,
});

export const leaderboardService = {
  async fetchTop(
    mode: GameMode,
    period: LeaderboardPeriod,
    options: { force?: boolean } = {},
  ): Promise<{ rows: LeaderboardRow[]; myRank?: number; cached: boolean }> {
    if (!supabaseEnabled || !supabase) {
      return { rows: [], cached: false };
    }
    const key = cacheKey(mode, period);
    if (!options.force) {
      const c = readCache(key);
      if (c) return { rows: c.entries, myRank: c.myRank, cached: true };
    }

    const selfUid = authManager.currentUid;
    const bucket = periodBucket(period);

    // get_leaderboard is a SECURITY DEFINER RPC that JOINs leaderboard_entries
    // with profiles, so the display_name we see is always whatever the user
    // currently has — no stale denormalized snapshots when they rename.
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_mode: mode,
      p_period: period,
      p_bucket: bucket,
      p_limit: TOP_LIMIT,
    });
    if (error) {
      console.warn('[Leaderboard] fetchTop failed:', error.message);
      return { rows: [], cached: false };
    }

    const rows = ((data as LeaderboardRpcRow[]) ?? []).map((d) => toRow(d, selfUid));
    let myRank: number | undefined;
    const selfRow = rows.find((r) => r.isSelf);
    if (selfRow) {
      myRank = selfRow.rank;
    } else if (selfUid) {
      const { data: rankData } = await supabase.rpc('get_my_rank', {
        p_mode: mode,
        p_period: period,
        p_bucket: bucket,
      });
      if (typeof rankData === 'number') myRank = rankData;
    }

    writeCache(key, { entries: rows, myRank, fetchedAt: Date.now() });
    return { rows, myRank, cached: false };
  },

  async submitScore(payload: SubmitScorePayload): Promise<SubmitScoreResult> {
    if (!supabaseEnabled || !supabase) {
      return { ok: false, newPersonalBest: false, reason: 'offline' };
    }
    if (!authManager.currentUid) {
      return { ok: false, newPersonalBest: false, reason: 'not-signed-in' };
    }
    const { data, error } = await supabase.rpc('submit_score', {
      p_score: payload.score,
      p_level: payload.level,
      p_mode: payload.mode,
      p_run_duration_ms: payload.runDurationMs,
      p_perfects: payload.perfects,
    });
    if (error) {
      return { ok: false, newPersonalBest: false, reason: error.message };
    }
    this.invalidate(payload.mode);
    return data as SubmitScoreResult;
  },

  invalidate(mode?: GameMode): void {
    try {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(CACHE_PREFIX));
      for (const k of keys) {
        if (!mode || k.includes(`:${mode}:`)) sessionStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  },
};
