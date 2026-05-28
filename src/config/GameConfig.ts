import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './Constants';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { HUDScene } from '../scenes/HUDScene';
import { PauseScene } from '../scenes/PauseScene';
import { AchievementsScene } from '../scenes/AchievementsScene';
import { SettingsScene } from '../scenes/SettingsScene';
import { ThemesScene } from '../scenes/ThemesScene';
import { TutorialScene } from '../scenes/TutorialScene';

export const createGameConfig = (parent: string): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bgMenu,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1400 },
      debug: false,
    },
  },
  pixelArt: true,
  roundPixels: true,
  scene: [
    BootScene,
    PreloadScene,
    TutorialScene,
    MainMenuScene,
    GameScene,
    HUDScene,
    PauseScene,
    GameOverScene,
    AchievementsScene,
    SettingsScene,
    ThemesScene,
  ],
});
