-- Stack Tower (Tháp Hà Nội) — Supabase schema.
-- Mirrors the localStorage SaveDataV1 + a global leaderboard with anti-cheat
-- via a SECURITY DEFINER submit_score function. RLS keeps users from writing
-- leaderboard rows directly.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Tables
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null,
  photo_url        text,
  country          text,
  linked_google    boolean not null default false,
  language         text not null default 'vi' check (language in ('vi','en')),
  selected_theme   text not null default 'hanoi' check (selected_theme in ('hanoi','saigon','hue')),
  tutorial_done    boolean not null default false,
  high_score       integer not null default 0 check (high_score >= 0 and high_score <= 9999999),
  high_level       integer not null default 0 check (high_level >= 0 and high_level <= 99999),
  bgm_volume       real    not null default 0.5 check (bgm_volume between 0 and 1),
  sfx_volume       real    not null default 0.8 check (sfx_volume between 0 and 1),
  haptic_enabled   boolean not null default true,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now()
);

create table if not exists public.achievements (
  user_id          uuid not null references auth.users(id) on delete cascade,
  achievement_id   text not null,
  unlocked         boolean not null default false,
  progress         integer not null default 0 check (progress >= 0),
  unlocked_at      timestamptz,
  primary key (user_id, achievement_id)
);

create table if not exists public.daily_results (
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  score    integer not null check (score >= 0),
  level    integer not null check (level >= 0),
  played_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.leaderboard_entries (
  user_id      uuid not null references auth.users(id) on delete cascade,
  mode         text not null check (mode in ('classic','daily')),
  period       text not null check (period in ('alltime','weekly','daily')),
  bucket       text not null,            -- 'all' | YYYY-MM-DD | YYYY-Www
  score        integer not null,
  level        integer not null,
  display_name text not null,
  photo_url    text,
  country      text,
  achieved_at  timestamptz not null default now(),
  primary key (user_id, mode, period, bucket)
);

-- Optimised query: top-N within (mode, period, bucket) ordered by score desc.
create index if not exists idx_leaderboard_top
  on public.leaderboard_entries (mode, period, bucket, score desc);

-- Rate limit table — single row per user, server-only.
create table if not exists public.rate_limits (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  last_at   timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles            enable row level security;
alter table public.achievements        enable row level security;
alter table public.daily_results       enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.rate_limits         enable row level security;

-- Profiles: user reads & writes their own row. UPDATE needs both USING (which
-- rows the user can target) AND WITH CHECK (what the new row state must look
-- like) — without WITH CHECK, a malicious update could reassign user_id.
-- auth.uid() is wrapped in (select …) so Postgres can fold it into a constant
-- per statement (avoids re-evaluating the function per row).
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Achievements: user owns their rows.
create policy "achievements: read own" on public.achievements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "achievements: write own" on public.achievements
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Daily results: user owns.
create policy "daily_results: read own" on public.daily_results
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_results: write own" on public.daily_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Leaderboard: anyone can read (including anonymous browsers), NO direct
-- writes — submit_score RPC is the only path in.
create policy "leaderboard: read public" on public.leaderboard_entries
  for select to anon, authenticated using (true);

-- Rate limits: no client access — only the submit_score function (SECURITY
-- DEFINER) can read/write. No policies = no client access.

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Helper: auto-create a profile row when an auth user is created.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      'Player_' || upper(substring(new.id::text, 1, 4))
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. submit_score RPC — anti-cheat, rate limit, upsert 3 boards, return ranks.
-- ───────────────────────────────────────────────────────────────────────────

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
  v_uid             uuid := auth.uid();
  v_today           text := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  v_week            text := to_char((now() at time zone 'utc')::date, 'IYYY"-W"IW');
  v_max_per_level   constant integer := 200;
  v_min_ms_per_level constant integer := 800;
  v_window_ms       constant integer := 30000;
  v_last_at         timestamptz;
  v_profile         profiles%rowtype;
  v_rank_alltime    integer;
  v_rank_weekly     integer;
  v_rank_daily      integer;
  v_personal_best   boolean := false;
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

  -- Rate limit: at most one submission per 30s per user.
  select last_at into v_last_at from public.rate_limits where user_id = v_uid;
  if v_last_at is not null and now() - v_last_at < (v_window_ms || ' milliseconds')::interval then
    raise exception 'rate_limited' using errcode = '53400';
  end if;
  insert into public.rate_limits(user_id, last_at)
    values (v_uid, now())
    on conflict (user_id) do update set last_at = excluded.last_at;

  -- Ensure profile exists (defensive — trigger should have made it).
  select * into v_profile from public.profiles where user_id = v_uid;
  if not found then
    insert into public.profiles(user_id, display_name)
      values (v_uid, 'Player_' || upper(substring(v_uid::text, 1, 4)))
      returning * into v_profile;
  end if;

  -- Upsert into the three boards, but only if the new score beats the existing one.
  insert into public.leaderboard_entries
    (user_id, mode, period, bucket, score, level, display_name, photo_url, country, achieved_at)
  values
    (v_uid, p_mode, 'alltime', 'all',  p_score, p_level, v_profile.display_name, v_profile.photo_url, v_profile.country, now()),
    (v_uid, p_mode, 'weekly',  v_week, p_score, p_level, v_profile.display_name, v_profile.photo_url, v_profile.country, now()),
    (v_uid, p_mode, 'daily',   v_today, p_score, p_level, v_profile.display_name, v_profile.photo_url, v_profile.country, now())
  on conflict (user_id, mode, period, bucket) do update
    set score        = excluded.score,
        level        = excluded.level,
        display_name = excluded.display_name,
        photo_url    = excluded.photo_url,
        country      = excluded.country,
        achieved_at  = excluded.achieved_at
    where public.leaderboard_entries.score < excluded.score;

  -- Track whether at least one board was improved (we read the rows back).
  select exists(
    select 1 from public.leaderboard_entries
     where user_id = v_uid and mode = p_mode and score = p_score and achieved_at >= now() - interval '5 seconds'
  ) into v_personal_best;

  -- Update profile highScore/highLevel.
  update public.profiles
     set high_score   = greatest(high_score, p_score),
         high_level   = greatest(high_level, p_level),
         last_seen_at = now()
   where user_id = v_uid;

  -- Compute approximate rank (count strictly greater scores + 1).
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

-- Tighten access: revoke the default PUBLIC grant (which would otherwise let
-- anon call this SECURITY DEFINER function), then explicitly grant to the
-- authenticated role. The function's first check still rejects null auth.uid()
-- as defence-in-depth.
revoke execute on function public.submit_score(integer, integer, text, integer, integer) from public;
grant execute on function public.submit_score(integer, integer, text, integer, integer) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Daily cleanup — older buckets we no longer surface.
-- pg_cron is built-in to Supabase; enable the extension on first migration.
-- ───────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron with schema extensions;

-- (Idempotent re-schedule — unschedule before re-creating in case of replays.)
do $$
declare j integer;
begin
  for j in select jobid from cron.job where jobname = 'cleanup_expired_leaderboards' loop
    perform cron.unschedule(j);
  end loop;
end $$;

select cron.schedule(
  'cleanup_expired_leaderboards',
  '5 0 * * *',  -- 00:05 UTC daily
  $$
    delete from public.leaderboard_entries
     where period = 'daily'
       and bucket < to_char((now() at time zone 'utc' - interval '30 days')::date, 'YYYY-MM-DD');
    delete from public.leaderboard_entries
     where period = 'weekly'
       and bucket < to_char((now() at time zone 'utc' - interval '84 days')::date, 'IYYY"-W"IW');
  $$
);
