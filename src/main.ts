import Phaser from 'phaser';
import { createGameConfig } from './config/GameConfig';
import { setupPWA } from './pwa';
import { authManager } from './systems/supabase/AuthManager';
import { cloudSyncManager } from './systems/supabase/CloudSyncManager';
import { initI18n } from './systems/I18nManager';

setupPWA();

const startGame = (): void => {
  new Phaser.Game(createGameConfig('app'));
};

void (async (): Promise<void> => {
  await initI18n();
  // Sign in anonymously (or restore session) before Phaser boots so scenes
  // can rely on a known auth state. Fails silently in offline-only mode.
  await authManager.init();
  // Kick off background sync; do not block the game on the first cloud read.
  void cloudSyncManager.start();
  startGame();
})();
