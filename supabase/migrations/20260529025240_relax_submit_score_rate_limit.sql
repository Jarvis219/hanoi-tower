-- Rewrite submit_score with a SHORTER rate-limit window. The 30-second
-- guard from the original migration was tripping legitimate fast players
-- (e.g., consecutive 5-10s runs) and surfacing as `rate_limited` 53400.
-- 10s still prevents abuse but allows tight back-to-back gameplay.

create or replace function public.submit_score(
  p_score              integer,
  p_level              integer,
  p_mode               text,
  p_run_duration_ms    integer,
  p_perfects           integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid              uuid := auth.uid();
  v_today            text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  v_week             text := to_char((now() at time zone 'utc')::date, 'IYYY"-W"IW');
  v_max_per_level    constant integer := 200;
  v_min_ms_per_level constant integer := 800;
  v_window_ms        constant integer := 10000;   -- was 30000
  v_last_at          timestamptz;
  v_rank_alltime     integer;
  v_rank_weekly      integer;
  v_rank_daily       integer;
  v_personal_best    boolean := false;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if p_mode not in ('classic','daily') then
    raise exception 'invalid_mode' using errcode = '22023';
  end if;
  if p_score < 0 or p_score > v_max_per_level * greatest(1, p_level) then
    raise exception 'implausible_score' using errcode = '22023';
  end if;
  if p_level < 0 or p_level > 99999 then
    raise exception 'implausible_level' using errcode = '22023';
  end if;
  if p_run_duration_ms < p_level * v_min_ms_per_level then
    raise exception 'run_too_short' using errcode = '22023';
  end if;
  if p_perfects < 0 or p_perfects > p_level then
    raise exception 'implausible_perfects' using errcode = '22023';
  end if;

  -- Rate limit: 1 submission per 10s.
  select last_at into v_last_at from public.rate_limits where user_id = v_uid;
  if v_last_at is not null and now() - v_last_at < (v_window_ms || ' milliseconds')::interval then
    raise exception 'rate_limited' using errcode = '53400';
  end if;
  insert into public.rate_limits(user_id, last_at)
    values (v_uid, now())
    on conflict (user_id) do update set last_at = excluded.last_at;

  if not exists(select 1 from public.profiles where user_id = v_uid) then
    insert into public.profiles(user_id, display_name)
      values (v_uid, 'Player_' || upper(substring(replace(v_uid::text, '-', ''), 1, 8)));
  end if;

  insert into public.leaderboard_entries
    (user_id, mode, period, bucket, score, level, achieved_at)
  values
    (v_uid, p_mode, 'alltime', 'all',    p_score, p_level, now()),
    (v_uid, p_mode, 'weekly',  v_week,   p_score, p_level, now()),
    (v_uid, p_mode, 'daily',   v_today,  p_score, p_level, now())
  on conflict (user_id, mode, period, bucket) do update
    set score       = excluded.score,
        level       = excluded.level,
        achieved_at = excluded.achieved_at
    where public.leaderboard_entries.score < excluded.score;

  select exists(
    select 1 from public.leaderboard_entries
     where user_id = v_uid and mode = p_mode and score = p_score
       and achieved_at >= now() - interval '5 seconds'
  ) into v_personal_best;

  update public.profiles
     set high_score   = greatest(high_score, p_score),
         high_level   = greatest(high_level, p_level),
         last_seen_at = now()
   where user_id = v_uid;

  select count(*) + 1 into v_rank_alltime
    from public.leaderboard_entries
   where mode = p_mode and period = 'alltime' and bucket = 'all'  and score > p_score;
  select count(*) + 1 into v_rank_weekly
    from public.leaderboard_entries
   where mode = p_mode and period = 'weekly'  and bucket = v_week and score > p_score;
  select count(*) + 1 into v_rank_daily
    from public.leaderboard_entries
   where mode = p_mode and period = 'daily'   and bucket = v_today and score > p_score;

  return json_build_object(
    'ok', true,
    'newPersonalBest', v_personal_best,
    'rank', json_build_object(
      'alltime', v_rank_alltime,
      'weekly',  v_rank_weekly,
      'daily',   v_rank_daily
    )
  );
end;
$$;
