import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { audioManager } from '../systems/AudioManager';
import { hapticManager } from '../systems/HapticManager';
import { saveManager } from '../systems/SaveManager';
import { setLanguage, t } from '../systems/I18nManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';

const SLIDER_W = 220;
const SLIDER_H = 12;
const PILL_W = 64;
const PILL_H = 32;
const PILL_R = 14;

export class SettingsScene extends Phaser.Scene {
  private resetConfirming = false;
  private resetBtn!: Button;
  private resetTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: SCENE_KEYS.Settings });
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);
    this.add
      .text(GAME_WIDTH / 2, 30, t('settings.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    let y = 110;
    this.makeSlider(y, t('settings.bgm'), saveManager.bgmVolume, (v) => {
      audioManager.setBgmVolume(v);
    });
    y += 80;
    this.makeSlider(y, t('settings.sfx'), saveManager.sfxVolume, (v) => {
      audioManager.setSfxVolume(v);
      audioManager.playSfx('click');
    });
    y += 80;
    this.makeToggle(y, t('settings.haptic'), saveManager.hapticEnabled, (next) => {
      saveManager.setHapticEnabled(next);
      if (next) hapticManager.vibrate(60);
    });
    y += 64;
    this.makeLanguagePicker(y);
    y += 84;

    this.resetBtn = new Button(this, {
      x: GAME_WIDTH / 2,
      y,
      width: 220,
      height: 44,
      label: t('settings.reset'),
      icon: '🗑',
      fontSize: 14,
      bgColor: COLOR.danger,
      onClick: () => this.handleResetPress(),
    });

    new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 50,
      width: 200,
      height: 44,
      label: t('settings.back').replace(/^←\s*/, ''),
      icon: '←',
      fontSize: 16,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });
  }

  private makeSlider(
    y: number,
    label: string,
    initial: number,
    onChange: (v: number) => void,
  ): void {
    const x = (GAME_WIDTH - SLIDER_W) / 2;

    this.add
      .text(x, y - 16, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 1);

    const track = this.add.graphics();
    track.fillStyle(0x333355, 1);
    track.fillRoundedRect(x, y - SLIDER_H / 2, SLIDER_W, SLIDER_H, SLIDER_H / 2);

    const fill = this.add.graphics();
    const drawFill = (value: number) => {
      fill.clear();
      const w = SLIDER_W * value;
      if (w <= 2) return;
      fill.fillStyle(0xf2cc8f, 1);
      fill.fillRoundedRect(x, y - SLIDER_H / 2, w, SLIDER_H, SLIDER_H / 2);
    };
    drawFill(initial);

    const knob = this.add
      .circle(x + SLIDER_W * initial, y, 13, 0xffffff)
      .setStrokeStyle(3, 0xf2cc8f)
      .setInteractive({ useHandCursor: true, draggable: true });

    knob.on('drag', (_p: unknown, dx: number) => {
      const clampedX = Phaser.Math.Clamp(dx, x, x + SLIDER_W);
      knob.x = clampedX;
      const value = (clampedX - x) / SLIDER_W;
      drawFill(value);
      onChange(value);
    });
    this.input.setDraggable(knob);
  }

  private makeToggle(
    y: number,
    label: string,
    initial: boolean,
    onChange: (v: boolean) => void,
  ): void {
    this.add
      .text(GAME_WIDTH / 2 - 110, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const pill = this.makePill(
      GAME_WIDTH / 2 + 80,
      y,
      initial ? t('settings.on') : t('settings.off'),
      initial ? COLOR.primary : COLOR.muted,
    );

    let current = initial;
    pill.hit.on('pointerup', () => {
      current = !current;
      this.redrawPill(pill, current ? t('settings.on') : t('settings.off'), current ? COLOR.primary : COLOR.muted);
      onChange(current);
    });
  }

  private makeLanguagePicker(y: number): void {
    this.add
      .text(GAME_WIDTH / 2 - 110, y, t('settings.language'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const isVi = saveManager.language === 'vi';
    const vi = this.makePill(GAME_WIDTH / 2 + 40, y, 'VI', isVi ? COLOR.primary : COLOR.muted);
    const en = this.makePill(GAME_WIDTH / 2 + 112, y, 'EN', !isVi ? COLOR.primary : COLOR.muted);

    vi.hit.on('pointerup', () => {
      void setLanguage('vi').then(() => this.scene.restart());
    });
    en.hit.on('pointerup', () => {
      void setLanguage('en').then(() => this.scene.restart());
    });
  }

  private makePill(
    x: number,
    y: number,
    label: string,
    color: number,
  ): {
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    hit: Phaser.GameObjects.Rectangle;
  } {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    this.drawPillBg(bg, color);
    const text = this.add
      .text(0, -1, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const hit = this.add
      .rectangle(0, 0, PILL_W, PILL_H, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    container.add([bg, text, hit]);
    return { container, bg, text, hit };
  }

  private drawPillBg(g: Phaser.GameObjects.Graphics, color: number): void {
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_R);
    g.lineStyle(2, 0x000000, 0.25);
    g.strokeRoundedRect(-PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_R);
  }

  private redrawPill(
    pill: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text },
    label: string,
    color: number,
  ): void {
    pill.text.setText(label);
    this.drawPillBg(pill.bg, color);
  }

  private handleResetPress(): void {
    if (!this.resetConfirming) {
      this.resetConfirming = true;
      this.resetBtn.setLabel(t('settings.reset_confirm'));
      this.resetBtn.setBgColor(0xff3333);
      this.resetTimer = this.time.delayedCall(3000, () => {
        this.resetConfirming = false;
        this.resetBtn.setLabel(t('settings.reset'));
        this.resetBtn.setBgColor(COLOR.danger);
      });
      return;
    }
    this.resetTimer?.remove(false);
    try {
      localStorage.removeItem('thap-ha-noi.save');
    } catch {
      // ignore
    }
    location.reload();
  }
}
