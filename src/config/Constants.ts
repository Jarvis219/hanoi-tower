export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const COLORS = {
  skyDay: 0x87ceeb,
  skyDusk: 0xff8c69,
  skySpace: 0x0b0c2a,
  blockDefault: 0xe07a5f,
  blockPerfect: 0xf2cc8f,
  textPrimary: '#ffffff',
  textAccent: '#f2cc8f',
  bgMenu: 0x1a1a2e,
} as const;

export const SCENE_KEYS = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  MainMenu: 'MainMenuScene',
  Game: 'GameScene',
  HUD: 'HUDScene',
  Pause: 'PauseScene',
  GameOver: 'GameOverScene',
  Settings: 'SettingsScene',
  Achievements: 'AchievementsScene',
  Tutorial: 'TutorialScene',
  Themes: 'ThemesScene',
  Leaderboard: 'LeaderboardScene',
  ConsentBanner: 'ConsentBannerScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
