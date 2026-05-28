import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { audioManager } from '../systems/AudioManager';
import { saveManager } from '../systems/SaveManager';
import { t } from '../systems/I18nManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';

type StepKey = 'intro' | 'swing' | 'drop' | 'perfect' | 'slice' | 'powerups' | 'hud' | 'themes';

const STEPS: StepKey[] = ['intro', 'swing', 'drop', 'perfect', 'slice', 'powerups', 'hud', 'themes'];

const DEMO_X = GAME_WIDTH / 2;
const DEMO_Y = GAME_HEIGHT * 0.46;
const DEMO_BLOCK_W = 180;
const DEMO_BLOCK_H = 44;

export class TutorialScene extends Phaser.Scene {
  private step = 0;
  private stepCounter!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private demoGroup!: Phaser.GameObjects.Container;
  private nextBtn!: Button;
  private backBtn!: Button;
  private demoTween?: Phaser.Tweens.Tween;
  private demoTimer?: Phaser.Time.TimerEvent;
  private demoTimers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super({ key: SCENE_KEYS.Tutorial });
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);

    // Title bar
    this.add
      .text(GAME_WIDTH / 2, 36, t('tutorial.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    this.buildSettingsIcon();

    this.stepCounter = this.add
      .text(GAME_WIDTH / 2, 80, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    // Step title + body card
    const cardY = 110;
    const cardH = 130;
    const cardW = GAME_WIDTH - 40;
    const card = this.add.graphics();
    card.fillStyle(0x0f3460, 0.85);
    card.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY, cardW, cardH, 14);
    card.lineStyle(2, 0xf2cc8f, 0.7);
    card.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY, cardW, cardH, 14);

    this.titleText = this.add
      .text(GAME_WIDTH / 2, cardY + 22, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#f2cc8f',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: cardW - 30 },
      })
      .setOrigin(0.5, 0);

    this.bodyText = this.add
      .text(GAME_WIDTH / 2, cardY + 62, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: cardW - 40 },
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0);

    // Demo area
    this.demoGroup = this.add.container(0, 0);

    // Bottom buttons
    const btnY = GAME_HEIGHT - 88;
    this.backBtn = new Button(this, {
      x: GAME_WIDTH / 2 - 95,
      y: btnY,
      width: 130,
      height: 44,
      label: t('tutorial.back').replace(/^◀\s*/, ''),
      icon: '◀',
      fontSize: 14,
      bgColor: COLOR.neutral,
      onClick: () => this.goBack(),
    });
    this.nextBtn = new Button(this, {
      x: GAME_WIDTH / 2 + 95,
      y: btnY,
      width: 180,
      height: 44,
      label: '',
      bgColor: COLOR.primary,
      onClick: () => this.goNext(),
    });

    // Skip — wide transparent hit zone behind the label so taps always land.
    const skipLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 32, t('tutorial.skip'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
    const skipHit = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 32, 160, 36, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    skipHit.on('pointerover', () => {
      this.tweens.add({ targets: skipLabel, scale: 1.1, duration: 100 });
    });
    skipHit.on('pointerout', () => {
      this.tweens.add({ targets: skipLabel, scale: 1, duration: 100 });
    });
    skipHit.on('pointerup', () => {
      audioManager.playSfx('click');
      this.finish();
    });
    void skipLabel;

    this.renderStep();
  }

  private renderStep(): void {
    const key = STEPS[this.step] ?? STEPS[0]!;
    this.stepCounter.setText(t('tutorial.step', { n: this.step + 1, total: STEPS.length }));
    this.titleText.setText(t(`tutorial.${key}.title`));
    this.bodyText.setText(t(`tutorial.${key}.body`));

    const isLast = this.step >= STEPS.length - 1;
    this.nextBtn.setLabel(isLast ? t('tutorial.start') : t('tutorial.next'));
    this.nextBtn.setBgColor(isLast ? COLOR.highlight : COLOR.primary);
    this.backBtn.setDisabled(this.step === 0);

    this.buildDemo(key);
  }

  private clearDemo(): void {
    this.demoTween?.stop();
    this.demoTween = undefined;
    this.demoTimer?.remove(false);
    this.demoTimer = undefined;
    for (const t of this.demoTimers) t.remove(false);
    this.demoTimers.length = 0;
    this.demoGroup.removeAll(true);
  }

  /** Register a timer that will be auto-cleaned when the step changes. */
  private addDemoTimer(config: Phaser.Types.Time.TimerEventConfig): Phaser.Time.TimerEvent {
    const t = this.time.addEvent(config);
    this.demoTimers.push(t);
    return t;
  }

  private buildDemo(key: StepKey): void {
    this.clearDemo();
    const cx = DEMO_X;
    const cy = DEMO_Y;
    switch (key) {
      case 'intro':
        this.demoBlocks(cx, cy);
        break;
      case 'swing':
        this.demoSwing(cx, cy);
        break;
      case 'drop':
        this.demoDrop(cx, cy);
        break;
      case 'perfect':
        this.demoPerfect(cx, cy);
        break;
      case 'slice':
        this.demoSlice(cx, cy);
        break;
      case 'powerups':
        this.demoPowerups(cx, cy);
        break;
      case 'hud':
        this.demoHud(cx, cy);
        break;
      case 'themes':
        this.demoThemes(cx, cy);
        break;
    }
  }

  /** Corner icon button — single point of access to Settings from this scene
   * so the user can switch language before going through the tutorial. */
  private buildSettingsIcon(): void {
    const size = 40;
    const x = GAME_WIDTH - 20 - size / 2;
    const y = 20 + size / 2;
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 10);
    bg.lineStyle(2, 0xffffff, 0.35);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 10);
    const icon = this.add
      .text(0, -1, '⚙', {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const hit = this.add
      .rectangle(0, 0, size, size, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    c.add([bg, icon, hit]);

    hit.on('pointerover', () => {
      this.tweens.add({ targets: c, scale: 1.08, duration: 120 });
    });
    hit.on('pointerout', () => {
      this.tweens.add({ targets: c, scale: 1, duration: 120 });
    });
    hit.on('pointerup', () => {
      audioManager.playSfx('click');
      this.scene.start(SCENE_KEYS.Settings);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  private block(x: number, y: number, w: number, h: number, color: number): Phaser.GameObjects.Rectangle {
    const r = this.add.rectangle(x, y, w, h, color).setStrokeStyle(2, 0x000000, 0.3);
    this.demoGroup.add(r);
    return r;
  }

  private label(x: number, y: number, text: string, color = '#ffffff', size = 12): Phaser.GameObjects.Text {
    const t2 = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: `${size}px`,
        color,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    this.demoGroup.add(t2);
    return t2;
  }

  /** Reusable sky panel background used across all demos for visual consistency. */
  private skyPanel(
    cx: number,
    cy: number,
    w: number,
    h: number,
    skyTop = 0x87ceeb,
    skyBot = 0xfcd6b0,
    withSun = true,
  ): { groundY: number } {
    const panel = this.add.graphics();
    panel.fillGradientStyle(skyTop, skyTop, skyBot, skyBot, 1);
    panel.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    panel.lineStyle(2, 0xffffff, 0.4);
    panel.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    this.demoGroup.add(panel);

    if (withSun) {
      const sun = this.add
        .circle(cx + w / 2 - 26, cy - h / 2 + 24, 12, 0xffe082, 1)
        .setStrokeStyle(2, 0xffd54f, 0.7);
      this.demoGroup.add(sun);
      this.tweens.add({
        targets: sun,
        scale: { from: 0.95, to: 1.1 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return { groundY: cy + h / 2 - 12 };
  }

  // ── Demos per step ────────────────────────────────────────────────
  private demoBlocks(cx: number, cy: number): void {
    // Animated build sequence: tower grows block-by-block on a sky panel
    // with drifting clouds + a sun. Loops every few seconds.
    const panelW = 280;
    const panelH = 200;
    const panel = this.add.graphics();
    panel.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xfcd6b0, 0xfcd6b0, 1);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    panel.lineStyle(2, 0xffffff, 0.4);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    this.demoGroup.add(panel);

    // Sun in top-right corner — gentle pulse
    const sun = this.add
      .circle(cx + panelW / 2 - 30, cy - panelH / 2 + 28, 14, 0xffe082, 1)
      .setStrokeStyle(2, 0xffd54f, 0.8);
    this.demoGroup.add(sun);
    this.tweens.add({
      targets: sun,
      scale: { from: 0.95, to: 1.1 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Drifting clouds — 3 ellipses moving slowly across the panel
    const clouds: Phaser.GameObjects.Ellipse[] = [];
    for (let i = 0; i < 3; i += 1) {
      const cloud = this.add.ellipse(
        cx - panelW / 2 + i * 90,
        cy - panelH / 2 + 40 + (i % 2) * 12,
        Phaser.Math.Between(34, 52),
        Phaser.Math.Between(14, 18),
        0xffffff,
        0.85,
      );
      this.demoGroup.add(cloud);
      clouds.push(cloud);
      this.tweens.add({
        targets: cloud,
        x: cloud.x + 60,
        duration: 3000 + i * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Tower build sequence
    const groundY = cy + panelH / 2 - 10;
    const blockW = 110;
    const blockH = 22;
    const palette = [0x3d405b, 0xe07a5f, 0xf2cc8f, 0x81b29a, 0xb9d6e6];
    const seq: Phaser.GameObjects.Rectangle[] = [];

    const spawnBlock = (index: number): void => {
      const color = palette[index % palette.length] ?? 0xe07a5f;
      const w = index === 0 ? blockW + 18 : blockW - index * 4; // foundation widest
      const targetY = groundY - index * blockH;
      const startY = cy - panelH / 2 - 30;
      const blk = this.add
        .rectangle(cx, startY, w, blockH, color)
        .setStrokeStyle(2, 0x000000, 0.35);
      this.demoGroup.add(blk);
      seq.push(blk);
      this.tweens.add({
        targets: blk,
        y: targetY,
        duration: 380,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          // tiny squash on land
          this.tweens.add({
            targets: blk,
            scaleY: { from: 1, to: 0.85 },
            duration: 80,
            yoyo: true,
            ease: 'Sine.easeOut',
          });
          // sparkle
          const spark = this.add
            .text(cx, targetY - 16, '✨', {
              fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
              fontSize: '16px',
            })
            .setOrigin(0.5);
          this.demoGroup.add(spark);
          this.tweens.add({
            targets: spark,
            y: targetY - 30,
            alpha: 0,
            duration: 500,
            onComplete: () => spark.destroy(),
          });
        },
      });
    };

    // Stagger spawning, then reset and loop
    const stepDelay = 600;
    const totalFloors = 5;
    const buildLoop = (): void => {
      for (const b of seq) b.destroy();
      seq.length = 0;
      for (let i = 0; i < totalFloors; i += 1) {
        this.time.delayedCall(i * stepDelay, () => {
          if (this.demoGroup.scene) spawnBlock(i);
        });
      }
    };
    buildLoop();
    this.demoTimer = this.addDemoTimer({
      delay: totalFloors * stepDelay + 1000,
      loop: true,
      callback: buildLoop,
    });
  }

  private demoSwing(cx: number, cy: number): void {
    const { groundY } = this.skyPanel(cx, cy, 280, 200);
    // Foundation seated on ground
    this.block(cx, groundY - DEMO_BLOCK_H / 2, DEMO_BLOCK_W, DEMO_BLOCK_H, 0x3d405b);

    // Swing rails (subtle lines showing the swing range)
    const railY = groundY - DEMO_BLOCK_H - 8;
    const railL = cx - 100;
    const railR = cx + 100;
    const rail = this.add.graphics();
    rail.lineStyle(1, 0xffffff, 0.35);
    rail.lineBetween(railL, railY - 22, railR, railY - 22);
    this.demoGroup.add(rail);
    // Arrow markers at endpoints
    this.label(railL - 8, railY - 22, '◀', '#ffffff', 12);
    this.label(railR + 8, railY - 22, '▶', '#ffffff', 12);

    // The swinger
    const swinger = this.block(railL, railY, DEMO_BLOCK_W, DEMO_BLOCK_H, 0xe07a5f);

    // Trailing ghost — fades after the swinger
    const ghost = this.block(railL, railY, DEMO_BLOCK_W, DEMO_BLOCK_H, 0xe07a5f);
    ghost.setAlpha(0.25);

    this.demoTween = this.tweens.add({
      targets: swinger,
      x: railR,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: ghost,
      x: railR,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 90,
    });
  }

  private demoDrop(cx: number, cy: number): void {
    const { groundY } = this.skyPanel(cx, cy, 280, 200);
    this.block(cx, groundY - DEMO_BLOCK_H / 2, DEMO_BLOCK_W, DEMO_BLOCK_H, 0x3d405b);
    const targetY = groundY - DEMO_BLOCK_H * 1.5;
    const hoverY = cy - 50;
    const dropper = this.block(cx, hoverY, DEMO_BLOCK_W, DEMO_BLOCK_H, 0xe07a5f);

    // Tap hint with finger + pulsing ring
    const finger = this.add
      .text(cx + DEMO_BLOCK_W / 2 + 14, hoverY, '👆', {
        fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fontSize: '22px',
      })
      .setOrigin(0.5);
    this.demoGroup.add(finger);
    const ring = this.add
      .circle(finger.x, finger.y, 14, 0xffffff, 0)
      .setStrokeStyle(2, 0xf2cc8f, 1);
    this.demoGroup.add(ring);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.8, to: 1.6 },
      alpha: { from: 1, to: 0 },
      duration: 900,
      repeat: -1,
      ease: 'Sine.easeOut',
    });

    // Drop loop: hover → drop → squash → reset
    const loop = (): void => {
      dropper.y = hoverY;
      this.tweens.add({
        targets: dropper,
        y: targetY,
        duration: 360,
        delay: 800,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.tweens.add({
            targets: dropper,
            scaleY: { from: 1, to: 0.85 },
            duration: 80,
            yoyo: true,
            ease: 'Sine.easeOut',
          });
          // dust puff
          const dust = this.add.ellipse(cx, targetY + DEMO_BLOCK_H / 2, 40, 10, 0xffffff, 0.6);
          this.demoGroup.add(dust);
          this.tweens.add({
            targets: dust,
            scaleX: 1.8,
            alpha: 0,
            duration: 400,
            onComplete: () => dust.destroy(),
          });
        },
      });
    };
    loop();
    this.demoTimer = this.addDemoTimer({
      delay: 1800,
      loop: true,
      callback: loop,
    });
  }

  private demoPerfect(cx: number, cy: number): void {
    const { groundY } = this.skyPanel(cx, cy, 280, 200);
    this.block(cx, groundY - DEMO_BLOCK_H / 2, DEMO_BLOCK_W, DEMO_BLOCK_H, 0x3d405b);
    const perfectBlock = this.block(
      cx,
      groundY - DEMO_BLOCK_H * 1.5,
      DEMO_BLOCK_W,
      DEMO_BLOCK_H,
      0xf2cc8f,
    );

    // Gold glow around the perfect block — pulsing
    const glow = this.add
      .rectangle(cx, perfectBlock.y, DEMO_BLOCK_W + 24, DEMO_BLOCK_H + 16, 0xf2cc8f, 0)
      .setStrokeStyle(3, 0xf2cc8f, 0.7);
    this.demoGroup.add(glow);
    this.tweens.add({
      targets: glow,
      scale: { from: 1, to: 1.15 },
      alpha: { from: 0.9, to: 0.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // "PERFECT! x3" banner with bounce + slight float
    const banner = this.label(cx, cy - 50, '✨ PERFECT! x3 ✨', '#f2cc8f', 16);
    this.tweens.add({
      targets: banner,
      scale: { from: 0.95, to: 1.12 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: banner,
      y: banner.y - 6,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Bursting sparkles around the perfect block — loop every 1.5s
    const burst = (): void => {
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
        const dist = 36;
        const sx = cx + Math.cos(angle) * 6;
        const sy = perfectBlock.y + Math.sin(angle) * 6;
        const spark = this.add
          .text(sx, sy, '✨', {
            fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
            fontSize: '14px',
          })
          .setOrigin(0.5);
        this.demoGroup.add(spark);
        this.tweens.add({
          targets: spark,
          x: sx + Math.cos(angle) * dist,
          y: sy + Math.sin(angle) * dist,
          alpha: { from: 1, to: 0 },
          scale: { from: 1, to: 0.4 },
          duration: 700,
          onComplete: () => spark.destroy(),
        });
      }
    };
    burst();
    this.demoTimer = this.addDemoTimer({ delay: 1500, loop: true, callback: burst });
  }

  private demoSlice(cx: number, cy: number): void {
    const { groundY } = this.skyPanel(cx, cy, 280, 200);
    this.block(cx, groundY - DEMO_BLOCK_H / 2, DEMO_BLOCK_W, DEMO_BLOCK_H, 0x3d405b);

    const settledY = groundY - DEMO_BLOCK_H * 1.5;
    // The remaining (kept) portion sits offset right
    const keptW = 130;
    this.block(cx + 25, settledY, keptW, DEMO_BLOCK_H, 0xe07a5f);

    // Delta indicator — short red arrow showing the misalignment
    const delta = this.add.graphics();
    delta.lineStyle(2, 0xff4d4d, 0.9);
    delta.lineBetween(cx - 40, settledY - 30, cx + 40, settledY - 30);
    delta.lineBetween(cx - 40, settledY - 34, cx - 40, settledY - 26);
    delta.lineBetween(cx + 40, settledY - 34, cx + 40, settledY - 26);
    this.demoGroup.add(delta);
    this.label(cx, settledY - 44, 'lệch ▼', '#ff8080', 11);

    // Debris falling off the right — loop with dust puff at break
    const spawnDebris = (): void => {
      const debris = this.block(cx + 140, settledY, 50, DEMO_BLOCK_H, 0xe07a5f);
      const dust = this.add.ellipse(cx + 100, settledY, 26, 10, 0xc4a682, 0.7);
      this.demoGroup.add(dust);
      this.tweens.add({
        targets: dust,
        scaleX: 2,
        alpha: 0,
        duration: 500,
        onComplete: () => dust.destroy(),
      });
      this.tweens.add({
        targets: debris,
        y: settledY + 110,
        alpha: 0,
        angle: 90,
        x: cx + 160,
        duration: 1000,
        ease: 'Cubic.easeIn',
        onComplete: () => debris.destroy(),
      });
    };
    spawnDebris();
    this.demoTimer = this.addDemoTimer({ delay: 1600, loop: true, callback: spawnDebris });
  }

  private demoPowerups(cx: number, cy: number): void {
    this.skyPanel(cx, cy, 320, 200, 0x87ceeb, 0xfcd6b0, false);

    const items = [
      { icon: '↔', color: 0x81b29a, name: 'Wide' },
      { icon: '⏱', color: 0x5dade2, name: 'Slow' },
      { icon: '★', color: 0xf2cc8f, name: 'Magnet' },
      { icon: '♥', color: 0xe07a5f, name: 'Heal' },
    ];
    const gap = 70;
    const startX = cx - ((items.length - 1) * gap) / 2;

    items.forEach((it, i) => {
      const x = startX + i * gap;
      // Block body with rounded corners + drop shadow
      const shadow = this.add
        .rectangle(x, cy + 4, 56, 56, 0x000000, 0.35);
      this.demoGroup.add(shadow);
      const blk = this.add
        .rectangle(x, cy, 56, 56, it.color)
        .setStrokeStyle(2, 0x000000, 0.4);
      this.demoGroup.add(blk);

      // Floating badge icon ABOVE the block — bobs continuously, lag per item
      const badge = this.add
        .text(x, cy - 42, it.icon, {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '26px',
          color: '#ffffff',
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      this.demoGroup.add(badge);
      this.tweens.add({
        targets: badge,
        y: badge.y - 6,
        scale: { from: 1, to: 1.15 },
        duration: 700 + i * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Glow ring around block — pulse
      const ring = this.add
        .circle(x, cy, 34, it.color, 0)
        .setStrokeStyle(2, it.color, 0.7);
      this.demoGroup.add(ring);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.9, to: 1.4 },
        alpha: { from: 0.7, to: 0 },
        duration: 1200 + i * 100,
        repeat: -1,
        ease: 'Sine.easeOut',
      });

      this.label(x, cy + 48, it.name, '#ffffff', 11);
    });
  }

  private demoHud(cx: number, cy: number): void {
    // Use a darker "in-game" panel since HUD lives over gameplay, not sky.
    const panel = this.add.graphics();
    panel.fillStyle(0x0f3460, 0.92);
    panel.fillRoundedRect(cx - 200, cy - 50, 400, 100, 14);
    panel.lineStyle(2, 0xf2cc8f, 0.6);
    panel.strokeRoundedRect(cx - 200, cy - 50, 400, 100, 14);
    this.demoGroup.add(panel);

    // Score block — ticks up continuously
    const scoreLabel = this.label(cx - 140, cy - 20, 'SCORE', '#aaaaaa', 9);
    void scoreLabel;
    const scoreText = this.label(cx - 140, cy + 4, '1350', '#f2cc8f', 22);
    let score = 1350;
    this.demoTimer = this.addDemoTimer({
      delay: 80,
      loop: true,
      callback: () => {
        score += Phaser.Math.Between(2, 15);
        scoreText.setText(score.toString());
      },
    });

    // Floor counter — increments slower
    const floorText = this.label(cx, cy + 4, 'Tầng 36', '#ffffff', 14);
    let floor = 36;
    this.addDemoTimer({
      delay: 1200,
      loop: true,
      callback: () => {
        floor += 1;
        floorText.setText(`Tầng ${floor}`);
      },
    });

    // Combo — flashes pulse
    this.label(cx + 100, cy - 20, 'COMBO', '#aaaaaa', 9);
    const combo = this.label(cx + 100, cy + 4, 'x5', '#ff6b6b', 22);
    this.tweens.add({
      targets: combo,
      scale: { from: 1, to: 1.25 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Pause button — subtle hover scale
    const pauseShadow = this.add
      .rectangle(cx + 170, cy + 4, 38, 38, 0x000000, 0.35);
    this.demoGroup.add(pauseShadow);
    const pause = this.add
      .rectangle(cx + 170, cy, 38, 38, 0x3d405b)
      .setStrokeStyle(2, 0xffffff, 0.3);
    this.demoGroup.add(pause);
    this.label(cx + 170, cy, '⏸', '#ffffff', 18);
    this.demoTween = this.tweens.add({
      targets: pause,
      scale: { from: 1, to: 1.08 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private demoThemes(cx: number, cy: number): void {
    interface ThemePreview {
      name: string;
      floor: string;
      sky: number;
      bg: number;
      accent: string;
      icon: string; // sun / sunset / moon icon
      blockColors: [number, number]; // 2 floor tints
    }
    const themes: ThemePreview[] = [
      {
        name: 'Hà Nội',
        floor: '0',
        sky: 0x87ceeb,
        bg: 0x141a2e,
        accent: '#f2cc8f',
        icon: '☀',
        blockColors: [0xf3c884, 0xe6a574],
      },
      {
        name: 'Sài Gòn',
        floor: '50',
        sky: 0xff8c69,
        bg: 0x2a1620,
        accent: '#ff9d6b',
        icon: '🌅',
        blockColors: [0xffd9a0, 0xff9d6b],
      },
      {
        name: 'Huế',
        floor: '100',
        sky: 0x6f5b9c,
        bg: 0x1a1430,
        accent: '#c9a8ff',
        icon: '🌙',
        blockColors: [0xd9c8ff, 0x9d8cd6],
      },
    ];

    const cardW = 100;
    const cardH = 130;
    const gap = 16;
    const startX = cx - ((themes.length - 1) * (cardW + gap)) / 2;

    themes.forEach((th, i) => {
      const x = startX + i * (cardW + gap);
      const top = cy - cardH / 2;

      // Card panel with sky gradient → menu bg (mimics the actual theme look)
      const card = this.add.graphics();
      card.fillGradientStyle(th.sky, th.sky, th.bg, th.bg, 1);
      card.fillRoundedRect(x - cardW / 2, top, cardW, cardH, 12);
      card.lineStyle(2, 0xffffff, 0.35);
      card.strokeRoundedRect(x - cardW / 2, top, cardW, cardH, 12);
      this.demoGroup.add(card);

      // Celestial icon (sun/sunset/moon) — drifts up/down for life
      const celestial = this.add
        .text(x + 28, top + 22, th.icon, {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '22px',
        })
        .setOrigin(0.5);
      this.demoGroup.add(celestial);
      this.tweens.add({
        targets: celestial,
        y: celestial.y - 4,
        duration: 1200 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Mini 3-floor tower silhouette at the bottom (sits on baseline)
      const towerBaseY = top + cardH - 12;
      const blockW = 38;
      const blockH = 16;
      // Foundation (darker)
      const found = this.add
        .rectangle(x, towerBaseY, blockW + 6, blockH, 0x3d405b)
        .setStrokeStyle(1, 0x000000, 0.4);
      this.demoGroup.add(found);
      // Floor 1 (mid-tint)
      const f1 = this.add
        .rectangle(x, towerBaseY - blockH, blockW, blockH, th.blockColors[1])
        .setStrokeStyle(1, 0x000000, 0.3);
      this.demoGroup.add(f1);
      // Floor 2 (top tint)
      const f2 = this.add
        .rectangle(x, towerBaseY - blockH * 2, blockW - 4, blockH, th.blockColors[0])
        .setStrokeStyle(1, 0x000000, 0.3);
      this.demoGroup.add(f2);
      // Tower bobs slightly for life
      this.tweens.add({
        targets: [f1, f2, found],
        y: '-=2',
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 120,
      });

      // Sparkle particle on accent — pulse
      const spark = this.add
        .text(x - 32, top + 22, '✨', {
          fontFamily: 'system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
          fontSize: '14px',
        })
        .setOrigin(0.5)
        .setAlpha(0.85);
      this.demoGroup.add(spark);
      this.tweens.add({
        targets: spark,
        scale: { from: 0.7, to: 1.2 },
        alpha: { from: 0.7, to: 1 },
        duration: 800 + i * 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Theme name
      this.label(x, top + 64, th.name, th.accent, 13);
      // Unlock requirement
      this.label(x, top + cardH + 12, `🔓 Tầng ${th.floor}`, '#cccccc', 10);
    });
  }

  // ── Navigation ────────────────────────────────────────────────────
  private goNext(): void {
    if (this.step >= STEPS.length - 1) {
      this.finish();
      return;
    }
    this.step += 1;
    this.renderStep();
  }

  private goBack(): void {
    if (this.step === 0) return;
    this.step -= 1;
    this.renderStep();
  }

  private finish(): void {
    saveManager.markTutorialDone();
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
