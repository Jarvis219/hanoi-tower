import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env;

const url = env.VITE_SUPABASE_URL as string | undefined;
const anonKey = env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

let _supabase: SupabaseClient | null = null;

if (supabaseEnabled) {
  _supabase = createClient(url!, anonKey!, {
    auth: {
      // Session persists in localStorage; we want it auto-restored on reload.
      persistSession: true,
      autoRefreshToken: true,
      // We do not use OAuth callback URLs by default — popup-based linking is
      // initiated explicitly from Settings; this keeps cold starts simple.
      detectSessionInUrl: true,
    },
  });
} else if (env.DEV) {
  console.info(
    '[Supabase] Env vars missing — running in offline-only mode (localStorage only). Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to enable cloud sync.',
  );
}

export const supabase = _supabase;
