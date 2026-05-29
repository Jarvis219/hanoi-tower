// Leaderboard buckets are computed in UTC on both client and server (see
// supabase/migrations/*.sql submit_score → `now() at time zone 'utc'::date`).
// If we used local time here, a VN player at 06:00 (UTC 23:00 prev day) would
// query "today" but their submission lives under yesterday's UTC bucket.

export const todayBucket = (d: Date = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/**
 * ISO 8601 week number — week 1 is the week containing the first Thursday.
 * Format: YYYY-Www (e.g. "2026-W22"). All math runs in UTC for parity with the
 * server's `to_char((now() at time zone 'utc')::date, 'IYYY"-W"IW')`.
 */
export const weekBucket = (d: Date = new Date()): string => {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // Nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekNo =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const ALL_TIME_BUCKET = 'all';
