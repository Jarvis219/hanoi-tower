import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { consentManager } from '../systems/ConsentManager';
import { t } from '../systems/I18nManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';

export class ConsentBannerScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.ConsentBanner });
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);

    this.add
      .text(GAME_WIDTH / 2, 80, t('consent.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, t('consent.body'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 60 },
      })
      .setOrigin(0.5);

    const btnW = 240;
    new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT * 0.6,
      width: btnW,
      label: t('consent.accept'),
      icon: '✓',
      bgColor: COLOR.primary,
      onClick: () => {
        consentManager.accept();
        this.scene.start(SCENE_KEYS.MainMenu);
      },
    });
    new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT * 0.7,
      width: btnW,
      height: 44,
      label: t('consent.reject'),
      icon: '✕',
      fontSize: 14,
      bgColor: COLOR.neutral,
      onClick: () => {
        consentManager.reject();
        this.scene.start(SCENE_KEYS.MainMenu);
      },
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, t('consent.note'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#aaaaaa',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 60 },
      })
      .setOrigin(0.5);
  }
}
