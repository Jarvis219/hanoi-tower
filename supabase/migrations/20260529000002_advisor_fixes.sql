-- Advisor cleanup after the initial migration.
--
-- 1. Multiple permissive policies on `achievements` + `daily_results`
--    The "write own" policy (FOR ALL) already covers SELECT, so the dedicated
--    "read own" SELECT policy is redundant — both fire on every SELECT and the
--    planner has to OR them together. Drop the SELECT-only ones.
drop policy if exists "achievements: read own" on public.achievements;
drop policy if exists "daily_results: read own" on public.daily_results;

-- 2. handle_new_user SECURITY DEFINER trigger function shouldn't be callable
--    from the REST API. Triggers fire as the function owner (postgres), so
--    REST grants are not needed. Revoke from every client role.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;
