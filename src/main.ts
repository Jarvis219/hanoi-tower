import Phaser from 'phaser';
import { createGameConfig } from './config/GameConfig';
import { setupPWA } from './pwa';
import { initI18n } from './systems/I18nManager';

setupPWA();
void initI18n().then(() => {
  new Phaser.Game(createGameConfig('app'));
});
