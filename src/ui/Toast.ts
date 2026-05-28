import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/Constants';

export const showToast = (
  scene: Phaser.Scene,
  icon: string,
  title: string,
  subtitle: string,
): void => {
  const y = 80;
  const container = scene.add
    .container(GAME_WIDTH + 200, y)
    .setScrollFactor(0)
    .setDepth(2000);

  const W = 320;
  const H = 60;
  const R = 14;
  const bg = scene.add.graphics();
  bg.fillStyle(0x1a1a2e, 0.94);
  bg.fillRoundedRect(-W / 2, -H / 2, W, H, R);
  bg.lineStyle(2, 0xf2cc8f, 1);
  bg.strokeRoundedRect(-W / 2, -H / 2, W, H, R);
  const iconText = scene.add
    .text(-140, 0, icon, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#f2cc8f',
    })
    .setOrigin(0.5);
  const titleText = scene.add
    .text(-105, -12, title, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#f2cc8f',
    })
    .setOrigin(0, 0.5);
  const subText = scene.add
    .text(-105, 8, subtitle, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
    })
    .setOrigin(0, 0.5);

  container.add([bg, iconText, titleText, subText]);

  scene.tweens.add({
    targets: container,
    x: GAME_WIDTH - 180,
    duration: 320,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2200, () => {
        scene.tweens.add({
          targets: container,
          x: GAME_WIDTH + 200,
          alpha: 0,
          duration: 280,
          ease: 'Sine.easeIn',
          onComplete: () => container.destroy(),
        });
      });
    },
  });
};
