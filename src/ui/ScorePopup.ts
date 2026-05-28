import Phaser from 'phaser';

export const showScorePopup = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string = '#ffffff',
): void => {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(1000);

  scene.tweens.add({
    targets: label,
    y: y - 60,
    alpha: 0,
    duration: 900,
    ease: 'Cubic.easeOut',
    onComplete: () => label.destroy(),
  });
};
