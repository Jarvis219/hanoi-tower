import Phaser from 'phaser';
import { createGameConfig } from './config/GameConfig';
import { setupPWA } from './pwa';
import { authManager } from './systems/supabase/AuthManager';
import { cloudSyncManager } from './systems/supabase/CloudSyncManager';
import { initI18n, t } from './systems/I18nManager';

setupPWA();

const startGame = (): void => {
  new Phaser.Game(createGameConfig('app'));
};

/** Surface a one-off recovery prompt when Supabase redirected back with
 *  `identity_already_exists` — the player tried to link a Google account
 *  that's already attached to a different anonymous profile. We offer to
 *  sign in as that existing profile instead of silently swallowing the error. */
const maybeHandleIdentityConflict = async (): Promise<void> => {
  const code = authManager.consumePendingLinkError();
  if (code !== 'identity_already_exists') return;
  const shouldSwitch = window.confirm(
    `${t('account.identity_conflict_title')}\n\n${t('account.identity_conflict_body')}\n\nOK = ${t('account.identity_conflict_switch')}\nCancel = ${t('account.identity_conflict_stay')}`,
  );
  if (shouldSwitch) {
    const res = await authManager.signInWithGoogle();
    if (!res.ok) console.warn('[Auth] Google sign-in (recovery) failed:', res.error);
  }
};

void (async (): Promise<void> => {
  await initI18n();
  // Sign in anonymously (or restore session) before Phaser boots so scenes
  // can rely on a known auth state. Fails silently in offline-only mode.
  await authManager.init();
  // If the previous redirect cycle ended with identity_already_exists, ask
  // the user whether to switch to the existing Google-linked profile.
  await maybeHandleIdentityConflict();
  // Kick off background sync; do not block the game on the first cloud read.
  void cloudSyncManager.start();
  startGame();
})();
