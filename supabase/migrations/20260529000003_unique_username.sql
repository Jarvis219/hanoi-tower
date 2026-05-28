-- ───────────────────────────────────────────────────────────────────────────
-- Unique usernames.
--
-- Goal: two users can't share the same display_name (case-insensitive). The
-- only path to mutate display_name is via claim_username() RPC — direct
-- updates from the client would race the uniqueness check.
-- ───────────────────────────────────────────────────────────────────────────

-- 1. Case-insensitive unique index. This lets "Player1" and "player1" collide.
create unique index if not exists profiles_display_name_lower_unique
  on public.profiles (lower(display_name));

-- 2. Strengthen the auto-generated default so two new signups are unlikely to
--    collide on the trigger (4 hex chars = 65k space, 8 chars = 4B space).
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
      'Player_' || upper(substring(replace(new.id::text, '-', ''), 1, 8))
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- (Re-create the trigger reference — the trigger itself is unchanged, but
-- declaring it here makes this migration replayable on a fresh database too.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. claim_username — atomic check + set. Returns:
--      { ok: true }
--      { ok: false, reason: 'taken' }
--      raises 'invalid_length' / 'unauthenticated' / 'invalid_chars'
create or replace function public.claim_username(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_trimmed text := trim(p_name);
  v_taken   boolean;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if char_length(v_trimmed) < 3 or char_length(v_trimmed) > 20 then
    raise exception 'invalid_length' using errcode = '22023';
  end if;
  -- Only allow letters, digits, underscore, dot, hyphen. Avoids whitespace,
  -- emoji, RTL marks, and other display tricks.
  if v_trimmed !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'invalid_chars' using errcode = '22023';
  end if;

  -- Atomic check: anyone else holding this name (case-insensitive)?
  select exists(
    select 1 from public.profiles
     where lower(display_name) = lower(v_trimmed)
       and user_id <> v_uid
  ) into v_taken;
  if v_taken then
    return json_build_object('ok', false, 'reason', 'taken');
  end if;

  update public.profiles
     set display_name = v_trimmed,
         last_seen_at = now()
   where user_id = v_uid;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.claim_username(text) from public;
grant execute on function public.claim_username(text) to authenticated;
