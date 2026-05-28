import Phaser from 'phaser';

/**
 * Tiny FPS readout. Enable with `?fps=1` in the URL — useful for spot
 * checks on real devices without bundling dev panels into production.
 */
export const installFpsMeterIfRequested = (scene: Phaser.Scene): void => {
  const url = new URL(window.location.href);
  if (url.searchParams.get('fps') !== '1') return;

  const text = scene.add
    .text(8, scene.cameras.main.height - 22, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 4, y: 2 },
    })
    .setScrollFactor(0)
    .setDepth(9999);

  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    text.setText(`fps ${Math.round(scene.game.loop.actualFps)}`);
  });
};
