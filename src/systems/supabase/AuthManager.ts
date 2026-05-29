import type { User } from '@supabase/supabase-js';
import { saveManager } from '../SaveManager';
import { supabase, supabaseEnabled } from './SupabaseClient';

type Listener = (user: User | null) => void;

class AuthManager {
  private user: User | null = null;
  private listeners = new Set<Listener>();

  public async init(): Promise<void> {
    if (!supabaseEnabled || !supabase) return;

    // Subscribe to auth events for future updates (link Google, sign-out).
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user ?? null;
      this.listeners.forEach((cb) => cb(this.user));
    });

    // Restore an existing session if there is one.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      this.user = data.session.user;
      return;
    }

    // No session — sign in anonymously.
    try {
      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn('[Auth] Anonymous sign-in failed:', error.message);
      } else {
        this.user = signed.user ?? null;
      }
    } catch (err) {
      console.warn('[Auth] Anonymous sign-in threw:', err);
    }
  }

  public get currentUser(): User | null {
    return this.user;
  }
  public get currentUid(): string | null {
    return this.user?.id ?? null;
  }
  public get isAnonymous(): boolean {
    // Supabase marks anonymous users with `is_anonymous: true` in app_metadata
    // or by the absence of any identity rows. The `aud` field is 'authenticated'
    // for both anon and signed-in users, so we check identities length.
    if (!this.user) return false;
    const identities = this.user.identities ?? [];
    return identities.length === 0 || Boolean(this.user.is_anonymous);
  }
  public get isGoogleLinked(): boolean {
    return Boolean(this.user?.identities?.some((i) => i.provider === 'google'));
  }
  public get displayName(): string {
    // Priority: user-edited name (saved + synced) > OAuth name > UUID-based fallback.
    const fromSave = saveManager.displayName;
    if (fromSave) return fromSave;
    if (!this.user) return 'Guest';
    const fromGoogle = this.user.user_metadata?.full_name as string | undefined;
    if (fromGoogle) return fromGoogle;
    const short = this.user.id.slice(0, 4).toUpperCase();
    return `Player_${short}`;
  }

  public onChange(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public async linkGoogle(): Promise<{ ok: boolean; error?: string }> {
    if (!supabaseEnabled || !supabase) {
      return { ok: false, error: 'auth-unavailable' };
    }
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  public async unlinkGoogle(): Promise<void> {
    if (!supabase || !this.user) return;
    const google = this.user.identities?.find((i) => i.provider === 'google');
    if (!google) return;
    try {
      await supabase.auth.unlinkIdentity(google);
    } catch (err) {
      console.warn('[Auth] Unlink Google failed:', err);
    }
  }

  public async signOutAndReset(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
    await supabase.auth.signInAnonymously();
  }

  /**
   * Atomically check + claim a new display name. Server-side enforces
   * uniqueness (case-insensitive) and character class — see claim_username RPC.
   * Returns:
   *   { ok: true }                    → name reserved
   *   { ok: false, reason: 'taken' }  → another user owns this name
   *   { ok: false, reason: '<code>' } → length / chars / network / RLS error
   */
  public async claimUsername(name: string): Promise<{ ok: boolean; reason?: string }> {
    if (!supabaseEnabled || !supabase) return { ok: false, reason: 'offline' };
    if (!this.user) return { ok: false, reason: 'not-signed-in' };
    const { data, error } = await supabase.rpc('claim_username', { p_name: name });
    if (error) {
      return { ok: false, reason: error.message };
    }
    return data as { ok: boolean; reason?: string };
  }
}

export const authManager = new AuthManager();
