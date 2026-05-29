-- Add 'danang' to the allowed theme list. The original CHECK constraint
-- was created in 20260529000001_initial.sql when the game only shipped
-- with hanoi / hue / saigon. Updating client to set selected_theme = 'danang'
-- failed with `profiles_selected_theme_check` until this constraint is widened.

alter table public.profiles
  drop constraint if exists profiles_selected_theme_check;

alter table public.profiles
  add constraint profiles_selected_theme_check
  check (selected_theme in ('hanoi', 'hue', 'danang', 'saigon'));
