import type { LeaderboardPeriod, SubmitScorePayload, SubmitScoreResult } from '../../types/Cloud';
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
// Mirrors the server-side rate_limits window (10s in current migration). We
// skip the network call entirely when we know it'd be rejected — saves a
// roundtrip + avoids surfacing "rate_limited" to the user.
const CLIENT_RATE_WINDOW_MS = 10_000;
// Track per-mode best already-submitted score so we don't re-submit a worse
// or equal score (the server upsert wouldn't write it anyway).
const SUBMITTED_PREFIX = 'lb-submitted:';
const LAST_SUBMIT_AT_KEY = 'lb-last-submit-at';

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

    // Skip if the local best for this mode is already higher — server upsert
    // would no-op since `score < excluded.score` in submit_score.
    const submittedKey = `${SUBMITTED_PREFIX}${payload.mode}`;
    const prevBest = Number(localStorage.getItem(submittedKey) ?? 0);
    if (payload.score <= prevBest) {
      return { ok: true, newPersonalBest: false, reason: 'skipped-not-best' };
    }

    // Skip if we just submitted within the server rate-limit window. The RPC
    // would return `rate_limited` 53400 — no point calling it.
    const lastAt = Number(localStorage.getItem(LAST_SUBMIT_AT_KEY) ?? 0);
    if (Date.now() - lastAt < CLIENT_RATE_WINDOW_MS) {
      return { ok: false, newPersonalBest: false, reason: 'rate_limited_local' };
    }

    const { data, error } = await supabase.rpc('submit_score', {
      p_score: payload.score,
      p_level: payload.level,
      p_mode: payload.mode,
      p_run_duration_ms: payload.runDurationMs,
      p_perfects: payload.perfects,
    });
    if (error) {
      // Server-side rate limit hit (race vs our local check). Cache the
      // timestamp so subsequent calls in the window short-circuit before
      // hitting the network.
      if (error.message?.includes('rate_limited')) {
        try {
          localStorage.setItem(LAST_SUBMIT_AT_KEY, String(Date.now()));
        } catch {
          // ignore
        }
      }
      return { ok: false, newPersonalBest: false, reason: error.message };
    }

    // Persist success so future submits of equal/lower scores don't fire.
    try {
      localStorage.setItem(submittedKey, String(payload.score));
      localStorage.setItem(LAST_SUBMIT_AT_KEY, String(Date.now()));
    } catch {
      // ignore quota errors
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
