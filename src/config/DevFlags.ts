/**
 * Dev-only flags. Enable via either:
 *   - Build-time env: VITE_DEV_UNLOCK_ALL=true npm run dev
 *   - URL query param: ?unlock=1 (works in any build, lives only for the session)
 *
 * Production builds without either signal behave normally (no unlocks).
 */

const queryFlag = (name: string): boolean => {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const v = url.searchParams.get(name);
  return v === '1' || v === 'true';
};

const envFlag = (name: string): boolean => {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  return v === 'true' || v === '1';
};

export const DEV_UNLOCK_ALL = envFlag('VITE_DEV_UNLOCK_ALL') || queryFlag('unlock');
